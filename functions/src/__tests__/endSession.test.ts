/**
 * Unit tests for endSession Cloud Function — notes + admin notification fan-out.
 *
 * Covers: hasNotes flag, admin notification creation, empty-note no-op,
 * and notification failure not propagating.
 */

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
  onCall: jest.fn((fn: any) => fn),
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_, fn: any) => fn),
}));

// ---------------------------------------------------------------------------
// Firestore mock plumbing
// ---------------------------------------------------------------------------

const mockTransactionUpdate = jest.fn();
const mockTransactionGet = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockWhereGet = jest.fn();

const mockTimestampNow = {
  toDate: () => new Date("2026-03-24T12:00:00Z"),
  toMillis: () => 1742817600000,
};

// Session data returned inside the transaction
const SESSION_DATA = {
  userId: "provider-1",
  locationId: "loc-1",
  status: "active",
  startTime: { toMillis: () => Date.now() - 60 * 60 * 1000 },
};

// Configurable admin query result
let adminQueryResult: { docs: Array<{ id: string }>; size: number } = {
  docs: [{ id: "admin-1" }, { id: "admin-2" }],
  size: 2,
};

const mockCollection = jest.fn((name: string) => ({
  doc: jest.fn((id: string) => {
    const ref: any = {
      id,
      get: mockDocGet,
      update: mockDocUpdate,
    };
    // Support subcollection for notifications
    ref.collection = jest.fn(() => ({
      doc: jest.fn((docId?: string) => ({
        id: docId ?? `notif-${Math.random().toString(36).slice(2)}`,
      })),
    }));
    return ref;
  }),
  where: jest.fn(() => ({ get: mockWhereGet })),
}));

const mockRunTransaction = jest.fn(async (fn: any) => {
  const transaction = {
    get: mockTransactionGet,
    update: mockTransactionUpdate,
  };
  return fn(transaction);
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: mockCollection,
      batch: mockBatch,
      runTransaction: mockRunTransaction,
    })),
    {
      Timestamp: {
        now: jest.fn(() => mockTimestampNow),
        fromDate: jest.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })),
      },
    }
  ),
}));

// ---------------------------------------------------------------------------
// Import function under test
// ---------------------------------------------------------------------------

let endSession: (request: any) => Promise<any>;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const funcs = require("../index");
  endSession = funcs.endSession;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<{ auth: any; data: any }> = {}) {
  return {
    auth: { uid: "provider-1" },
    data: {
      sessionId: "sess-1",
      checkOutTime: new Date().toISOString(),
    },
    ...overrides,
  };
}

function setupTransactionMocks() {
  // transaction.get(sessionRef) → session doc
  mockTransactionGet.mockResolvedValue({
    exists: true,
    data: () => SESSION_DATA,
  });

  // mockDocGet used for provider user doc (outside transaction, during fan-out)
  mockDocGet.mockResolvedValue({
    exists: true,
    data: () => ({ role: "provider", displayName: "Jane Doe", email: "jane@example.com" }),
  });

  // Admin query
  mockWhereGet.mockResolvedValue(adminQueryResult);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("endSession — notes and admin notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adminQueryResult = { docs: [{ id: "admin-1" }, { id: "admin-2" }], size: 2 };
    setupTransactionMocks();
  });

  // ---------- hasNotes flag --------------------------------------------------

  it("sets hasNotes: true in the session update when notes are non-empty", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "Left early" } });
    await endSession(req);

    const updateCall = mockTransactionUpdate.mock.calls.find(
      (call: any[]) => call[1] && "hasNotes" in call[1]
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[1].hasNotes).toBe(true);
    expect(updateCall[1].notes).toBe("Left early");
  });

  it("does not set hasNotes when notes field is absent", async () => {
    const req = makeRequest();
    await endSession(req);

    const allUpdateData = mockTransactionUpdate.mock.calls.map((c: any[]) => c[1]);
    for (const updateData of allUpdateData) {
      expect(updateData).not.toHaveProperty("hasNotes");
    }
  });

  it("does not set hasNotes when notes is whitespace only", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "   " } });
    await endSession(req);

    const allUpdateData = mockTransactionUpdate.mock.calls.map((c: any[]) => c[1]);
    for (const updateData of allUpdateData) {
      expect(updateData).not.toHaveProperty("hasNotes");
    }
  });

  // ---------- Admin notification fan-out ------------------------------------

  it("creates notification docs for each admin when notes are submitted", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "Left early today" } });
    await endSession(req);

    // Two admins → two batch.set calls
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("notification payload has expected shape", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "Left early today" } });
    await endSession(req);

    const payload = mockBatchSet.mock.calls[0][1];
    expect(payload).toMatchObject({
      type: "session_note",
      sessionId: "sess-1",
      providerId: "provider-1",
      read: false,
    });
    expect(payload.notePreview).toBe("Left early today");
  });

  it("uses deterministic doc id session_note_{sessionId} for notifications", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "Left early" } });
    await endSession(req);

    const notifRef = mockBatchSet.mock.calls[0][0];
    expect(notifRef.id).toBe("session_note_sess-1");
  });

  it("does not create notifications when notes are absent", async () => {
    const req = makeRequest();
    await endSession(req);

    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("does not create notifications when notes are whitespace only", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "   " } });
    await endSession(req);

    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("does not create notifications when no admin users exist", async () => {
    adminQueryResult = { docs: [], size: 0 };
    mockWhereGet.mockResolvedValue(adminQueryResult);

    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "Left early" } });
    const result = await endSession(req);

    expect(result.success).toBe(true);
    expect(mockBatchSet).not.toHaveBeenCalled();
  });

  // ---------- Failure isolation ---------------------------------------------

  it("returns success even when notification fan-out throws", async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error("Firestore unavailable"));

    const req = makeRequest({ data: { sessionId: "sess-1", checkOutTime: new Date().toISOString(), notes: "Left early" } });
    const result = await endSession(req);

    // Session close succeeded; notification failure was swallowed
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe("sess-1");
  });
});
