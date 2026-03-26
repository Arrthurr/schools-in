/**
 * Unit tests for manageAdminAlertSubscription Cloud Function.
 *
 * Covers auth enforcement, role check, action validation,
 * subscription save, and subscription remove.
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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
  onSchedule: jest.fn((_s: string, fn: any) => fn),
}));
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn(),
}));

jest.mock("nodemailer", () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }));

// ---------------------------------------------------------------------------
// Firestore mock plumbing
// ---------------------------------------------------------------------------

const mockTimestampNow = { toMillis: () => 1_742_000_000_000 };

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);

type FakeDoc = { exists: boolean; id: string; data: () => Record<string, unknown> | undefined };

let usersStore: Record<string, FakeDoc> = {};

const mockCollection = jest.fn((name: string) => ({
  doc: jest.fn((id: string) => {
    const found = name === "users" ? usersStore[id] : undefined;
    return {
      id,
      get: jest.fn().mockResolvedValue(found ?? { exists: false, data: () => undefined }),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ set: mockSet, delete: mockDelete })),
      })),
    };
  }),
  where: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
}));

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({ collection: mockCollection })),
    {
      Timestamp: {
        now: jest.fn(() => mockTimestampNow),
        fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })),
      },
      FieldValue: { delete: jest.fn(() => "__delete__") },
    }
  ),
}));

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  requireAuth: jest.fn((req: any) => ({ uid: req.auth?.uid ?? "test-uid", email: req.auth?.email ?? "test@test.com" })),
  initializeWebPush: jest.fn().mockReturnValue(false),
  sendPushNotification: jest.fn(),
  PRODUCTION_CONFIG: { maxBatchSize: 500 },
  SESSION_LIMIT_MS: 32400000,
}));

jest.mock("../lateProviderOrchestration", () => ({
  buildEligibleLateProviders: jest.fn().mockResolvedValue([]),
  dispatchAdminPushAlerts: jest.fn().mockResolvedValue({ sent: 0, failed: 0, missing: 0 }),
}));

// ---------------------------------------------------------------------------
// Import function under test
// ---------------------------------------------------------------------------

const { HttpsError } = jest.requireMock("firebase-functions/v2/https");

let manageAdminAlertSubscription: (request: any) => Promise<any>;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  manageAdminAlertSubscription = require("../index").manageAdminAlertSubscription;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(id: string, data: Record<string, unknown>): FakeDoc {
  return { exists: true, id, data: () => data };
}

const VALID_SUBSCRIPTION = {
  endpoint: "https://push.example.com/sub-1",
  expirationTime: null,
  keys: { auth: "auth-key", p256dh: "p256dh-key" },
};

function adminRequest(overrides: Record<string, unknown> = {}) {
  return {
    auth: { uid: "admin-1", email: "admin@example.com" },
    data: { action: "save", subscription: VALID_SUBSCRIPTION, ...overrides },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  usersStore = {
    "admin-1": makeDoc("admin-1", { role: "admin" }),
  };
});

describe("manageAdminAlertSubscription — auth & role", () => {
  test("throws unauthenticated when requireAuth throws", async () => {
    const { requireAuth } = jest.requireMock("../utils");
    requireAuth.mockImplementationOnce(() => {
      throw new HttpsError("unauthenticated", "Not signed in");
    });

    await expect(manageAdminAlertSubscription(adminRequest())).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  test("throws not-found when user doc does not exist", async () => {
    usersStore = {};

    await expect(manageAdminAlertSubscription(adminRequest())).rejects.toMatchObject({
      code: "not-found",
    });
  });

  test("throws permission-denied when caller is not an admin", async () => {
    usersStore = {
      "admin-1": makeDoc("admin-1", { role: "provider" }),
    };

    await expect(manageAdminAlertSubscription(adminRequest())).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});

describe("manageAdminAlertSubscription — action validation", () => {
  test("throws invalid-argument for unknown action", async () => {
    await expect(
      manageAdminAlertSubscription(adminRequest({ action: "unknown" }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("throws invalid-argument when action is missing", async () => {
    await expect(
      manageAdminAlertSubscription(adminRequest({ action: undefined }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("manageAdminAlertSubscription — save", () => {
  test("writes subscription doc and returns success", async () => {
    const result = await manageAdminAlertSubscription(adminRequest());

    expect(result).toEqual({ success: true });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: VALID_SUBSCRIPTION.endpoint,
        keys: VALID_SUBSCRIPTION.keys,
      })
    );
  });

  test("throws invalid-argument when endpoint is missing", async () => {
    await expect(
      manageAdminAlertSubscription(
        adminRequest({ subscription: { keys: { auth: "a", p256dh: "b" } } })
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("throws invalid-argument when keys are missing", async () => {
    await expect(
      manageAdminAlertSubscription(
        adminRequest({ subscription: { endpoint: "https://push.example.com/x" } })
      )
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mockSet).not.toHaveBeenCalled();
  });

  test("throws invalid-argument when subscription is absent for save action", async () => {
    await expect(
      manageAdminAlertSubscription(adminRequest({ subscription: undefined }))
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("manageAdminAlertSubscription — remove", () => {
  test("deletes subscription doc and returns success", async () => {
    const result = await manageAdminAlertSubscription(
      adminRequest({ action: "remove", subscription: undefined })
    );

    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockSet).not.toHaveBeenCalled();
  });
});
