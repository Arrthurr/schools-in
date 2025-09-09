import { queueManager } from "@/lib/offline/queueManager";

// Mock the action queue module
jest.mock("@/lib/offline/actionQueue", () => ({
  initActionQueue: jest.fn(),
  queueCheckIn: jest.fn(),
  queueCheckOut: jest.fn(),
  processQueue: jest.fn(),
  getPendingActions: jest.fn(),
  getQueueStats: jest.fn(),
  QUEUE_CONFIG: {
    SYNC_INTERVAL: 30000,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe("QueueManager", () => {
  const mockLocation = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });

    // Setup default mock implementations
    const actionQueueModule = require("@/lib/offline/actionQueue");
    actionQueueModule.initActionQueue.mockResolvedValue(undefined);
    actionQueueModule.queueCheckIn.mockResolvedValue("checkin123");
    actionQueueModule.queueCheckOut.mockResolvedValue("checkout123");
    actionQueueModule.processQueue.mockResolvedValue({
      processed: 0,
      synced: 0,
      failed: 0,
    });
    actionQueueModule.getPendingActions.mockResolvedValue([]);
    actionQueueModule.getQueueStats.mockResolvedValue({
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    });

    // Mock fetch to return failure (forcing queue usage)
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });
  });

  describe("Singleton Instance", () => {
    it("should have a pre-configured instance", () => {
      expect(queueManager).toBeDefined();
      expect(typeof queueManager.checkIn).toBe("function");
      expect(typeof queueManager.checkOut).toBe("function");
      expect(typeof queueManager.syncNow).toBe("function");
      expect(typeof queueManager.getStats).toBe("function");
    });
  });

  describe("Check-in Operations", () => {
    it("should queue check-in when offline", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");

      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
      });

      const result = await queueManager.checkIn(
        "school123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(true);
      expect(result.actionId).toBe("checkin123");
      expect(result.offline).toBe(true);
      expect(actionQueueModule.queueCheckIn).toHaveBeenCalledWith(
        "school123",
        "user123",
        mockLocation
      );
    });

    it("should fallback to queue when API fails", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");

      const result = await queueManager.checkIn(
        "school123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(true);
      expect(result.actionId).toBe("checkin123");
      expect(result.offline).toBe(true);
      expect(actionQueueModule.queueCheckIn).toHaveBeenCalled();
    });

    it("should handle check-in errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.queueCheckIn.mockRejectedValue(
        new Error("Check-in failed")
      );

      const result = await queueManager.checkIn(
        "school123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Check-out Operations", () => {
    it("should queue check-out when offline", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");

      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
      });

      const result = await queueManager.checkOut(
        "session123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(true);
      expect(result.actionId).toBe("checkout123");
      expect(result.offline).toBe(true);
      expect(actionQueueModule.queueCheckOut).toHaveBeenCalledWith(
        "session123",
        "user123",
        mockLocation
      );
    });

    it("should handle check-out errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.queueCheckOut.mockRejectedValue(
        new Error("Check-out failed")
      );

      const result = await queueManager.checkOut(
        "session123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Manual Sync", () => {
    it("should sync when online", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.processQueue.mockResolvedValue({
        processed: 5,
        synced: 4,
        failed: 1,
      });

      const result = await queueManager.syncNow();

      expect(result).not.toBeNull();
      expect(result!.processed).toBe(5);
      expect(result!.synced).toBe(4);
      expect(result!.failed).toBe(1);
      expect(actionQueueModule.processQueue).toHaveBeenCalled();
    });

    it("should handle sync errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.processQueue.mockRejectedValue(
        new Error("Sync failed")
      );

      await expect(queueManager.syncNow()).rejects.toThrow("Sync failed");
    });

    it("should return null when offline", async () => {
      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
      });

      const result = await queueManager.syncNow();

      expect(result).toBeNull();
    });
  });

  describe("Queue Statistics", () => {
    it("should get queue statistics", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      const mockStats = {
        total: 10,
        pending: 5,
        syncing: 2,
        synced: 2,
        failed: 1,
        cancelled: 0,
      };
      actionQueueModule.getQueueStats.mockResolvedValue(mockStats);

      const stats = await queueManager.getStats();

      expect(stats).toEqual(mockStats);
      expect(actionQueueModule.getQueueStats).toHaveBeenCalled();
    });

    it("should handle stats errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.getQueueStats.mockRejectedValue(
        new Error("Stats failed")
      );

      await expect(queueManager.getStats()).rejects.toThrow("Stats failed");
    });
  });
});

describe("QueueManager", () => {
  const mockLocation = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });

    // Setup default mock implementations
    const actionQueueModule = require("@/lib/offline/actionQueue");
    actionQueueModule.initActionQueue.mockResolvedValue(undefined);
    actionQueueModule.queueCheckIn.mockResolvedValue("checkin123");
    actionQueueModule.queueCheckOut.mockResolvedValue("checkout123");
    actionQueueModule.processQueue.mockResolvedValue({
      processed: 0,
      synced: 0,
      failed: 0,
    });
    actionQueueModule.getPendingActions.mockResolvedValue([]);
    actionQueueModule.getQueueStats.mockResolvedValue({
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Singleton Instance", () => {
    it("should have a pre-configured instance", () => {
      expect(queueManager).toBeDefined();
      expect(typeof queueManager.checkIn).toBe("function");
      expect(typeof queueManager.checkOut).toBe("function");
    });
  });

  describe("Check-in Operations", () => {
    it("should queue check-in when offline", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");

      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
      });

      const result = await queueManager.checkIn(
        "school123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(true);
      expect(result.actionId).toBe("checkin123");
      expect(result.offline).toBe(true);
      expect(actionQueueModule.queueCheckIn).toHaveBeenCalledWith(
        "school123",
        "user123",
        mockLocation
      );
    });

    it("should handle online check-in", async () => {
      // Mock fetch to simulate online API
      global.fetch = jest.fn().mockResolvedValue({
        ok: false, // Force fallback to queue
      });

      const actionQueueModule = require("@/lib/offline/actionQueue");

      const result = await queueManager.checkIn(
        "school123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(true);
      expect(actionQueueModule.queueCheckIn).toHaveBeenCalled();
    });

    it("should handle check-in errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.queueCheckIn.mockRejectedValue(
        new Error("Check-in failed")
      );

      const result = await queueManager.checkIn(
        "school123",
        "user123",
        mockLocation
      );

      expect(result.success).toBe(false);
    });
  });
});
