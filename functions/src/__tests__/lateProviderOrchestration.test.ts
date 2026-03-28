/**
 * Unit tests for lateProviderOrchestration.ts
 *
 * Covers eligibility checks, dedup claims, dashboard notification fan-out,
 * and push dispatch behavior.
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  },
}));

jest.mock("../utils", () => ({
  sendPushNotification: mockSendPushNotification,
  PRODUCTION_CONFIG: { maxBatchSize: 500 },
}));

// ---------------------------------------------------------------------------
// Shared spies (declared before jest.mock so the factory can reference them)
// ---------------------------------------------------------------------------

const mockSendPushNotification = jest.fn().mockResolvedValue("sent");

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

type FakeDoc = {
  exists: boolean;
  id: string;
  ref?: { delete: jest.Mock };
  data: () => Record<string, unknown> | undefined;
};

function doc(id: string, data: Record<string, unknown>): FakeDoc {
  return { exists: true, id, data: () => data };
}

function missingDoc(id = "x"): FakeDoc {
  return { exists: false, id, data: () => undefined };
}

const SCHEDULE_ID = "sched-1";
const PROVIDER_ID = "provider-1";
const LOCATION_ID = "location-1";
const ADMIN_ID = "admin-1";
const DATE_KEY = "2026-03-23";
const NOW = { toMillis: () => 1_742_000_000_000 } as any;
const EXPIRE_AT = { toMillis: () => 1_742_604_800_000 } as any;

const SCHEDULE_DOC: FakeDoc = doc(SCHEDULE_ID, {
  dayOfWeek: 1,
  isActive: true,
  startTime: "09:00",
  providerId: PROVIDER_ID,
  locationId: LOCATION_ID,
});

const LOCATION_DOC = doc(LOCATION_ID, {
  active: true,
  assignedProviders: [PROVIDER_ID],
  name: "Lincoln Elementary",
});

const PROVIDER_DOC = doc(PROVIDER_ID, {
  isActive: true,
  displayName: "Alex Smith",
});

const ADMIN_DOC = doc(ADMIN_ID, { role: "admin" });
const PUSH_SUB_DOC = doc("adminAlerts", {
  endpoint: "https://push.example.com/sub-1",
  keys: { auth: "auth", p256dh: "p256dh" },
});

// ---------------------------------------------------------------------------
// DB mock factory
// ---------------------------------------------------------------------------

function makeDb(overrides: {
  dedupExists?: boolean;
  dedupCreateError?: unknown;
  locationDoc?: FakeDoc;
  providerDoc?: FakeDoc;
  sessionEmpty?: boolean;
  pushSubDoc?: FakeDoc;
  existingNotificationIds?: string[];
  notificationCreateError?: unknown;
} = {}) {
  const {
    dedupExists = false,
    dedupCreateError = null,
    locationDoc = LOCATION_DOC,
    providerDoc = PROVIDER_DOC,
    sessionEmpty = true,
    pushSubDoc = PUSH_SUB_DOC,
    existingNotificationIds = [],
    notificationCreateError = null,
  } = overrides;

  const createdDedupDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  const createdNotifications: Array<{ id: string; data: Record<string, unknown> }> = [];
  const seenNotificationIds = new Set(existingNotificationIds);

  const mockCreateDedup = jest.fn(async (id: string, data: Record<string, unknown>) => {
    if (dedupCreateError) {
      throw dedupCreateError;
    }
    createdDedupDocs.push({ id, data });
  });

  const mockDeleteSub = jest.fn().mockResolvedValue(undefined);

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "latenessAlerts") {
        return {
          doc: jest.fn((id: string) => ({
            get: jest.fn().mockResolvedValue({ exists: dedupExists }),
            create: jest.fn((data: Record<string, unknown>) => mockCreateDedup(id, data)),
          })),
        };
      }

      if (name === "locations") {
        return {
          doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(locationDoc) })),
        };
      }

      if (name === "users") {
        return {
          doc: jest.fn((id: string) => {
            if (id === PROVIDER_ID) {
              return { get: jest.fn().mockResolvedValue(providerDoc) };
            }

            const subDoc = {
              ...pushSubDoc,
              ref: { delete: mockDeleteSub },
            };

            return {
              get: jest.fn().mockResolvedValue(ADMIN_DOC),
              collection: jest.fn((subcollection: string) => {
                if (subcollection === "pushSubscriptions") {
                  return {
                    doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(subDoc) })),
                  };
                }

                if (subcollection === "notifications") {
                  return {
                    doc: jest.fn((notificationId: string) => ({
                      id: notificationId,
                      create: jest.fn(async (data: Record<string, unknown>) => {
                        if (seenNotificationIds.has(notificationId)) {
                          throw Object.assign(new Error("already exists"), {
                            code: "already-exists",
                          });
                        }
                        if (notificationCreateError) {
                          throw notificationCreateError;
                        }

                        seenNotificationIds.add(notificationId);
                        createdNotifications.push({ id: notificationId, data });
                      }),
                    })),
                  };
                }

                return {};
              }),
            };
          }),
        };
      }

      if (name === "sessions") {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ empty: sessionEmpty }),
        };
      }

      return {};
    }),
    _createdDedupDocs: createdDedupDocs,
    _createdNotifications: createdNotifications,
    _mockCreateDedup: mockCreateDedup,
    _mockDeleteSub: mockDeleteSub,
  };

  return db as any;
}

// ---------------------------------------------------------------------------
// Import module under test (after mocks are declared)
// ---------------------------------------------------------------------------

import {
  buildEligibleLateProviders,
  checkScheduleEligibility,
  claimLateProviderDedupSlots,
  dispatchAdminDashboardAlerts,
  dispatchAdminPushAlerts,
} from "../lateProviderOrchestration";

// ---------------------------------------------------------------------------
// checkScheduleEligibility
// ---------------------------------------------------------------------------

describe("checkScheduleEligibility", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns candidate when all gates pass without claiming dedup yet", async () => {
    const db = makeDb();
    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toMatchObject({
      scheduleId: SCHEDULE_ID,
      providerId: PROVIDER_ID,
      locationId: LOCATION_ID,
      startTime: "09:00",
      providerName: "Alex Smith",
      locationName: "Lincoln Elementary",
    });
    expect(db._mockCreateDedup).not.toHaveBeenCalled();
  });

  test("returns null when dedup doc already exists", async () => {
    const db = makeDb({ dedupExists: true });
    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
    expect(db._mockCreateDedup).not.toHaveBeenCalled();
  });

  test("returns null when location is inactive", async () => {
    const db = makeDb({
      locationDoc: doc(LOCATION_ID, {
        active: false,
        assignedProviders: [PROVIDER_ID],
        name: "Closed School",
      }),
    });

    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
    expect(db._mockCreateDedup).not.toHaveBeenCalled();
  });

  test("returns null when location does not exist", async () => {
    const db = makeDb({ locationDoc: missingDoc(LOCATION_ID) });
    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
  });

  test("returns null when provider is not assigned to location", async () => {
    const db = makeDb({
      locationDoc: doc(LOCATION_ID, { active: true, assignedProviders: [], name: "School" }),
    });

    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
  });

  test("returns null when provider is disabled", async () => {
    const db = makeDb({
      providerDoc: doc(PROVIDER_ID, { isActive: true, disabled: true, displayName: "Alex" }),
    });

    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
  });

  test("returns null when provider is inactive", async () => {
    const db = makeDb({
      providerDoc: doc(PROVIDER_ID, { isActive: false, displayName: "Alex" }),
    });

    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
  });

  test("returns null when provider has an active session today", async () => {
    const db = makeDb({ sessionEmpty: false });
    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result).toBeNull();
  });

  test("returns null and skips all checks for malformed schedule doc", async () => {
    const malformedDoc = doc(SCHEDULE_ID, { dayOfWeek: 1, isActive: true });
    const db = makeDb();
    const result = await checkScheduleEligibility(db, malformedDoc as any, DATE_KEY);

    expect(result).toBeNull();
    expect(db.collection).not.toHaveBeenCalled();
  });

  test("uses providerId as fallback providerName when displayName is absent", async () => {
    const db = makeDb({
      providerDoc: doc(PROVIDER_ID, { isActive: true }),
    });

    const result = await checkScheduleEligibility(db, SCHEDULE_DOC as any, DATE_KEY);

    expect(result?.providerName).toBe(PROVIDER_ID);
  });
});

// ---------------------------------------------------------------------------
// buildEligibleLateProviders
// ---------------------------------------------------------------------------

describe("buildEligibleLateProviders", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns only the schedules that pass all gates", async () => {
    const db = makeDb();
    const ineligibleDoc = doc("sched-2", {
      dayOfWeek: 1,
      isActive: true,
      startTime: "08:00",
      providerId: "other-provider",
      locationId: LOCATION_ID,
    });

    const results = await buildEligibleLateProviders(
      db,
      [SCHEDULE_DOC as any, ineligibleDoc as any],
      DATE_KEY
    );

    expect(results).toHaveLength(1);
    expect(results[0].scheduleId).toBe(SCHEDULE_ID);
  });

  test("returns empty array when all schedules are ineligible", async () => {
    const db = makeDb({ dedupExists: true });
    const results = await buildEligibleLateProviders(db, [SCHEDULE_DOC as any], DATE_KEY);

    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// claimLateProviderDedupSlots
// ---------------------------------------------------------------------------

describe("claimLateProviderDedupSlots", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns claimed providers when dedup create succeeds", async () => {
    const db = makeDb();
    const lateProviders = [
      {
        scheduleId: SCHEDULE_ID,
        dedupId: `${SCHEDULE_ID}-0900-${DATE_KEY}`,
        providerId: PROVIDER_ID,
        locationId: LOCATION_ID,
        startTime: "09:00",
        providerName: "Alex Smith",
        locationName: "Lincoln Elementary",
      },
    ];

    const claimed = await claimLateProviderDedupSlots(db, lateProviders, NOW, EXPIRE_AT);

    expect(claimed).toHaveLength(1);
    expect(db._createdDedupDocs).toHaveLength(1);
    expect(db._createdDedupDocs[0].id).toBe(`${SCHEDULE_ID}-0900-${DATE_KEY}`);
  });

  test("skips providers when another invocation already claimed the dedup slot", async () => {
    const db = makeDb({
      dedupCreateError: Object.assign(new Error("already exists"), {
        code: "already-exists",
      }),
    });
    const lateProviders = [
      {
        scheduleId: SCHEDULE_ID,
        dedupId: `${SCHEDULE_ID}-0900-${DATE_KEY}`,
        providerId: PROVIDER_ID,
        locationId: LOCATION_ID,
        startTime: "09:00",
        providerName: "Alex Smith",
        locationName: "Lincoln Elementary",
      },
    ];

    const claimed = await claimLateProviderDedupSlots(db, lateProviders, NOW, EXPIRE_AT);

    expect(claimed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dispatchAdminDashboardAlerts
// ---------------------------------------------------------------------------

describe("dispatchAdminDashboardAlerts", () => {
  beforeEach(() => jest.clearAllMocks());

  test("creates dashboard notifications with deterministic IDs", async () => {
    const db = makeDb();
    const adminsSnapshot = { docs: [ADMIN_DOC] } as any;

    await dispatchAdminDashboardAlerts(
      db,
      adminsSnapshot,
      [
        {
          scheduleId: SCHEDULE_ID,
          providerId: PROVIDER_ID,
          providerName: "Alex Smith",
          locationName: "Lincoln Elementary",
          scheduledTime: "09:00",
          minutesLate: 30,
          sessionId: null,
        },
      ],
      DATE_KEY
    );

    expect(db._createdNotifications).toHaveLength(1);
    expect(db._createdNotifications[0]).toEqual({
      id: `late_provider_${SCHEDULE_ID}_${DATE_KEY}`,
      data: expect.objectContaining({
        type: "late_provider",
        providerId: PROVIDER_ID,
        minutesLate: 30,
        read: false,
        createdAt: "SERVER_TIMESTAMP",
      }),
    });
  });

  test("ignores already-existing notification docs without reopening them", async () => {
    const db = makeDb({
      existingNotificationIds: [`late_provider_${SCHEDULE_ID}_${DATE_KEY}`],
    });
    const adminsSnapshot = { docs: [ADMIN_DOC] } as any;

    await expect(
      dispatchAdminDashboardAlerts(
        db,
        adminsSnapshot,
        [
          {
            scheduleId: SCHEDULE_ID,
            providerId: PROVIDER_ID,
            providerName: "Alex Smith",
            locationName: "Lincoln Elementary",
            scheduledTime: "09:00",
            minutesLate: 30,
            sessionId: null,
          },
        ],
        DATE_KEY
      )
    ).resolves.toBeUndefined();

    expect(db._createdNotifications).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// dispatchAdminPushAlerts
// ---------------------------------------------------------------------------

describe("dispatchAdminPushAlerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendPushNotification.mockResolvedValue("sent");
  });

  test("returns sent count when push succeeds", async () => {
    const db = makeDb();
    const adminsSnapshot = { docs: [ADMIN_DOC] } as any;

    const result = await dispatchAdminPushAlerts(db, adminsSnapshot, "Test body");

    expect(result).toEqual({ sent: 1, failed: 0, missing: 0 });
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ url: "/admin/notifications" }),
      })
    );
  });

  test("counts missing when admin has no push subscription", async () => {
    const db = makeDb({ pushSubDoc: missingDoc("adminAlerts") });
    const adminsSnapshot = { docs: [ADMIN_DOC] } as any;

    const result = await dispatchAdminPushAlerts(db, adminsSnapshot, "Test body");

    expect(result).toEqual({ sent: 0, failed: 0, missing: 1 });
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  test("counts failed and deletes subscription on expired result", async () => {
    mockSendPushNotification.mockResolvedValue("expired");
    const db = makeDb();
    const adminsSnapshot = { docs: [ADMIN_DOC] } as any;

    const result = await dispatchAdminPushAlerts(db, adminsSnapshot, "Test body");

    expect(result).toEqual({ sent: 0, failed: 1, missing: 0 });
    expect(db._mockDeleteSub).toHaveBeenCalledTimes(1);
  });

  test("counts failed but does NOT delete subscription on transient failure", async () => {
    mockSendPushNotification.mockResolvedValue("failed");
    const db = makeDb();
    const adminsSnapshot = { docs: [ADMIN_DOC] } as any;

    const result = await dispatchAdminPushAlerts(db, adminsSnapshot, "Test body");

    expect(result).toEqual({ sent: 0, failed: 1, missing: 0 });
    expect(db._mockDeleteSub).not.toHaveBeenCalled();
  });
});
