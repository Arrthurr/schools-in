// Enhanced offline queue hook with intelligent sync and connectivity restoration
// Integrates queue manager, network status, and sync management for comprehensive offline support

import { useState, useEffect, useCallback, useRef } from "react";
import { queueManager, type QueueManagerConfig } from "../offline/queueManager";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  useConnectivityRestoration,
  type ConnectivityRestorationConfig,
} from "./useConnectivityRestoration";
import type { QueuedAction } from "../offline/actionQueue";
import type { SyncResult } from "../offline/syncManager";

export interface EnhancedOfflineQueueState {
  // Queue statistics
  queueStats: {
    total: number;
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
    cancelled: number;
  };

  // Pending actions
  pendingActions: QueuedAction[];

  // Sync state
  isSyncing: boolean;
  lastSyncResult?: SyncResult;
  syncError?: string;

  // Network and restoration state
  isOnline: boolean;
  isUnstable: boolean;
  connectivityScore: number;
  isRestoring: boolean;

  // Sync recommendations
  syncRecommendations: {
    shouldSync: boolean;
    reason: string;
    recommendedDelay?: number;
  };
}

export interface EnhancedOfflineQueueActions {
  // Queue operations
  checkIn: (
    schoolId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ) => Promise<{
    success: boolean;
    actionId?: string;
    sessionId?: string;
    offline?: boolean;
  }>;

  checkOut: (
    sessionId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ) => Promise<{ success: boolean; actionId?: string; offline?: boolean }>;

  // Sync operations
  syncNow: (forceSync?: boolean) => Promise<SyncResult | null>;

  // Manual connectivity restoration
  triggerRestoration: (reason?: string) => Promise<SyncResult>;

  // Queue management
  getPendingActions: (userId?: string) => Promise<QueuedAction[]>;
  refreshStats: () => Promise<void>;

  // Configuration
  updateRestorationConfig: (
    config: Partial<ConnectivityRestorationConfig>
  ) => void;
}

export interface UseEnhancedOfflineQueueConfig {
  restorationConfig?: Partial<ConnectivityRestorationConfig>;
  autoRefreshInterval?: number;
  enableDebugLogs?: boolean;
}

export function useEnhancedOfflineQueue(
  config: UseEnhancedOfflineQueueConfig = {}
): {
  state: EnhancedOfflineQueueState;
  actions: EnhancedOfflineQueueActions;
} {
  const { autoRefreshInterval = 5000, enableDebugLogs = false } = config;

  // Network status and connectivity restoration
  const networkStatus = useNetworkStatus();
  const connectivityRestoration = useConnectivityRestoration(
    config.restorationConfig
  );

  // Local state
  const [queueStats, setQueueStats] = useState({
    total: 0,
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    cancelled: 0,
  });

  const [pendingActions, setPendingActions] = useState<QueuedAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult>();
  const [syncError, setSyncError] = useState<string>();
  const [syncRecommendations, setSyncRecommendations] = useState({
    shouldSync: false,
    reason: "No network status available",
  });

  // Refs for managing intervals
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const statsListenerRef = useRef<(() => void) | null>(null);

  // Update queue manager with current network status
  useEffect(() => {
    queueManager.updateNetworkStatus(networkStatus);

    // Update sync recommendations
    const recommendations = queueManager.getSyncRecommendations();
    setSyncRecommendations(recommendations);

    if (enableDebugLogs) {
      console.log("Network status updated:", networkStatus);
      console.log("Sync recommendations:", recommendations);
    }
  }, [networkStatus, enableDebugLogs]);

  // Setup stats listener
  useEffect(() => {
    if (statsListenerRef.current) {
      statsListenerRef.current();
    }

    statsListenerRef.current = queueManager.addStatsListener((stats) => {
      setQueueStats(stats);

      if (enableDebugLogs) {
        console.log("Queue stats updated:", stats);
      }
    });

    return () => {
      if (statsListenerRef.current) {
        statsListenerRef.current();
        statsListenerRef.current = null;
      }
    };
  }, [enableDebugLogs]);

  // Auto-refresh pending actions
  useEffect(() => {
    const refreshPendingActions = async () => {
      try {
        const actions = await queueManager.getPendingActions();
        setPendingActions(actions);
      } catch (error) {
        console.error("Failed to refresh pending actions:", error);
      }
    };

    // Initial refresh
    refreshPendingActions();

    // Setup interval
    if (autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(
        refreshPendingActions,
        autoRefreshInterval
      );
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefreshInterval]);

  // Update last sync result from queue manager
  useEffect(() => {
    const result = queueManager.getLastSyncResult();
    if (result) {
      setLastSyncResult(result);
    }
  }, [queueStats]); // Refresh when stats change (indicating sync activity)

  // Actions
  const checkIn = useCallback(
    async (
      schoolId: string,
      userId: string,
      location: { latitude: number; longitude: number; accuracy?: number }
    ) => {
      try {
        setSyncError(undefined);
        const result = await queueManager.checkIn(schoolId, userId, location);

        if (enableDebugLogs) {
          console.log("Check-in result:", result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Check-in failed";
        setSyncError(errorMessage);
        console.error("Check-in error:", error);
        return { success: false };
      }
    },
    [enableDebugLogs]
  );

  const checkOut = useCallback(
    async (
      sessionId: string,
      userId: string,
      location: { latitude: number; longitude: number; accuracy?: number }
    ) => {
      try {
        setSyncError(undefined);
        const result = await queueManager.checkOut(sessionId, userId, location);

        if (enableDebugLogs) {
          console.log("Check-out result:", result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Check-out failed";
        setSyncError(errorMessage);
        console.error("Check-out error:", error);
        return { success: false };
      }
    },
    [enableDebugLogs]
  );

  const syncNow = useCallback(
    async (forceSync = false): Promise<SyncResult | null> => {
      if (isSyncing && !forceSync) {
        return null;
      }

      try {
        setIsSyncing(true);
        setSyncError(undefined);

        const result = await queueManager.syncNow(forceSync);

        if (result) {
          const syncResult: SyncResult = {
            success: result.synced > 0 || result.processed === 0,
            processed: result.processed,
            synced: result.synced,
            failed: result.failed,
            skipped: 0,
            duration: 0,
            networkScore:
              result.networkScore || networkStatus.connectivityScore,
            strategy: result.strategy || "basic",
            errors: [],
          };

          setLastSyncResult(syncResult);

          if (enableDebugLogs) {
            console.log("Manual sync result:", syncResult);
          }

          return syncResult;
        }

        return null;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Sync failed";
        setSyncError(errorMessage);
        console.error("Sync error:", error);
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [isSyncing, networkStatus.connectivityScore, enableDebugLogs]
  );

  const triggerRestoration = useCallback(
    async (reason = "manual"): Promise<SyncResult> => {
      try {
        setSyncError(undefined);
        const result = await connectivityRestoration.triggerSync(reason);
        setLastSyncResult(result);

        if (enableDebugLogs) {
          console.log("Connectivity restoration result:", result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Restoration failed";
        setSyncError(errorMessage);
        console.error("Restoration error:", error);
        throw error;
      }
    },
    [connectivityRestoration, enableDebugLogs]
  );

  const getPendingActions = useCallback(
    async (userId?: string): Promise<QueuedAction[]> => {
      try {
        const actions = await queueManager.getPendingActions(userId);
        setPendingActions(actions);
        return actions;
      } catch (error) {
        console.error("Failed to get pending actions:", error);
        return [];
      }
    },
    []
  );

  const refreshStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await queueManager.getStats();
      setQueueStats(stats);
    } catch (error) {
      console.error("Failed to refresh stats:", error);
    }
  }, []);

  const updateRestorationConfig = useCallback(
    (newConfig: Partial<ConnectivityRestorationConfig>) => {
      connectivityRestoration.updateConfig(newConfig);
    },
    [connectivityRestoration]
  );

  // Compose final state
  const state: EnhancedOfflineQueueState = {
    queueStats,
    pendingActions,
    isSyncing: isSyncing || connectivityRestoration.isRestoring,
    lastSyncResult,
    syncError,
    isOnline: networkStatus.isOnline,
    isUnstable: networkStatus.isUnstable,
    connectivityScore: networkStatus.connectivityScore,
    isRestoring: connectivityRestoration.isRestoring,
    syncRecommendations,
  };

  const actions: EnhancedOfflineQueueActions = {
    checkIn,
    checkOut,
    syncNow,
    triggerRestoration,
    getPendingActions,
    refreshStats,
    updateRestorationConfig,
  };

  return { state, actions };
}
