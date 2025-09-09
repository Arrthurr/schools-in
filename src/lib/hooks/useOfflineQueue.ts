// React hook for managing offline action queue
// Provides queue operations and status for React components

import { useState, useEffect, useCallback, useRef } from "react";
import {
  initActionQueue,
  queueAction,
  queueCheckIn,
  queueCheckOut,
  getPendingActions,
  processQueue,
  getQueueStats,
  cancelAction,
  retryAction,
  removeCompletedActions,
  QUEUE_ACTIONS,
  QUEUE_STATUS,
  QUEUE_CONFIG,
  type QueuedAction,
  type QueueActionType,
  type QueueStatus,
} from "@/lib/offline/actionQueue";

// Hook state interface
interface UseOfflineQueueState {
  isInitialized: boolean;
  pendingActions: QueuedAction[];
  stats: {
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    cancelled: number;
    oldestPending?: number;
    newestPending?: number;
  };
  isProcessing: boolean;
  lastSyncTime?: number;
  error?: string;
}

// Hook return interface
interface UseOfflineQueueReturn extends UseOfflineQueueState {
  // Action operations
  addCheckIn: (
    schoolId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ) => Promise<string | null>;
  addCheckOut: (
    sessionId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ) => Promise<string | null>;
  addAction: (
    type: QueueActionType,
    payload: any,
    userId: string,
    metadata?: any
  ) => Promise<string | null>;

  // Queue management
  syncQueue: () => Promise<{
    processed: number;
    synced: number;
    failed: number;
  } | null>;
  refreshQueue: () => Promise<void>;
  cancelQueuedAction: (actionId: string) => Promise<boolean>;
  retryQueuedAction: (actionId: string) => Promise<boolean>;
  clearCompletedActions: () => Promise<number>;

  // Status checks
  hasPendingActions: boolean;
  hasFailedActions: boolean;
  isOnline: boolean;
}

export function useOfflineQueue(
  userId?: string,
  autoSync = true
): UseOfflineQueueReturn {
  const [state, setState] = useState<UseOfflineQueueState>({
    isInitialized: false,
    pendingActions: [],
    stats: {
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    },
    isProcessing: false,
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);

  // Initialize the queue
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return;

    try {
      await initActionQueue();
      isInitializedRef.current = true;
      setState((prev) => ({ ...prev, isInitialized: true, error: undefined }));
      console.log("Offline queue initialized");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initialize queue";
      setState((prev) => ({ ...prev, error: errorMessage }));
      console.error("Failed to initialize offline queue:", error);
    }
  }, []);

  // Refresh queue data
  const refreshQueue = useCallback(async () => {
    if (!isInitializedRef.current) return;

    try {
      const [pendingActions, stats] = await Promise.all([
        getPendingActions(userId),
        getQueueStats(),
      ]);

      setState((prev) => ({
        ...prev,
        pendingActions,
        stats,
        error: undefined,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to refresh queue";
      setState((prev) => ({ ...prev, error: errorMessage }));
      console.error("Failed to refresh queue:", error);
    }
  }, [userId]);

  // Add check-in action to queue
  const addCheckIn = useCallback(
    async (
      schoolId: string,
      userId: string,
      location: { latitude: number; longitude: number; accuracy?: number }
    ): Promise<string | null> => {
      if (!isInitializedRef.current) {
        console.error("Queue not initialized");
        return null;
      }

      try {
        const actionId = await queueCheckIn(schoolId, userId, location);
        await refreshQueue();
        return actionId;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to queue check-in";
        setState((prev) => ({ ...prev, error: errorMessage }));
        console.error("Failed to queue check-in:", error);
        return null;
      }
    },
    [refreshQueue]
  );

  // Add check-out action to queue
  const addCheckOut = useCallback(
    async (
      sessionId: string,
      userId: string,
      location: { latitude: number; longitude: number; accuracy?: number }
    ): Promise<string | null> => {
      if (!isInitializedRef.current) {
        console.error("Queue not initialized");
        return null;
      }

      try {
        const actionId = await queueCheckOut(sessionId, userId, location);
        await refreshQueue();
        return actionId;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to queue check-out";
        setState((prev) => ({ ...prev, error: errorMessage }));
        console.error("Failed to queue check-out:", error);
        return null;
      }
    },
    [refreshQueue]
  );

  // Add generic action to queue
  const addAction = useCallback(
    async (
      type: QueueActionType,
      payload: any,
      userId: string,
      metadata?: any
    ): Promise<string | null> => {
      if (!isInitializedRef.current) {
        console.error("Queue not initialized");
        return null;
      }

      try {
        const actionId = await queueAction(type, payload, userId, metadata);
        await refreshQueue();
        return actionId;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to queue action";
        setState((prev) => ({ ...prev, error: errorMessage }));
        console.error("Failed to queue action:", error);
        return null;
      }
    },
    [refreshQueue]
  );

  // Sync the queue
  const syncQueue = useCallback(async (): Promise<{
    processed: number;
    synced: number;
    failed: number;
  } | null> => {
    if (!isInitializedRef.current || !isOnline) {
      return null;
    }

    setState((prev) => ({ ...prev, isProcessing: true }));

    try {
      const result = await processQueue();
      const syncTime = Date.now();

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        lastSyncTime: syncTime,
        error: undefined,
      }));

      await refreshQueue();
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to sync queue";
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }));
      console.error("Failed to sync queue:", error);
      return null;
    }
  }, [isOnline, refreshQueue]);

  // Cancel a queued action
  const cancelQueuedAction = useCallback(
    async (actionId: string): Promise<boolean> => {
      if (!isInitializedRef.current) return false;

      try {
        const success = await cancelAction(actionId);
        if (success) {
          await refreshQueue();
        }
        return success;
      } catch (error) {
        console.error("Failed to cancel action:", error);
        return false;
      }
    },
    [refreshQueue]
  );

  // Retry a failed action
  const retryQueuedAction = useCallback(
    async (actionId: string): Promise<boolean> => {
      if (!isInitializedRef.current) return false;

      try {
        const success = await retryAction(actionId);
        if (success) {
          await refreshQueue();
        }
        return success;
      } catch (error) {
        console.error("Failed to retry action:", error);
        return false;
      }
    },
    [refreshQueue]
  );

  // Clear completed actions
  const clearCompletedActions = useCallback(async (): Promise<number> => {
    if (!isInitializedRef.current) return 0;

    try {
      const removedCount = await removeCompletedActions();
      if (removedCount > 0) {
        await refreshQueue();
      }
      return removedCount;
    } catch (error) {
      console.error("Failed to clear completed actions:", error);
      return 0;
    }
  }, [refreshQueue]);

  // Handle online/offline status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("Network connectivity restored");

      // Trigger immediate sync when back online
      if (autoSync && isInitializedRef.current) {
        setTimeout(() => syncQueue(), 1000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log("Network connectivity lost");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [autoSync, syncQueue]);

  // Set up automatic sync interval
  useEffect(() => {
    if (!autoSync || !isOnline || !isInitializedRef.current) return;

    syncIntervalRef.current = setInterval(() => {
      if (state.stats.pending > 0 && !state.isProcessing) {
        syncQueue();
      }
    }, QUEUE_CONFIG.SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSync, isOnline, state.stats.pending, state.isProcessing, syncQueue]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh queue data on initialization
  useEffect(() => {
    if (state.isInitialized) {
      refreshQueue();
    }
  }, [state.isInitialized, refreshQueue]);

  // Computed properties
  const hasPendingActions = state.stats.pending > 0;
  const hasFailedActions = state.stats.failed > 0;

  return {
    ...state,
    isOnline,
    hasPendingActions,
    hasFailedActions,
    addCheckIn,
    addCheckOut,
    addAction,
    syncQueue,
    refreshQueue,
    cancelQueuedAction,
    retryQueuedAction,
    clearCompletedActions,
  };
}

// Additional utility hook for queue status monitoring
export function useQueueStatus() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    cancelled: 0,
  });

  const refreshStats = useCallback(async () => {
    try {
      const newStats = await getQueueStats();
      setStats(newStats);
    } catch (error) {
      console.error("Failed to refresh queue stats:", error);
    }
  }, []);

  useEffect(() => {
    refreshStats();

    // Refresh stats every 10 seconds
    const interval = setInterval(refreshStats, 10000);
    return () => clearInterval(interval);
  }, [refreshStats]);

  return {
    stats,
    refreshStats,
    hasPending: stats.pending > 0,
    hasFailed: stats.failed > 0,
    hasActions: stats.total > 0,
  };
}

// Export constants for use in components
export { QUEUE_ACTIONS, QUEUE_STATUS, QUEUE_CONFIG };
