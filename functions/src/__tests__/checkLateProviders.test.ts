/**
 * Unit tests for checkLateProviders Cloud Function.
 *
 * Focuses on the race condition fix: concurrent invocations that both pass
 * the dedup read must not both send push notifications. The atomic create()
 * call is the single point of contention — only the invocation that succeeds
 * there proceeds to push.
 */

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports
// ---------------------------------------------------------------------------

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_schedule: string, handler: () => Promise<void>) => handler),
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  onCall: jest.fn((fn: any) => fn),
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn(),
}));

// Fix Chicago time at 9:30 AM Monday — 30 min past the 9:00 AM schedule's
// 15-minute grace window, so isScheduleLate() returns true.
jest.mock("../lateProviderLogic", () => ({
  ...jest.requireActual("../lateProviderLogic"),
  getChicagoTimeContext: jest.fn(() => ({
    dayOfWeek: 1, // Monday
    nowMinutes: 9 * 60 + 30, // 09:30
    todayDateKey: "2026-03-23",
  })),
}));

// ---------------------------------------------------------------------------
// Firestore mock plumbing
// ---------------------------------------------------------------------------

const mockTimestampNow = { toMillis: () => 1_742_000_000_000 };
const mockTimestampFromMillis = jest.fn((ms: number) => ({ toMillis: () => ms }));

// Granular spies so tests can override per-document behaviour
const mockDedupGet = jest.fn().mockResolvedValue({ exists: false });
const mockDedupCreate = jest.fn().mockResolvedValue(undefined);
const mockSendPushNotification = jest.fn().mockResolvedValue("sent");
const mockInitializeWebPush = jest.fn().mockReturnValue(true);

// Fixed test data
const SCHEDULE_ID = "sched-1";
const PROVIDER_ID = "provider-1";
const LOCATION_ID = "location-1";
const ADMIN_ID = "admin-1";
const DEDUP_ID = `${SCHEDULE_ID}-0900-2026-03-23`;

type FakeDoc = { exists: boolean; id: string; data: () => Record<string, unknown> };

const SCHEDULE_DOC: FakeDoc = {
  exists: true,
  id: SCHEDULE_ID,
  data: () => ({
    dayOfWeek: 1,
    isActive: true,
    startTime: "09:00",
    providerId: PROVIDER_ID,
    locationId: LOCATION_ID,
  }),
};

const LOCATION_DOC: FakeDoc = {
  exists: true,
  id: LOCATION_ID,
  data: () => ({
    active: true,
    assignedProviders: [PROVIDER_ID],
    name: "Lincoln Elementary",
  }),
};

const PROVIDER_DOC: FakeDoc = {
  exists: true,
  id: PROVIDER_ID,
  data: () => ({ isActive: true, displayName: "Alex Smith" }),
};

const ADMIN_DOC: FakeDoc = {
  exists: true,
  id: ADMIN_ID,
  data: () => ({ role: "admin" }),
};

const PUSH_SUB_DOC: FakeDoc = {
  exists: true,
  id: "adminAlerts",
  data: () => ({
    endpoint: "https://push.example.com/sub-1",
    keys: { auth: "auth-key", p256dh: "p256dh-key" },
  }),
};

const mockCollection = jest.fn((name: string) => {
  if (name === "latenessAlerts") {
    return {
      doc: jest.fn((_id: string) => ({
        get: mockDedupGet,
        create: mockDedupCreate,
      })),
    };
  }

  if (name === "schedules") {
    // .where(...).where(...).get()
    return {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: false, docs: [SCHEDULE_DOC] }),
    };
  }

  if (name === "sessions") {
    // .where(...).where(...).where(...).where(...).limit(1).get()
    return {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true }),
    };
  }

  if (name === "locations") {
    return {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue(LOCATION_DOC),
      })),
    };
  }

  if (name === "users") {
    return {
      doc: jest.fn((id: string) => ({
        get: jest.fn().mockResolvedValue(id === PROVIDER_ID ? PROVIDER_DOC : ADMIN_DOC),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            get: jest.fn().mockResolvedValue(PUSH_SUB_DOC),
          })),
        })),
      })),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: false, docs: [ADMIN_DOC] }),
    };
  }

  return { doc: jest.fn(), where: jest.fn().mockReturnThis(), get: jest.fn() };
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({ collection: mockCollection })),
    {
      Timestamp: {
        now: jest.fn(() => mockTimestampNow),
        fromMillis: mockTimestampFromMillis,
      },
    }
  ),
}));

jest.mock("nodemailer", () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }));

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  initializeWebPush: mockInitializeWebPush,
  sendPushNotification: mockSendPushNotification,
  requireAuth: jest.fn(),
  PRODUCTION_CONFIG: { maxBatchSize: 500 },
  SESSION_LIMIT_MS: 32400000,
}));

// ---------------------------------------------------------------------------
// Import the function under test (after mocks are in place)
// ---------------------------------------------------------------------------

let checkLateProviders: () => Promise<void>;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const funcs = require("../index");
  checkLateProviders = funcs.checkLateProviders;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Restore defaults so each test starts clean
  mockDedupGet.mockResolvedValue({ exists: false });
  mockDedupCreate.mockResolvedValue(undefined);
  mockSendPushNotification.mockResolvedValue("sent");
  mockInitializeWebPush.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkLateProviders — race condition fix", () => {
  test("sends push when dedup create() succeeds (happy path)", async () => {
    await checkLateProviders();

    expect(mockDedupCreate).toHaveBeenCalledTimes(1);
    expect(mockSendPushNotification).toHaveBeenCalledTimes(1);
  });

  test("does not send push when dedup create() throws already-exists (concurrent invocation lost the race)", async () => {
    const alreadyExistsError = Object.assign(new Error("Document already exists"), {
      code: "already-exists",
    });
    mockDedupCreate.mockRejectedValueOnce(alreadyExistsError);

    await checkLateProviders();

    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  test("does not send push when dedup read shows doc already exists (normal dedup hit)", async () => {
    mockDedupGet.mockResolvedValue({ exists: true });

    await checkLateProviders();

    expect(mockDedupCreate).not.toHaveBeenCalled();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  test("does not send push and does not write dedup when VAPID is not configured", async () => {
    mockInitializeWebPush.mockReturnValue(false);

    await checkLateProviders();

    expect(mockDedupCreate).not.toHaveBeenCalled();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });
});
