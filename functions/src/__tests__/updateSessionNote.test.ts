/**
 * Unit tests for updateSessionNote Cloud Function
 *
 * Tests the security boundary, input validation, rate limiting,
 * note sanitization, session write, and admin notification fan-out.
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

// ---------------------------------------------------------------------------
// Firestore mock plumbing
// ---------------------------------------------------------------------------

const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}));

const mockTimestampNow = {
  toDate: () => new Date("2026-03-24T12:00:00Z"),
  toMillis: () => 1742817600000,
};

// Per-collection document stores keyed by doc id
type FakeDoc = {
  exists: boolean;
  id: string;
  data: () => Record<string, unknown> | undefined;
};

let usersStore: Record<string, FakeDoc> = {};
let sessionsStore: Record<string, FakeDoc> = {};
let locationsStore: Record<string, FakeDoc> = {};
let adminQueryResult: { docs: Array<{ id: string }> } = { docs: [], size: 0 } as any;

// Track the sessionRef so we can assert update() calls
let capturedSessionRef: { update: jest.Mock };

const mockCollection = jest.fn((name: string) => {
  const store =
    name === "users" ? usersStore : name === "sessions" ? sessionsStore : locationsStore;

  return {
    doc: jest.fn((id: string) => {
      const found = store[id];
      const ref: any = {
        id,
        get: jest.fn().mockResolvedValue(found ?? { exists: false, data: () => undefined }),
        update: mockUpdate,
      };
      if (name === "sessions") {
        capturedSessionRef = ref;
      }
      // support subcollection on user docs (notifications)
      ref.collection = jest.fn(() => ({
        doc: jest.fn((id?: string) => ({
          id: id ?? `notif-${Math.random().toString(36).slice(2)}`,
        })),
      }));
      return ref;
    }),
    where: jest.fn(() => ({
      get: jest.fn().mockResolvedValue(adminQueryResult),
    })),
  };
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => ({ collection: mockCollection, batch: mockBatch })), {
    Timestamp: { now: jest.fn(() => mockTimestampNow) },
  }),
}));

// We only need HttpsError from the mocked module for instanceof checks
const { HttpsError } = jest.requireMock("firebase-functions/v2/https");

// ---------------------------------------------------------------------------
// Import the function under test
// ---------------------------------------------------------------------------

// The function is exported via `exports.updateSessionNote = onCall(handler)`.
// Because we mocked onCall to pass through the handler, we can call it directly.
// We need to require index.ts AFTER mocks are set up.
let updateSessionNote: (request: any) => Promise<any>;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const funcs = require("../index");
  updateSessionNote = funcs.updateSessionNote;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return { exists: true, id, data: () => data };
}

function makeRequest(overrides: Partial<{ auth: any; data: any }> = {}) {
  return {
    auth: { uid: "provider-1" },
    data: { sessionId: "sess-1", notes: "My note" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("updateSessionNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    usersStore = {
      "provider-1": makeDoc("provider-1", {
        role: "provider",
        displayName: "Jane Doe",
        email: "jane@example.com",
      }),
    };

    sessionsStore = {
      "sess-1": makeDoc("sess-1", {
        userId: "provider-1",
        locationId: "loc-1",
        status: "active",
      }),
    };

    locationsStore = {
      "loc-1": makeDoc("loc-1", { name: "Lincoln Elementary" }),
    };

    adminQueryResult = {
      docs: [{ id: "admin-1" }, { id: "admin-2" }],
      size: 2,
    } as any;
  });

  // ---------- Authentication ------------------------------------------------

  it("rejects unauthenticated request", async () => {
    await expect(updateSessionNote({ data: { sessionId: "s", notes: "hi" }, auth: null }))
      .rejects.toThrow("Authentication required");
  });

  // ---------- Input validation ----------------------------------------------

  it("rejects missing sessionId", async () => {
    await expect(updateSessionNote(makeRequest({ data: { notes: "hi" } })))
      .rejects.toThrow("Missing required fields");
  });

  it("rejects non-string notes", async () => {
    await expect(updateSessionNote(makeRequest({ data: { sessionId: "s", notes: 123 } })))
      .rejects.toThrow("Missing required fields");
  });

  // ---------- Authorization -------------------------------------------------

  it("rejects when user doc does not exist", async () => {
    usersStore = {}; // no user doc
    await expect(updateSessionNote(makeRequest())).rejects.toThrow("User not found");
  });

  it("rejects non-provider role", async () => {
    usersStore["provider-1"] = makeDoc("provider-1", { role: "admin" });
    await expect(updateSessionNote(makeRequest())).rejects.toThrow(
      "Only providers can add session notes"
    );
  });

  it("rejects when session does not exist", async () => {
    sessionsStore = {}; // no session doc
    await expect(updateSessionNote(makeRequest())).rejects.toThrow("Session not found");
  });

  it("rejects when provider does not own the session", async () => {
    sessionsStore["sess-1"] = makeDoc("sess-1", { userId: "other-user", locationId: "loc-1" });
    await expect(updateSessionNote(makeRequest())).rejects.toThrow(
      "You are not authorized to update this session"
    );
  });

  // ---------- Rate limiting -------------------------------------------------

  it("rejects when note was updated less than 10 seconds ago", async () => {
    sessionsStore["sess-1"] = makeDoc("sess-1", {
      userId: "provider-1",
      locationId: "loc-1",
      notesUpdatedAt: { toMillis: () => Date.now() - 5_000 }, // 5 sec ago
    });

    await expect(updateSessionNote(makeRequest())).rejects.toThrow(
      "Please wait before updating the note again"
    );
  });

  it("allows update when last update was more than 10 seconds ago", async () => {
    sessionsStore["sess-1"] = makeDoc("sess-1", {
      userId: "provider-1",
      locationId: "loc-1",
      notesUpdatedAt: { toMillis: () => Date.now() - 15_000 }, // 15 sec ago
    });

    const result = await updateSessionNote(makeRequest());
    expect(result.success).toBe(true);
  });

  // ---------- Note sanitization & limits ------------------------------------

  it("strips HTML tags from note text", async () => {
    const req = makeRequest({
      data: { sessionId: "sess-1", notes: "<b>bold</b> and <script>alert(1)</script>text" },
    });

    const result = await updateSessionNote(req);
    expect(result.notes).toBe("bold and alert(1)text");
  });

  it("trims whitespace", async () => {
    const req = makeRequest({
      data: { sessionId: "sess-1", notes: "  hello world  " },
    });

    const result = await updateSessionNote(req);
    expect(result.notes).toBe("hello world");
  });

  it("accepts exactly 500 characters", async () => {
    const exactNote = "a".repeat(500);
    const req = makeRequest({ data: { sessionId: "sess-1", notes: exactNote } });

    const result = await updateSessionNote(req);
    expect(result.notes).toHaveLength(500);
    expect(result.success).toBe(true);
  });

  it("truncates notes longer than 500 characters", async () => {
    const longNote = "x".repeat(600);
    const req = makeRequest({ data: { sessionId: "sess-1", notes: longNote } });

    const result = await updateSessionNote(req);
    expect(result.notes).toHaveLength(500);
  });

  // ---------- Session document write ----------------------------------------

  it("writes notes, hasNotes, notesUpdatedAt, updatedAt to session", async () => {
    await updateSessionNote(makeRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      notes: "My note",
      hasNotes: true,
      notesUpdatedAt: mockTimestampNow,
      updatedAt: mockTimestampNow,
    });
  });

  it("sets hasNotes to false when note text is empty after trim", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", notes: "   " } });

    await updateSessionNote(req);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ hasNotes: false, notes: "" })
    );
  });

  // ---------- Admin notifications -------------------------------------------

  it("creates notification docs for each admin", async () => {
    const result = await updateSessionNote(makeRequest());

    expect(result.success).toBe(true);
    // Two admins → two batch.set() calls
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("notification payload has expected shape", async () => {
    await updateSessionNote(makeRequest());

    const firstCall = mockBatchSet.mock.calls[0];
    const payload = firstCall[1];

    expect(payload).toMatchObject({
      type: "session_note",
      sessionId: "sess-1",
      providerId: "provider-1",
      providerName: "Jane Doe",
      locationName: "Lincoln Elementary",
      read: false,
    });
    expect(payload.notePreview).toBe("My note");
    expect(payload.createdAt).toEqual(mockTimestampNow);
  });

  it("truncates notePreview to 100 chars + ellipsis", async () => {
    const longNote = "z".repeat(200);
    const req = makeRequest({ data: { sessionId: "sess-1", notes: longNote } });

    await updateSessionNote(req);

    const payload = mockBatchSet.mock.calls[0][1];
    expect(payload.notePreview).toBe("z".repeat(100) + "...");
  });

  it("uses fallback location name when location doc missing", async () => {
    locationsStore = {}; // no location doc
    await updateSessionNote(makeRequest());

    const payload = mockBatchSet.mock.calls[0][1];
    expect(payload.locationName).toBe("Unknown location");
  });

  it("uses deterministic doc id session_note_{sessionId} for notifications", async () => {
    await updateSessionNote(makeRequest());

    const notifRef = mockBatchSet.mock.calls[0][0];
    expect(notifRef.id).toBe("session_note_sess-1");
  });

  it("does not create notifications when note is empty after trim", async () => {
    const req = makeRequest({ data: { sessionId: "sess-1", notes: "   " } });
    await updateSessionNote(req);

    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  // ---------- Return value --------------------------------------------------

  it("returns success payload with sanitized note and timestamp", async () => {
    const result = await updateSessionNote(makeRequest());

    expect(result).toEqual({
      success: true,
      sessionId: "sess-1",
      notes: "My note",
      notesUpdatedAt: "2026-03-24T12:00:00.000Z",
    });
  });
});
