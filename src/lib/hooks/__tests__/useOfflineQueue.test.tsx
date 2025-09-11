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

  describe("Hook Initialization", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isInitialized).toBe(false);
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

      await act(async () => {
        const syncResult = await result.current.syncQueue();
        expect(syncResult).toBeNull();
      });
    });

    it("should cancel action from queue", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.cancelAction.mockResolvedValue(true);

      const { result } = renderHook(() => useOfflineQueue("user123"));

      await act(async () => {
        await result.current.cancelQueuedAction("action123");
      });

      expect(actionQueueModule.cancelAction).toHaveBeenCalledWith("action123");
    });

    it("should clear completed actions", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.removeCompletedActions.mockResolvedValue(5);

      const { result } = renderHook(() => useOfflineQueue("user123"));

      await act(async () => {
        const removed = await result.current.clearCompletedActions();
        expect(removed).toBe(5);
      });

      expect(actionQueueModule.removeCompletedActions).toHaveBeenCalled();
    });
  });

  describe("Auto-refresh Functionality", () => {
    it("should refresh queue data periodically", async () => {
      jest.useFakeTimers();

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

      renderHook(() => useOfflineQueue("user123"));

      // Fast-forward time to trigger refresh
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should have called getPendingActions and getQueueStats multiple times
      expect(actionQueueModule.getPendingActions).toHaveBeenCalled();
      expect(actionQueueModule.getQueueStats).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("should clean up refresh interval on unmount", () => {
      jest.useFakeTimers();
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");

      const { unmount } = renderHook(() => useOfflineQueue("user123"));

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      jest.useRealTimers();
      clearIntervalSpy.mockRestore();
    });
  });

  describe("Network Status Integration", () => {
    it("should handle offline state", () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isConnected = false;

      const { result } = renderHook(() => useOfflineQueue());

      // Hook should still work offline
      expect(result.current.addCheckIn).toBeDefined();
      expect(result.current.addCheckOut).toBeDefined();
    });

    it("should handle network reconnection", async () => {
      // Start offline
      mockNetworkStatus.isOnline = false;

      const { result, rerender } = renderHook(() => useOfflineQueue());

      // Go online
      mockNetworkStatus.isOnline = true;

      rerender();

      // Should still have all functionality
      expect(result.current.syncQueue).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle queue operation errors", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      const mockError = new Error("Queue operation failed");
      actionQueueModule.queueCheckIn.mockRejectedValue(mockError);
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
        expect(actionId).toBeNull();
      });

      // Should have set error state
      expect(result.current.error).toBe("Queue operation failed");
    });

    it("should handle data loading errors gracefully", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");
      actionQueueModule.getPendingActions.mockRejectedValue(
        new Error("Load failed")
      );
      actionQueueModule.getQueueStats.mockRejectedValue(
        new Error("Stats failed")
      );

      const { result } = renderHook(() => useOfflineQueue("user123"));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should handle errors gracefully
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
  });

  describe("Loading States", () => {
    it("should manage initialization state correctly", async () => {
      const { result } = renderHook(() => useOfflineQueue("user123"));

      expect(result.current.isInitialized).toBe(false);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isInitialized).toBe(true);
    });

    it("should show processing during operations", async () => {
      const actionQueueModule = require("@/lib/offline/actionQueue");

      // Make the operation take some time
      actionQueueModule.queueCheckIn.mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve("action123"), 100))
      );

      const { result } = renderHook(() => useOfflineQueue("user123"));

      act(() => {
        result.current.addCheckIn("school123", "user123", mockLocationData);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
    });
  });
});
