// Connectivity restoration manager for intelligent sync orchestration
// Handles reconnection events and optimizes sync behavior

import { useEffect, useCallback, useRef, useState } from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { syncManager, type SyncResult } from "../offline/syncManager";
import { getQueueStats } from "../offline/actionQueue";

export interface ConnectivityRestorationConfig {
  enableAutoSync: boolean;
  enableGradualSync: boolean;
  stabilityWaitMs: number;
  maxSyncAttempts: number;
  syncRetryDelayMs: number;
  enableSyncNotifications: boolean;
  debugMode: boolean;
}

export interface Restoration {
  timestamp: number;
  triggerReason: string;
  networkScore: number;
  stabilityWaitTime: number;
  syncAttempts: number;
  syncResults: SyncResult[];
  totalDuration: number;
  success: boolean;
}

export interface UseConnectivityRestorationReturn {
  // Current state
  isRestoring: boolean;
  lastRestoration?: Restoration;
  restorationHistory: Restoration[];

  // Manual controls
  triggerSync: (reason?: string) => Promise<SyncResult>;
  cancelSync: () => void;

  // Configuration
  updateConfig: (config: Partial<ConnectivityRestorationConfig>) => void;

  // Statistics
  getRestorationStats: () => {
    totalRestorations: number;
    successRate: number;
    averageDuration: number;
    averageSyncAttempts: number;
  };
}

const DEFAULT_CONFIG: ConnectivityRestorationConfig = {
  enableAutoSync: true,
  enableGradualSync: true,
  stabilityWaitMs: 2000, // Wait 2 seconds for connection to stabilize
  maxSyncAttempts: 3,
  syncRetryDelayMs: 5000, // 5 seconds between retry attempts
  enableSyncNotifications: true,
  debugMode: false,
};

export function useConnectivityRestoration(
  initialConfig: Partial<ConnectivityRestorationConfig> = {}
): UseConnectivityRestorationReturn {
  const networkStatus = useNetworkStatus();
  const [config, setConfig] = useState<ConnectivityRestorationConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  const [isRestoring, setIsRestoring] = useState(false);
  const [restorationHistory, setRestorationHistory] = useState<Restoration[]>(
    []
  );
  const [lastRestoration, setLastRestoration] = useState<Restoration>();

  // Refs for managing async operations
  const stabilityTimeoutRef = useRef<NodeJS.Timeout>();
  const syncCancelRef = useRef<(() => void) | null>(null);
  const wasOfflineRef = useRef(false);
  const lastOnlineScoreRef = useRef(0);

  // Initialize offline state tracking
  useEffect(() => {
    wasOfflineRef.current = !networkStatus.isOnline;
    lastOnlineScoreRef.current = networkStatus.connectivityScore;
  }, []);

  // Main restoration orchestrator
  const executeRestoration = useCallback(
    async (triggerReason: string, forceSync = false): Promise<SyncResult> => {
      if (isRestoring && !forceSync) {
        if (config.debugMode) {
          console.log("Restoration already in progress, skipping");
        }
        throw new Error("Restoration already in progress");
      }

      setIsRestoring(true);
      const startTime = Date.now();
      const restoration: Restoration = {
        timestamp: startTime,
        triggerReason,
        networkScore: networkStatus.connectivityScore,
        stabilityWaitTime: 0,
        syncAttempts: 0,
        syncResults: [],
        totalDuration: 0,
        success: false,
      };

      try {
        if (config.debugMode) {
          console.log(`Starting connectivity restoration: ${triggerReason}`);
          console.log("Network status:", networkStatus);
        }

        // Step 1: Wait for connection stability if needed
        if (config.enableGradualSync && networkStatus.isUnstable) {
          if (config.debugMode) {
            console.log(
              `Waiting ${config.stabilityWaitMs}ms for connection stability`
            );
          }

          restoration.stabilityWaitTime = config.stabilityWaitMs;
          await new Promise((resolve) => {
            stabilityTimeoutRef.current = setTimeout(
              resolve,
              config.stabilityWaitMs
            );
          });
        }

        // Step 2: Check if we still should sync
        const recommendations =
          syncManager.getSyncRecommendations(networkStatus);

        if (!recommendations.shouldSync && !forceSync) {
          if (config.debugMode) {
            console.log(
              "Sync not recommended after stability wait:",
              recommendations.reason
            );
          }

          if (recommendations.recommendedDelay) {
            // Schedule retry
            setTimeout(() => {
              if (networkStatus.isOnline) {
                executeRestoration("delayed-retry").catch(console.error);
              }
            }, recommendations.recommendedDelay);
          }

          throw new Error(`Sync not recommended: ${recommendations.reason}`);
        }

        // Step 3: Execute sync with retries
        let lastSyncResult: SyncResult | null = null;
        let syncAttempts = 0;

        while (syncAttempts < config.maxSyncAttempts) {
          syncAttempts++;
          restoration.syncAttempts = syncAttempts;

          if (config.debugMode) {
            console.log(
              `Sync attempt ${syncAttempts}/${config.maxSyncAttempts}`
            );
          }

          try {
            const syncResult = await syncManager.sync(networkStatus, forceSync);
            restoration.syncResults.push(syncResult);
            lastSyncResult = syncResult;

            if (syncResult.success && syncResult.synced > 0) {
              restoration.success = true;

              if (config.debugMode) {
                console.log("Sync successful:", syncResult);
              }

              break; // Success - exit retry loop
            } else if (syncResult.success && syncResult.synced === 0) {
              // No actions to sync - still a success
              restoration.success = true;

              if (config.debugMode) {
                console.log("No actions to sync");
              }

              break;
            } else {
              // Sync failed but we might retry
              if (config.debugMode) {
                console.log("Sync failed:", syncResult);
              }

              if (syncAttempts < config.maxSyncAttempts) {
                // Wait before retry with exponential backoff
                const retryDelay =
                  config.syncRetryDelayMs * Math.pow(2, syncAttempts - 1);

                if (config.debugMode) {
                  console.log(`Waiting ${retryDelay}ms before retry`);
                }

                await new Promise((resolve) => setTimeout(resolve, retryDelay));

                // Check if we're still online before retrying
                if (!networkStatus.isOnline) {
                  throw new Error("Connection lost during retry wait");
                }
              }
            }
          } catch (syncError) {
            const errorMessage =
              syncError instanceof Error
                ? syncError.message
                : "Unknown sync error";

            if (config.debugMode) {
              console.error(`Sync attempt ${syncAttempts} failed:`, syncError);
            }

            // Create error result
            const errorResult: SyncResult = {
              success: false,
              processed: 0,
              synced: 0,
              failed: 1,
              skipped: 0,
              duration: 1000,
              networkScore: networkStatus.connectivityScore,
              strategy: "error",
              errors: [
                {
                  actionId: "unknown",
                  error: errorMessage,
                  willRetry: syncAttempts < config.maxSyncAttempts,
                },
              ],
            };

            restoration.syncResults.push(errorResult);
            lastSyncResult = errorResult;

            if (syncAttempts < config.maxSyncAttempts) {
              // Wait before retry
              await new Promise((resolve) =>
                setTimeout(resolve, config.syncRetryDelayMs)
              );
            }
          }
        }

        // Step 4: Finalize restoration
        restoration.totalDuration = Date.now() - startTime;

        if (config.debugMode) {
          console.log("Restoration completed:", restoration);
        }

        // Update history
        setLastRestoration(restoration);
        setRestorationHistory((prev) => {
          const updated = [...prev, restoration];
          // Keep only last 50 restorations
          return updated.slice(-50);
        });

        // Show notification if enabled
        if (config.enableSyncNotifications && restoration.success) {
          showSyncNotification(restoration);
        }

        return (
          lastSyncResult ||
          restoration.syncResults[restoration.syncResults.length - 1]
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown restoration error";

        if (config.debugMode) {
          console.error("Restoration failed:", error);
        }

        restoration.totalDuration = Date.now() - startTime;
        restoration.success = false;

        setLastRestoration(restoration);
        setRestorationHistory((prev) => [...prev, restoration].slice(-50));

        throw error;
      } finally {
        setIsRestoring(false);

        // Cleanup
        if (stabilityTimeoutRef.current) {
          clearTimeout(stabilityTimeoutRef.current);
          stabilityTimeoutRef.current = undefined;
        }
        syncCancelRef.current = null;
      }
    },
    [config, networkStatus, isRestoring]
  );

  // Manual sync trigger
  const triggerSync = useCallback(
    async (reason = "manual"): Promise<SyncResult> => {
      return executeRestoration(reason, true);
    },
    [executeRestoration]
  );

  // Cancel ongoing sync
  const cancelSync = useCallback(() => {
    if (syncCancelRef.current) {
      syncCancelRef.current();
    }

    if (stabilityTimeoutRef.current) {
      clearTimeout(stabilityTimeoutRef.current);
      stabilityTimeoutRef.current = undefined;
    }

    setIsRestoring(false);
  }, []);

  // Update configuration
  const updateConfig = useCallback(
    (newConfig: Partial<ConnectivityRestorationConfig>) => {
      setConfig((prev) => ({ ...prev, ...newConfig }));
    },
    []
  );

  // Get restoration statistics
  const getRestorationStats = useCallback(() => {
    if (restorationHistory.length === 0) {
      return {
        totalRestorations: 0,
        successRate: 0,
        averageDuration: 0,
        averageSyncAttempts: 0,
      };
    }

    const totalRestorations = restorationHistory.length;
    const successfulRestorations = restorationHistory.filter(
      (r) => r.success
    ).length;
    const successRate = (successfulRestorations / totalRestorations) * 100;

    const averageDuration =
      restorationHistory.reduce((sum, r) => sum + r.totalDuration, 0) /
      totalRestorations;
    const averageSyncAttempts =
      restorationHistory.reduce((sum, r) => sum + r.syncAttempts, 0) /
      totalRestorations;

    return {
      totalRestorations,
      successRate,
      averageDuration,
      averageSyncAttempts,
    };
  }, [restorationHistory]);

  // Listen for network status changes
  useEffect(() => {
    const previousOffline = wasOfflineRef.current;
    const currentOnline = networkStatus.isOnline;
    const currentScore = networkStatus.connectivityScore;
    const previousScore = lastOnlineScoreRef.current;

    // Update refs
    wasOfflineRef.current = !currentOnline;
    lastOnlineScoreRef.current = currentScore;

    // Trigger restoration on reconnection
    if (config.enableAutoSync && previousOffline && currentOnline) {
      if (config.debugMode) {
        console.log("Network reconnection detected, triggering restoration");
      }

      executeRestoration("reconnection").catch((error) => {
        console.error("Auto-restoration failed after reconnection:", error);
      });
    }

    // Trigger restoration on significant quality improvement
    else if (
      config.enableAutoSync &&
      currentOnline &&
      currentScore > previousScore + 30
    ) {
      if (config.debugMode) {
        console.log("Significant network quality improvement detected");
      }

      executeRestoration("quality-improvement").catch((error) => {
        console.error(
          "Auto-restoration failed after quality improvement:",
          error
        );
      });
    }
  }, [
    networkStatus.isOnline,
    networkStatus.connectivityScore,
    config.enableAutoSync,
    config.debugMode,
    executeRestoration,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelSync();
    };
  }, [cancelSync]);

  return {
    isRestoring,
    lastRestoration,
    restorationHistory,
    triggerSync,
    cancelSync,
    updateConfig,
    getRestorationStats,
  };
}

// Helper function to show sync notifications
function showSyncNotification(restoration: Restoration): void {
  if ("Notification" in window && Notification.permission === "granted") {
    const totalSynced = restoration.syncResults.reduce(
      (sum, result) => sum + result.synced,
      0
    );

    if (totalSynced > 0) {
      new Notification("Sync Completed", {
        body: `Successfully synced ${totalSynced} pending actions`,
        icon: "/icons/sync-icon.png",
        tag: "sync-completion",
      });
    }
  }
}

// Export hook for use in components - no JSX wrapper needed
export { useConnectivityRestoration as default };
