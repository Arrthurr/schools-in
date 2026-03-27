import { renderHook, act } from "@testing-library/react";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";
import { QUEUE_ACTIONS } from "@/lib/offline/actionQueue";

// Mock the action queue module
jest.mock("@/lib/offline/actionQueue", () => ({
  initActionQueue: jest.fn(),
  queueAction: jest.fn(),
  queueCheckIn: jest.fn(),
  queueCheckOut: jest.fn(),
  getPendingActions: jest.fn(),
  processQueue: jest.fn(),
  getQueueStats: jest.fn(),
  cancelAction: jest.fn(),
  retryAction: jest.fn(),
  removeCompletedActions: jest.fn(),
  QUEUE_ACTIONS: {
    CHECK_IN: "check_in",
    CHECK_OUT: "check_out",
    SESSION_UPDATE: "session_update",
    LOCATION_UPDATE: "location_update",
  },
  QUEUE_STATUS: {
    PENDING: "pending",
    SYNCING: "syncing",
    SYNCED: "synced",
    FAILED: "failed",
    CANCELLED: "cancelled",
  },
  QUEUE_CONFIG: {
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,
    RETRY_DELAY_MULTIPLIER: 2,
    MAX_QUEUE_SIZE: 1000,
    SYNC_INTERVAL: 30000,
    BATCH_SIZE: 10,
    EXPIRATION_TIME: 7 * 24 * 60 * 60 * 1000,
  },
}));

// Mock network status
const mockNetworkStatus = {
  isOnline: true,
  isConnected: true,
  connectionType: "wifi",
};

jest.mock("@/lib/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

let consoleErrorSpy: jest.SpyInstance;
let consoleWarnSpy: jest.SpyInstance;
let consoleLogSpy: jest.SpyInstance;

describe("useOfflineQueue", () => {
  const mockSessionData = {
    providerId: "provider123",
    schoolId: "school456",
    sessionId: "session789",
  };

  const mockLocationData = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 10,
    timestamp: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Reset network status
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.isConnected = true;

    // Setup default mock implementations
    const actionQueueModule = require("@/lib/offline/actionQueue");
    actionQueueModule.initActionQueue.mockResolvedValue(undefined);
    actionQueueModule.getPendingActions.mockResolvedValue([]);
    actionQueueModule.getQueueStats.mockResolvedValue({
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    });
    actionQueueModule.processQueue.mockResolvedValue({
      processed: 0,
      synced: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  describe("Hook Initialization", () => {
    it("should initialize with default state", async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.pendingActions).toEqual([]);
      expect(result.current.stats).toEqual({
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it("should load initial queue state", async () => {
      const mockActions = [
        {
          id: "1",
          type: QUEUE_ACTIONS.CHECK_IN,
          payload: mockSessionData,
          status: "pending",
          timestamp: Date.now(),
          retryCount: 0,
          userId: "user123",
        },
      ];

      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.getPendingActions.mockResolvedValue(mockActions);
      actionQueueModule.getQueueStats.mockResolvedValue({
        total: 1,
        pending: 1,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initial load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.pendingActions).toEqual(mockActions);
      expect(result.current.stats.total).toBe(1);
    });
  });

  describe("Queue Operations", () => {
    it("should add check-in action to queue", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.queueCheckIn.mockResolvedValue("action123");
      actionQueueModule.initActionQueue.mockResolvedValue(undefined);
      actionQueueModule.getPendingActions.mockResolvedValue([]);
      actionQueueModule.getQueueStats.mockResolvedValue({
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        const actionId = await result.current.addCheckIn(
          "school123",
          "user123",
          mockLocationData
        );
        expect(actionId).toBe("action123");
      });

      expect(actionQueueModule.queueCheckIn).toHaveBeenCalledWith(
        "school123",
        "user123",
        mockLocationData
      );
    });

    it("should add check-out action to queue", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.queueCheckOut.mockResolvedValue("action456");

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.addCheckOut(
          "session123",
          "user123",
          mockLocationData
        );
      });

      expect(actionQueueModule.queueCheckOut).toHaveBeenCalledWith(
        "session123",
        "user123",
        mockLocationData
      );
    });

    it("should sync queue when online", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.processQueue.mockResolvedValue({
        processed: 1,
        synced: 1,
        failed: 0,
      });

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        const result_sync = await result.current.syncQueue();
        expect(result_sync).not.toBeNull();
        expect(result_sync!.processed).toBe(1);
      });

      expect(actionQueueModule.processQueue).toHaveBeenCalled();
    });

    it("should handle sync failures gracefully", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      const mockError = new Error("Sync failed");
      actionQueueModule.processQueue.mockRejectedValue(mockError);

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        const syncResult = await result.current.syncQueue();
        expect(syncResult).toBeNull();
      });
    });

    it("should cancel action from queue", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.cancelAction.mockResolvedValue(true);

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.cancelQueuedAction("action123");
      });

      expect(actionQueueModule.cancelAction).toHaveBeenCalledWith("action123");
    });

    it("should clear completed actions", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.removeCompletedActions.mockResolvedValue(5);

      const { result } = renderHook(() => useOfflineQueue("user123"));

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        const removed = await result.current.clearCompletedActions();
        expect(removed).toBe(5);
      });

      expect(actionQueueModule.removeCompletedActions).toHaveBeenCalled();
    });
  });

  describe("Auto-refresh Functionality", () => {
    it("should refresh queue data periodically", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.getPendingActions.mockResolvedValue([]);
      actionQueueModule.getQueueStats.mockResolvedValue({
        total: 1,
        pending: 1,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });

      const originalSyncInterval = actionQueueModule.QUEUE_CONFIG.SYNC_INTERVAL;
      actionQueueModule.QUEUE_CONFIG.SYNC_INTERVAL = 50;

      const { result } = renderHook(() => useOfflineQueue("user123", true));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isInitialized).toBe(true);

      actionQueueModule.getPendingActions.mockClear();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(actionQueueModule.getPendingActions).toHaveBeenCalled();

      actionQueueModule.QUEUE_CONFIG.SYNC_INTERVAL = originalSyncInterval;
    });

    it("should clean up refresh interval on unmount", async () => {
      const { unmount } = renderHook(() => useOfflineQueue("user123", true));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Network Status Integration", () => {
    it("should handle offline state", async () => {
      const { result } = renderHook(() => useOfflineQueue("user123", true));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isOnline).toBe(true);

      await act(async () => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it("should handle network reconnection", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.processQueue.mockResolvedValue({
        processed: 1,
        synced: 1,
        failed: 0,
      });

      const { result } = renderHook(() => useOfflineQueue("user123", true));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(result.current.isOnline).toBe(false);

      await act(async () => {
        window.dispatchEvent(new Event("online"));
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      expect(result.current.isOnline).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle queue operation errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      const mockError = new Error("Queue operation failed");
      actionQueueModule.queueCheckIn.mockRejectedValue(mockError);
      actionQueueModule.getPendingActions.mockResolvedValue([]);
      actionQueueModule.getQueueStats.mockResolvedValue({
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });

      const { result } = renderHook(() => useOfflineQueue("user123"));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        await result.current.addCheckIn("school123", "user123", mockLocationData);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.error).toBeDefined();
    });

    it("should handle data loading errors gracefully", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      const mockError = new Error("Failed to load");

      actionQueueModule.getPendingActions.mockRejectedValue(mockError);
      actionQueueModule.getQueueStats.mockRejectedValue(mockError);

      const { result } = renderHook(() => useOfflineQueue("user123"));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isInitialized).toBe(true);
    });
  });

  describe("Loading States", () => {
    it("should manage initialization state correctly", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.initActionQueue.mockResolvedValue(undefined);
      actionQueueModule.getPendingActions.mockResolvedValue([]);
      actionQueueModule.getQueueStats.mockResolvedValue({
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.pendingActions).toEqual([]);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isInitialized).toBe(true);
    });

    it("should show processing during operations", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.getPendingActions.mockResolvedValue([]);
      actionQueueModule.getQueueStats.mockResolvedValue({
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      });

      let processResolve: (value: unknown) => void;
      actionQueueModule.processQueue.mockImplementation(
        () =>
          new Promise((resolve) => {
            processResolve = resolve;
          })
      );

      const { result } = renderHook(() => useOfflineQueue("user123", false));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isProcessing).toBe(false);

      const syncPromise = result.current.syncQueue();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(result.current.isProcessing).toBe(true);

      await act(async () => {
        processResolve!({ processed: 1, synced: 1, failed: 0 });
        await syncPromise;
      });

      expect(result.current.isProcessing).toBe(false);
    });
  });
});
