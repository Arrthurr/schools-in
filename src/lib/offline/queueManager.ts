// Queue manager integrating with service manager for offline support
// Automatically queues actions when offline and syncs when online using intelligent sync strategies

import {
  initActionQueue,
  queueCheckIn,
  queueCheckOut,
  processQueue,
  getPendingActions,
  getQueueStats,
  removeCompletedActions,
  QUEUE_CONFIG,
  type QueuedAction,
} from "./actionQueue";
import { syncManager, type SyncResult } from "./syncManager";
import {
  useNetworkStatus,
  type NetworkStatus,
} from "../hooks/useNetworkStatus";
import {
  useConnectivityRestoration,
  type ConnectivityRestorationConfig,
} from "../hooks/useConnectivityRestoration";
import { useEffect, useCallback } from "react";

export interface QueueManagerConfig {
  enableAutoSync: boolean;
  syncInterval: number;
  enableBackgroundSync: boolean;
  maxRetryAttempts: number;
  debugMode: boolean;
  enableIntelligentSync: boolean;
  connectivityRestoration?: Partial<ConnectivityRestorationConfig>;
}

class QueueManager {
  private config: QueueManagerConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isProcessing = false;
  private listeners: Set<(stats: any) => void> = new Set();
  private networkStatus: NetworkStatus | null = null;
  private lastSyncResult: SyncResult | null = null;

  constructor(config: Partial<QueueManagerConfig> = {}) {
    this.config = {
      enableAutoSync: true,
      syncInterval: QUEUE_CONFIG.SYNC_INTERVAL,
      enableBackgroundSync: true,
      maxRetryAttempts: QUEUE_CONFIG.MAX_RETRY_ATTEMPTS,
      debugMode: false,
      enableIntelligentSync: true,
      connectivityRestoration: {
        enableAutoSync: true,
        enableGradualSync: true,
        stabilityWaitMs: 2000,
        maxSyncAttempts: 3,
        syncRetryDelayMs: 5000,
        enableSyncNotifications: true,
        debugMode: false,
      },
      ...config,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await initActionQueue();
      this.isInitialized = true;

      if (this.config.enableAutoSync) {
        this.startAutoSync();
      }

      if (this.config.enableBackgroundSync) {
        this.setupBackgroundSync();
      }

      this.setupNetworkListeners();

      if (this.config.debugMode) {
        console.log("QueueManager initialized with config:", this.config);
      }
    } catch (error) {
      console.error("Failed to initialize QueueManager:", error);
    }
  }

  // Check-in with offline support
  async checkIn(
    schoolId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<{
    success: boolean;
    actionId?: string;
    sessionId?: string;
    offline?: boolean;
  }> {
    if (!this.isInitialized) {
      throw new Error("QueueManager not initialized");
    }

    try {
      if (navigator.onLine) {
        // Try direct API call first when online
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolId,
            userId,
            location: {
              ...location,
              timestamp: Date.now(),
            },
            action: "check_in",
            timestamp: Date.now(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (this.config.debugMode) {
            console.log("Check-in completed online:", result);
          }
          return {
            success: true,
            sessionId: result.sessionId,
            offline: false,
          };
        } else {
          // API failed, fall back to offline queue
          if (this.config.debugMode) {
            console.log("API call failed, falling back to offline queue");
          }
        }
      }

      // Queue the action for offline processing
      const actionId = await queueCheckIn(schoolId, userId, location);

      if (this.config.debugMode) {
        console.log("Check-in queued for offline processing:", actionId);
      }

      // Notify listeners
      this.notifyListeners();

      return {
        success: true,
        actionId,
        offline: true,
      };
    } catch (error) {
      console.error("Failed to process check-in:", error);
      return { success: false };
    }
  }

  // Check-out with offline support
  async checkOut(
    sessionId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<{ success: boolean; actionId?: string; offline?: boolean }> {
    if (!this.isInitialized) {
      throw new Error("QueueManager not initialized");
    }

    try {
      if (navigator.onLine) {
        // Try direct API call first when online
        const response = await fetch("/api/sessions", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            userId,
            location: {
              ...location,
              timestamp: Date.now(),
            },
            action: "check_out",
            timestamp: Date.now(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (this.config.debugMode) {
            console.log("Check-out completed online:", result);
          }
          return {
            success: true,
            offline: false,
          };
        } else {
          // API failed, fall back to offline queue
          if (this.config.debugMode) {
            console.log("API call failed, falling back to offline queue");
          }
        }
      }

      // Queue the action for offline processing
      const actionId = await queueCheckOut(sessionId, userId, location);

      if (this.config.debugMode) {
        console.log("Check-out queued for offline processing:", actionId);
      }

      // Notify listeners
      this.notifyListeners();

      return {
        success: true,
        actionId,
        offline: true,
      };
    } catch (error) {
      console.error("Failed to process check-out:", error);
      return { success: false };
    }
  }

  // Get pending actions
  async getPendingActions(userId?: string): Promise<QueuedAction[]> {
    if (!this.isInitialized) {
      return [];
    }

    try {
      return await getPendingActions(userId);
    } catch (error) {
      console.error("Failed to get pending actions:", error);
      return [];
    }
  }

  // Get queue statistics
  async getStats(): Promise<any> {
    if (!this.isInitialized) {
      return {
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      };
    }

    try {
      return await getQueueStats();
    } catch (error) {
      console.error("Failed to get queue stats:", error);
      return {
        total: 0,
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
        cancelled: 0,
      };
    }
  }

  // Manual sync trigger with intelligent sync strategy
  async syncNow(forceSync = false): Promise<{
    processed: number;
    synced: number;
    failed: number;
    strategy?: string;
    networkScore?: number;
  } | null> {
    if (!this.isInitialized) {
      return null;
    }

    if (this.isProcessing && !forceSync) {
      if (this.config.debugMode) {
        console.log("Sync already in progress, skipping");
      }
      return null;
    }

    try {
      this.isProcessing = true;

      // Use intelligent sync if enabled and network status available
      if (this.config.enableIntelligentSync && this.networkStatus) {
        if (this.config.debugMode) {
          console.log("Using intelligent sync strategy");
        }

        const syncResult = await syncManager.sync(
          this.networkStatus,
          forceSync
        );
        this.lastSyncResult = syncResult;

        if (this.config.debugMode) {
          console.log("Intelligent sync completed:", syncResult);
        }

        // Notify listeners
        this.notifyListeners();

        return {
          processed: syncResult.processed,
          synced: syncResult.synced,
          failed: syncResult.failed,
          strategy: syncResult.strategy,
          networkScore: syncResult.networkScore,
        };
      } else {
        // Fall back to basic sync
        if (!navigator.onLine && !forceSync) {
          if (this.config.debugMode) {
            console.log("Device offline, skipping sync");
          }
          return null;
        }

        const result = await processQueue();

        if (this.config.debugMode) {
          console.log("Basic sync completed:", result);
        }

        // Notify listeners
        this.notifyListeners();

        return result;
      }
    } catch (error) {
      console.error("Failed to sync queue:", error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  // Add stats listener
  addStatsListener(callback: (stats: any) => void): () => void {
    this.listeners.add(callback);

    // Send current stats immediately
    this.getStats().then((stats) => callback(stats));

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  // Update network status for intelligent sync
  updateNetworkStatus(networkStatus: NetworkStatus): void {
    this.networkStatus = networkStatus;

    if (this.config.debugMode) {
      console.log("Network status updated:", networkStatus);
    }

    // Trigger sync if conditions are favorable
    if (
      this.config.enableIntelligentSync &&
      networkStatus.isOnline &&
      !this.isProcessing
    ) {
      const recommendations = syncManager.getSyncRecommendations(networkStatus);

      if (recommendations.shouldSync) {
        this.syncNow().catch((error) => {
          console.error("Auto-sync after network update failed:", error);
        });
      }
    }
  }

  // Get last sync result
  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  // Get sync recommendations based on current network status
  getSyncRecommendations(): {
    shouldSync: boolean;
    reason: string;
    recommendedDelay?: number;
  } {
    if (!this.networkStatus) {
      return { shouldSync: false, reason: "No network status available" };
    }

    return syncManager.getSyncRecommendations(this.networkStatus);
  }

  // Start automatic sync with intelligent strategies
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (!this.isProcessing) {
        const stats = await this.getStats();
        if (stats.pending > 0) {
          // Use intelligent sync if enabled and network status available
          if (this.config.enableIntelligentSync && this.networkStatus) {
            const recommendations = syncManager.getSyncRecommendations(
              this.networkStatus
            );

            if (recommendations.shouldSync) {
              await this.syncNow();
            } else if (this.config.debugMode) {
              console.log("Auto-sync skipped:", recommendations.reason);
            }
          } else if (navigator.onLine) {
            // Fall back to basic sync when online
            await this.syncNow();
          }
        }
      }
    }, this.config.syncInterval);

    if (this.config.debugMode) {
      console.log(
        `Auto-sync started with interval: ${this.config.syncInterval}ms`
      );
    }
  }

  // Setup background sync for when connectivity returns
  private setupBackgroundSync(): void {
    // Clean up old actions periodically
    setInterval(async () => {
      if (this.isInitialized) {
        try {
          const removedCount = await removeCompletedActions();
          if (removedCount > 0 && this.config.debugMode) {
            console.log(
              `Background cleanup removed ${removedCount} completed actions`
            );
          }
        } catch (error) {
          console.error("Background cleanup failed:", error);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Setup network connectivity listeners - now uses basic detection since intelligent sync is handled elsewhere
  private setupNetworkListeners(): void {
    const handleOnline = async () => {
      if (this.config.debugMode) {
        console.log("Network connectivity restored");
      }

      // Note: Intelligent sync handling is done via useConnectivityRestoration hook
      // This is just for basic fallback when not using intelligent sync
      if (!this.config.enableIntelligentSync) {
        // Wait a moment for network to stabilize
        setTimeout(async () => {
          await this.syncNow();
        }, 1000);
      }
    };

    const handleOffline = () => {
      if (this.config.debugMode) {
        console.log("Network connectivity lost, switching to offline mode");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  // Notify all listeners of stats changes
  private async notifyListeners(): Promise<void> {
    if (this.listeners.size > 0) {
      try {
        const stats = await this.getStats();
        this.listeners.forEach((callback) => {
          try {
            callback(stats);
          } catch (error) {
            console.error("Error in stats listener:", error);
          }
        });
      } catch (error) {
        console.error("Failed to notify listeners:", error);
      }
    }
  }

  // Check if queue has pending actions
  async hasPendingActions(): Promise<boolean> {
    const stats = await this.getStats();
    return stats.pending > 0;
  }

  // Check if queue has failed actions
  async hasFailedActions(): Promise<boolean> {
    const stats = await this.getStats();
    return stats.failed > 0;
  }

  // Get offline status
  isOffline(): boolean {
    return !navigator.onLine;
  }

  // Cleanup
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.listeners.clear();
    this.isInitialized = false;

    if (this.config.debugMode) {
      console.log("QueueManager destroyed");
    }
  }
}

// Export singleton instance with intelligent sync enabled
export const queueManager = new QueueManager({
  enableAutoSync: true,
  enableBackgroundSync: true,
  enableIntelligentSync: true,
  debugMode: process.env.NODE_ENV === "development",
});

export default QueueManager;
