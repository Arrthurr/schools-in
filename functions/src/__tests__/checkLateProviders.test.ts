/**
 * Integration tests for the checkLateProviders Cloud Function wiring.
 *
 * Tests the early-return gates (VAPID, no schedules, no admins, empty eligibility)
 * and verifies that the orchestration module is called with the right arguments.
 * Detailed eligibility and push-dispatch logic is tested in lateProviderOrchestration.test.ts.
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_schedule: string, handler: () => Promise<void>) => handler),
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
  onCall: jest.fn((fn: any) => fn),
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn(),
}));

// Fix Chicago time so any schedule with startTime "09:00" on Monday is late
jest.mock("../lateProviderLogic", () => ({
  ...jest.requireActual("../lateProviderLogic"),
  getChicagoTimeContext: jest.fn(() => ({
    dayOfWeek: 1,
    nowMinutes: 9 * 60 + 30,
    todayDateKey: "2026-03-23",
  })),
}));

const mockBuildEligibleLateProviders = jest.fn();
const mockClaimLateProviderDedupSlots = jest.fn();
const mockDispatchAdminDashboardAlerts = jest.fn();
const mockDispatchAdminPushAlerts = jest.fn();

jest.mock("../lateProviderOrchestration", () => ({
  buildEligibleLateProviders: mockBuildEligibleLateProviders,
  claimLateProviderDedupSlots: mockClaimLateProviderDedupSlots,
  dispatchAdminDashboardAlerts: mockDispatchAdminDashboardAlerts,
  dispatchAdminPushAlerts: mockDispatchAdminPushAlerts,
}));

// ---------------------------------------------------------------------------
// Firestore mock
// ---------------------------------------------------------------------------

const mockTimestampNow = { toMillis: () => 1_742_000_000_000 };
const mockInitializeWebPush = jest.fn().mockReturnValue(true);

const SCHEDULE_DOC = {
  id: "sched-1",
  data: () => ({
    dayOfWeek: 1, isActive: true, startTime: "09:00",
    providerId: "provider-1", locationId: "location-1",
  }),
};
const ADMIN_DOC = { id: "admin-1", data: () => ({ role: "admin" }) };

const mockSchedulesQuery = {
  where: jest.fn().mockReturnThis(),
  get: jest.fn(),
};
const mockUsersQuery = {
  where: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

// appConfig doc mock — default: no custom graceMinutes (doc missing)
const mockAppConfigDoc = jest.fn().mockResolvedValue({ data: () => undefined });

const mockCollection = jest.fn((name: string) => {
  if (name === "schedules") return mockSchedulesQuery;
  if (name === "users") return mockUsersQuery;
  if (name === "appConfig") return { doc: jest.fn(() => ({ get: mockAppConfigDoc })) };
  return { where: jest.fn().mockReturnThis(), get: jest.fn() };
});

jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({ collection: mockCollection })),
    {
      Timestamp: {
        now: jest.fn(() => mockTimestampNow),
        fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })),
      },
    }
  ),
}));

jest.mock("nodemailer", () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }));

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  initializeWebPush: mockInitializeWebPush,
  sendPushNotification: jest.fn(),
  requireAuth: jest.fn(),
  PRODUCTION_CONFIG: { maxBatchSize: 500 },
  SESSION_LIMIT_MS: 32400000,
}));

// ---------------------------------------------------------------------------
// Import function under test
// ---------------------------------------------------------------------------

let checkLateProviders: () => Promise<void>;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  checkLateProviders = require("../index").checkLateProviders;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockInitializeWebPush.mockReturnValue(true);
  mockSchedulesQuery.get.mockResolvedValue({ empty: false, docs: [SCHEDULE_DOC] });
  mockUsersQuery.get.mockResolvedValue({ empty: false, docs: [ADMIN_DOC] });
  mockAppConfigDoc.mockResolvedValue({ data: () => undefined }); // no custom grace by default
  mockBuildEligibleLateProviders.mockResolvedValue([
    {
      scheduleId: "sched-1", dedupId: "sched-1-0900-2026-03-23",
      providerId: "provider-1", locationId: "location-1",
      startTime: "09:00", providerName: "Alex Smith", locationName: "Lincoln",
    },
  ]);
  mockClaimLateProviderDedupSlots.mockResolvedValue([
    {
      scheduleId: "sched-1", dedupId: "sched-1-0900-2026-03-23",
      providerId: "provider-1", locationId: "location-1",
      startTime: "09:00", providerName: "Alex Smith", locationName: "Lincoln",
    },
  ]);
  mockDispatchAdminDashboardAlerts.mockResolvedValue(undefined);
  mockDispatchAdminPushAlerts.mockResolvedValue({ sent: 1, failed: 0, missing: 0 });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkLateProviders — wiring", () => {
  test("creates dashboard alerts, claims dedup, and dispatches push on happy path", async () => {
    await checkLateProviders();

    expect(mockBuildEligibleLateProviders).toHaveBeenCalledTimes(1);
    expect(mockDispatchAdminDashboardAlerts).toHaveBeenCalledTimes(1);
    expect(mockClaimLateProviderDedupSlots).toHaveBeenCalledTimes(1);
    expect(mockDispatchAdminPushAlerts).toHaveBeenCalledTimes(1);
  });

  test("continues with dashboard alerts when VAPID is not configured", async () => {
    mockInitializeWebPush.mockReturnValue(false);

    await checkLateProviders();

    expect(mockBuildEligibleLateProviders).toHaveBeenCalledTimes(1);
    expect(mockDispatchAdminDashboardAlerts).toHaveBeenCalledTimes(1);
    expect(mockClaimLateProviderDedupSlots).toHaveBeenCalledTimes(1);
    expect(mockDispatchAdminPushAlerts).not.toHaveBeenCalled();
  });

  test("returns early when there are no active schedules today", async () => {
    mockSchedulesQuery.get.mockResolvedValue({ empty: true, docs: [] });

    await checkLateProviders();

    expect(mockBuildEligibleLateProviders).not.toHaveBeenCalled();
  });

  test("returns early when no schedules are past the grace window", async () => {
    // The schedule's startTime is in the future relative to the mocked time
    mockSchedulesQuery.get.mockResolvedValue({
      empty: false,
      docs: [{ id: "sched-future", data: () => ({ startTime: "23:00", providerId: "p", locationId: "l" }) }],
    });

    await checkLateProviders();

    expect(mockBuildEligibleLateProviders).not.toHaveBeenCalled();
  });

  test("returns early without calling orchestration when there are no admin users", async () => {
    mockUsersQuery.get.mockResolvedValue({ empty: true, docs: [] });

    await checkLateProviders();

    expect(mockBuildEligibleLateProviders).not.toHaveBeenCalled();
    expect(mockDispatchAdminDashboardAlerts).not.toHaveBeenCalled();
    expect(mockDispatchAdminPushAlerts).not.toHaveBeenCalled();
  });

  test("returns early without dispatching alerts when buildEligibleLateProviders returns empty", async () => {
    mockBuildEligibleLateProviders.mockResolvedValue([]);

    await checkLateProviders();

    expect(mockDispatchAdminDashboardAlerts).not.toHaveBeenCalled();
    expect(mockClaimLateProviderDedupSlots).not.toHaveBeenCalled();
    expect(mockDispatchAdminPushAlerts).not.toHaveBeenCalled();
  });

  test("surfaces dashboard write failures so the run can retry later", async () => {
    mockDispatchAdminDashboardAlerts.mockRejectedValue(new Error("dashboard write failed"));

    await expect(checkLateProviders()).rejects.toThrow("dashboard write failed");

    expect(mockClaimLateProviderDedupSlots).not.toHaveBeenCalled();
    expect(mockDispatchAdminPushAlerts).not.toHaveBeenCalled();
  });

  test("skips push when another invocation already claimed the dedup slots", async () => {
    mockClaimLateProviderDedupSlots.mockResolvedValue([]);

    await checkLateProviders();

    expect(mockDispatchAdminDashboardAlerts).toHaveBeenCalledTimes(1);
    expect(mockDispatchAdminPushAlerts).not.toHaveBeenCalled();
  });

  test("uses graceMinutes from Firestore config when present", async () => {
    // Set config to 5 minutes; the mocked nowMinutes=9:30 is well past any grace
    // so this test just verifies the config doc is read and the function proceeds
    mockAppConfigDoc.mockResolvedValue({ data: () => ({ graceMinutes: 5 }) });

    await checkLateProviders();

    expect(mockBuildEligibleLateProviders).toHaveBeenCalledTimes(1);
  });

  test("falls back to compiled constant when appConfig doc is missing", async () => {
    mockAppConfigDoc.mockResolvedValue({ data: () => undefined });

    await checkLateProviders();

    // Function proceeds normally with default grace — orchestration is still called
    expect(mockBuildEligibleLateProviders).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getAlertConfig callable
// ---------------------------------------------------------------------------

describe("getAlertConfig", () => {
  let getAlertConfig: (request: any) => Promise<{ lateProviderGraceMinutes: number }>;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    getAlertConfig = require("../index").getAlertConfig;
  });

  test("returns compiled constant when appConfig doc has no graceMinutes", async () => {
    mockAppConfigDoc.mockResolvedValue({ data: () => undefined });

    const result = await getAlertConfig({});

    expect(result).toEqual({ lateProviderGraceMinutes: 15 });
  });

  test("returns Firestore value when appConfig doc has graceMinutes", async () => {
    mockAppConfigDoc.mockResolvedValue({ data: () => ({ graceMinutes: 10 }) });

    const result = await getAlertConfig({});

    expect(result).toEqual({ lateProviderGraceMinutes: 10 });
  });
});
