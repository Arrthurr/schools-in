import QueueManager from "@/lib/offline/queueManager";

jest.mock("@/lib/offline/actionQueue", () => ({
  initActionQueue: jest.fn(),
  queueCheckIn: jest.fn(),
  queueCheckOut: jest.fn(),
  processQueue: jest.fn(),
  getPendingActions: jest.fn(),
  getQueueStats: jest.fn(),
  removeCompletedActions: jest.fn(),
  QUEUE_CONFIG: {
    SYNC_INTERVAL: 30000,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,
  },
}));

const actionQueueMocks = jest.requireMock("@/lib/offline/actionQueue") as jest.Mocked<
  typeof import("@/lib/offline/actionQueue")
>;

jest.mock("@/lib/offline/syncManager", () => ({
  syncManager: {
    sync: jest.fn().mockResolvedValue({
      processed: 4,
      synced: 3,
      failed: 1,
      strategy: "balanced",
      networkScore: 0.9,
    }),
    getSyncRecommendations: jest.fn().mockReturnValue({
      shouldSync: true,
      reason: "network-stable",
    }),
  },
}));

jest.mock("@/lib/firebase/firestore", () => ({
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
  getDocument: jest.fn(),
  COLLECTIONS: {
    SESSIONS: "sessions",
  },
}));

const firestoreMocks = jest.requireMock("@/lib/firebase/firestore") as jest.Mocked<
  typeof import("@/lib/firebase/firestore")
>;

jest.mock("firebase/firestore", () => ({
  Timestamp: {
    now: jest.fn(),
  },
}));

const firebaseTimestampMock = jest.requireMock("firebase/firestore") as {
  Timestamp: { now: jest.Mock };
};

const timestampNow = firebaseTimestampMock.Timestamp.now;
timestampNow.mockImplementation(() => ({
  seconds: 1_700_000_000,
  nanoseconds: 0,
  toMillis: () => 1_700_000_000_000,
}));

let consoleErrorSpy: jest.SpyInstance;
let consoleWarnSpy: jest.SpyInstance;
let consoleLogSpy: jest.SpyInstance;

const setNavigatorOnline = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

const createQueueManager = () => {
  const manager = new QueueManager({
    enableAutoSync: false,
    enableBackgroundSync: false,
    enableIntelligentSync: false,
  });

  (manager as unknown as { isInitialized: boolean }).isInitialized = true;

  return manager;
};

describe("QueueManager", () => {
  const mockLocation = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    setNavigatorOnline(true);

    actionQueueMocks.initActionQueue.mockResolvedValue(undefined);
    actionQueueMocks.queueCheckIn.mockResolvedValue("checkin123");
    actionQueueMocks.queueCheckOut.mockResolvedValue("checkout123");
    actionQueueMocks.processQueue.mockResolvedValue({
      processed: 5,
      synced: 4,
      failed: 1,
    });
    actionQueueMocks.getQueueStats.mockResolvedValue({
      total: 10,
      pending: 5,
      syncing: 2,
      synced: 2,
      failed: 1,
      cancelled: 0,
    });

    firestoreMocks.createDocument.mockResolvedValue("session-1");
    firestoreMocks.getDocument.mockResolvedValue({
      id: "session-1",
      startTime: {
        toMillis: () => 1_700_000_000_000,
      },
      checkInTime: {
        toMillis: () => 1_700_000_000_000,
        seconds: 1_700_000_000,
      },
    });
    firestoreMocks.updateDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  describe("Check-in Operations", () => {
    it("queues check-in when offline", async () => {
      const manager = createQueueManager();
      setNavigatorOnline(false);

      const result = await manager.checkIn("school123", "user123", mockLocation);

      expect(result).toEqual({ success: true, actionId: "checkin123", offline: true });
      expect(actionQueueMocks.queueCheckIn).toHaveBeenCalledWith("school123", "user123", mockLocation, undefined);
    });

    it("falls back to queue when online check-in fails", async () => {
      const manager = createQueueManager();
      firestoreMocks.createDocument.mockRejectedValueOnce(new Error("fail"));

      const result = await manager.checkIn("school123", "user123", mockLocation);

      expect(result.offline).toBe(true);
      expect(actionQueueMocks.queueCheckIn).toHaveBeenCalled();
    });

    it("returns failure when queuing check-in throws", async () => {
      const manager = createQueueManager();
      actionQueueMocks.queueCheckIn.mockRejectedValueOnce(new Error("queue error"));

      const result = await manager.checkIn("school123", "user123", mockLocation);

      expect(result.success).toBe(false);
    });
  });

  describe("Check-out Operations", () => {
    it("queues check-out when offline", async () => {
      const manager = createQueueManager();
      setNavigatorOnline(false);

      const result = await manager.checkOut("session123", "user123", mockLocation);

      expect(result).toEqual({ success: true, actionId: "checkout123", offline: true });
      expect(actionQueueMocks.queueCheckOut).toHaveBeenCalledWith("session123", "user123", mockLocation, undefined);
    });

    it("returns failure when queuing check-out throws", async () => {
      const manager = createQueueManager();
      setNavigatorOnline(false);
      actionQueueMocks.queueCheckOut.mockRejectedValueOnce(new Error("queue error"));

      const result = await manager.checkOut("session123", "user123", mockLocation);

      expect(result.success).toBe(false);
    });
  });

  describe("Manual Sync", () => {
    it("processes queue when online", async () => {
      const manager = createQueueManager();

      const result = await manager.syncNow();

      expect(result).toEqual({ processed: 5, synced: 4, failed: 1 });
      expect(actionQueueMocks.processQueue).toHaveBeenCalled();
    });

    it("returns null when sync processing fails", async () => {
      const manager = createQueueManager();
      actionQueueMocks.processQueue.mockRejectedValueOnce(new Error("sync fail"));

      const result = await manager.syncNow();

      expect(result).toBeNull();
    });

    it("skips sync when offline", async () => {
      const manager = createQueueManager();
      setNavigatorOnline(false);

      const result = await manager.syncNow();

      expect(result).toBeNull();
      expect(actionQueueMocks.processQueue).not.toHaveBeenCalled();
    });
  });

  describe("Queue statistics", () => {
    it("returns stats when initialized", async () => {
      const manager = createQueueManager();

      const stats = await manager.getStats();

      expect(stats).toEqual({
        total: 10,
        pending: 5,
        syncing: 2,
        synced: 2,
        failed: 1,
        cancelled: 0,
      });
      expect(actionQueueMocks.getQueueStats).toHaveBeenCalled();
    });
  });
});
