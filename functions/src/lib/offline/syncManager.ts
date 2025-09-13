// Enhanced sync manager for intelligent queue synchronization
// Optimizes sync behavior based on network conditions and queue priority

import {
  processQueue,
  getPendingActions,
  getQueueStats,
  updateActionStatus,
  removeCompletedActions,
  QUEUE_STATUS,
  QUEUE_CONFIG,
  type QueuedAction,
} from "./actionQueue";
import {
  useNetworkStatus,
  type NetworkStatus,
} from "../hooks/useNetworkStatus";

export interface SyncManagerConfig {
  enableAdaptiveSync: boolean;
  enablePrioritySync: boolean;
  enableBatchOptimization: boolean;
  enableRetryOptimization: boolean;
  maxConcurrentSyncs: number;
  syncTimeoutMs: number;
  priorityThresholdMs: number; // Actions older than this get priority
  debugMode: boolean;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  synced: number;
  failed: number;
  skipped: number;
  duration: number;
  networkScore: number;
  strategy: string;
  errors: Array<{
    actionId: string;
    error: string;
    willRetry: boolean;
  }>;
}

export interface SyncStrategy {
  name: string;
  batchSize: number;
  concurrency: number;
  timeout: number;
  shouldSync: boolean;
  priority: "low" | "medium" | "high" | "critical";
}

// Priority levels for different action types
const ACTION_PRIORITIES = {
  CHECK_IN: "high",
  CHECK_OUT: "critical",
  SESSION_UPDATE: "medium",
  LOCATION_UPDATE: "low",
} as const;

class SyncManager {
  private config: SyncManagerConfig;
  private isSyncing = false;
  private syncHistory: Array<{
    timestamp: number;
    result: SyncResult;
  }> = [];
  private lastNetworkStatus?: NetworkStatus;

  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = {
      enableAdaptiveSync: true,
      enablePrioritySync: true,
      enableBatchOptimization: true,
      enableRetryOptimization: true,
      maxConcurrentSyncs: 3,
      syncTimeoutMs: 30000,
      priorityThresholdMs: 5 * 60 * 1000, // 5 minutes
      debugMode: false,
      ...config,
    };
  }

  // Main sync function with intelligent behavior
  async sync(
    networkStatus: NetworkStatus,
    forceSync = false
  ): Promise<SyncResult> {
    if (this.isSyncing && !forceSync) {
      if (this.config.debugMode) {
        console.log("Sync already in progress, skipping");
      }
      return this.createSkippedResult("Already syncing");
    }

    this.isSyncing = true;
    this.lastNetworkStatus = networkStatus;
    const startTime = Date.now();

    try {
      // Get sync strategy based on network conditions
      const strategy = this.determineSyncStrategy(networkStatus);

      if (!strategy.shouldSync && !forceSync) {
        if (this.config.debugMode) {
          console.log("Sync skipped due to poor network conditions");
        }
        return this.createSkippedResult("Poor network conditions");
      }

      if (this.config.debugMode) {
        console.log(`Starting sync with strategy: ${strategy.name}`, strategy);
      }

      // Get pending actions
      const pendingActions = await getPendingActions();

      if (pendingActions.length === 0) {
        return this.createSuccessResult(
          0,
          0,
          0,
          0,
          Date.now() - startTime,
          networkStatus.connectivityScore,
          strategy.name
        );
      }

      // Apply prioritization if enabled
      const prioritizedActions = this.config.enablePrioritySync
        ? this.prioritizeActions(pendingActions)
        : pendingActions;

      // Execute sync with selected strategy
      const result = await this.executeSyncStrategy(
        prioritizedActions,
        strategy,
        networkStatus
      );

      // Record sync history
      this.recordSyncResult(result);

      // Cleanup completed actions
      await removeCompletedActions();

      if (this.config.debugMode) {
        console.log("Sync completed:", result);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown sync error";
      console.error("Sync failed:", error);

      const failureResult = this.createFailureResult(
        errorMessage,
        Date.now() - startTime,
        networkStatus.connectivityScore
      );
      this.recordSyncResult(failureResult);

      return failureResult;
    } finally {
      this.isSyncing = false;
    }
  }

  // Determine optimal sync strategy based on network conditions
  private determineSyncStrategy(networkStatus: NetworkStatus): SyncStrategy {
    const { connectivityScore, effectiveType, downlink, rtt, saveData } =
      networkStatus;

    // Critical network conditions - no sync
    if (!networkStatus.isConnected || connectivityScore < 20) {
      return {
        name: "no-sync",
        batchSize: 0,
        concurrency: 0,
        timeout: 0,
        shouldSync: false,
        priority: "low",
      };
    }

    // High quality network - aggressive sync
    if (connectivityScore >= 80 && downlink >= 5 && rtt <= 50) {
      return {
        name: "aggressive",
        batchSize: QUEUE_CONFIG.BATCH_SIZE * 2,
        concurrency: this.config.maxConcurrentSyncs,
        timeout: this.config.syncTimeoutMs,
        shouldSync: true,
        priority: "high",
      };
    }

    // Good network - normal sync
    if (connectivityScore >= 60 && downlink >= 2 && rtt <= 100) {
      return {
        name: "normal",
        batchSize: QUEUE_CONFIG.BATCH_SIZE,
        concurrency: Math.max(2, this.config.maxConcurrentSyncs - 1),
        timeout: this.config.syncTimeoutMs,
        shouldSync: true,
        priority: "medium",
      };
    }

    // Medium network - conservative sync
    if (connectivityScore >= 40) {
      return {
        name: "conservative",
        batchSize: Math.max(3, Math.floor(QUEUE_CONFIG.BATCH_SIZE / 2)),
        concurrency: 1,
        timeout: this.config.syncTimeoutMs * 1.5,
        shouldSync: true,
        priority: "medium",
      };
    }

    // Poor network - minimal sync (critical actions only)
    if (connectivityScore >= 20 || saveData) {
      return {
        name: "minimal",
        batchSize: 2,
        concurrency: 1,
        timeout: this.config.syncTimeoutMs * 2,
        shouldSync: true,
        priority: "critical",
      };
    }

    // Fallback - no sync
    return {
      name: "fallback-no-sync",
      batchSize: 0,
      concurrency: 0,
      timeout: 0,
      shouldSync: false,
      priority: "low",
    };
  }

  // Prioritize actions based on type, age, and retry count
  private prioritizeActions(actions: QueuedAction[]): QueuedAction[] {
    const now = Date.now();

    return actions.sort((a, b) => {
      // Priority by action type
      const aPriority =
        ACTION_PRIORITIES[a.type as keyof typeof ACTION_PRIORITIES] || "low";
      const bPriority =
        ACTION_PRIORITIES[b.type as keyof typeof ACTION_PRIORITIES] || "low";

      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[bPriority as keyof typeof priorityOrder] -
        priorityOrder[aPriority as keyof typeof priorityOrder];

      if (priorityDiff !== 0) return priorityDiff;

      // Priority by age (older actions first)
      const ageA = now - a.timestamp;
      const ageB = now - b.timestamp;

      // Critical threshold - very old actions get highest priority
      const aIsCriticalAge = ageA > this.config.priorityThresholdMs;
      const bIsCriticalAge = ageB > this.config.priorityThresholdMs;

      if (aIsCriticalAge && !bIsCriticalAge) return -1;
      if (bIsCriticalAge && !aIsCriticalAge) return 1;

      // Priority by retry count (fewer retries first for fresh attempts)
      const retryDiff = a.retryCount - b.retryCount;
      if (retryDiff !== 0) return retryDiff;

      // Finally, sort by timestamp (FIFO)
      return a.timestamp - b.timestamp;
    });
  }

  // Execute sync with the determined strategy
  private async executeSyncStrategy(
    actions: QueuedAction[],
    strategy: SyncStrategy,
    networkStatus: NetworkStatus
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let synced = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{
      actionId: string;
      error: string;
      willRetry: boolean;
    }> = [];

    // Filter actions by priority if needed
    let actionsToSync = actions;
    if (strategy.priority === "critical") {
      actionsToSync = actions.filter((action) => {
        const actionPriority =
          ACTION_PRIORITIES[action.type as keyof typeof ACTION_PRIORITIES];
        return actionPriority === "critical" || actionPriority === "high";
      });
    }

    // Batch processing with concurrency control
    const batches = this.chunkArray(actionsToSync, strategy.batchSize);

    for (const batch of batches) {
      // Process batch with concurrency limit
      const batchPromises = batch
        .slice(0, strategy.concurrency)
        .map(async (action) => {
          try {
            processed++;

            // Update action status to syncing
            await updateActionStatus(action.id, QUEUE_STATUS.SYNCING);

            // Create timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error("Sync timeout")),
                strategy.timeout
              );
            });

            // Race between actual sync and timeout
            const syncPromise = this.syncSingleAction(action);
            const success = await Promise.race([syncPromise, timeoutPromise]);

            if (success) {
              synced++;
              await updateActionStatus(action.id, QUEUE_STATUS.SYNCED);
            } else {
              throw new Error("Sync failed");
            }
          } catch (error) {
            failed++;
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            const willRetry = action.retryCount < action.maxRetries;

            errors.push({
              actionId: action.id,
              error: errorMessage,
              willRetry,
            });

            if (willRetry) {
              // Update retry count and set back to pending
              await updateActionStatus(action.id, QUEUE_STATUS.PENDING);
            } else {
              // Mark as permanently failed
              await updateActionStatus(action.id, QUEUE_STATUS.FAILED);
            }
          }
        });

      // Wait for batch completion
      await Promise.allSettled(batchPromises);

      // Add delay between batches for poor connections
      if (batches.length > 1 && networkStatus.connectivityScore < 50) {
        await this.delay(1000 * (batches.length - 1)); // Progressive delay
      }
    }

    // Count skipped actions
    skipped = actions.length - actionsToSync.length;

    const duration = Date.now() - startTime;
    return this.createSuccessResult(
      processed,
      synced,
      failed,
      skipped,
      duration,
      networkStatus.connectivityScore,
      strategy.name,
      errors
    );
  }

  // Sync a single action (placeholder - actual implementation would call the real sync functions)
  private async syncSingleAction(action: QueuedAction): Promise<boolean> {
    // This would call the actual sync functions from actionQueue.ts
    // For now, we'll simulate the sync
    try {
      const response = await processQueue(); // This processes the entire queue, but we can optimize later
      return response.synced > 0;
    } catch (error) {
      return false;
    }
  }

  // Get sync recommendations based on current conditions
  getSyncRecommendations(networkStatus: NetworkStatus): {
    shouldSync: boolean;
    strategy: string;
    reason: string;
    estimatedDuration: number;
    recommendedDelay?: number;
  } {
    const strategy = this.determineSyncStrategy(networkStatus);
    const pendingCount = this.getLastKnownPendingCount();

    const estimatedDuration = this.estimateSyncDuration(pendingCount, strategy);

    if (!strategy.shouldSync) {
      const recommendedDelay = this.calculateOptimalRetryDelay(networkStatus);
      return {
        shouldSync: false,
        strategy: strategy.name,
        reason: `Network conditions not suitable (score: ${networkStatus.connectivityScore})`,
        estimatedDuration: 0,
        recommendedDelay,
      };
    }

    return {
      shouldSync: true,
      strategy: strategy.name,
      reason: `Good conditions for ${strategy.name} sync (score: ${networkStatus.connectivityScore})`,
      estimatedDuration,
    };
  }

  // Get sync history and statistics
  getSyncHistory(): Array<{ timestamp: number; result: SyncResult }> {
    return [...this.syncHistory].sort((a, b) => b.timestamp - a.timestamp);
  }

  getSyncStatistics(): {
    totalSyncs: number;
    successRate: number;
    averageDuration: number;
    averageNetworkScore: number;
    strategyCounts: Record<string, number>;
  } {
    if (this.syncHistory.length === 0) {
      return {
        totalSyncs: 0,
        successRate: 0,
        averageDuration: 0,
        averageNetworkScore: 0,
        strategyCounts: {},
      };
    }

    const totalSyncs = this.syncHistory.length;
    const successfulSyncs = this.syncHistory.filter(
      (entry) => entry.result.success
    ).length;
    const successRate = (successfulSyncs / totalSyncs) * 100;

    const averageDuration =
      this.syncHistory.reduce((sum, entry) => sum + entry.result.duration, 0) /
      totalSyncs;
    const averageNetworkScore =
      this.syncHistory.reduce(
        (sum, entry) => sum + entry.result.networkScore,
        0
      ) / totalSyncs;

    const strategyCounts: Record<string, number> = {};
    this.syncHistory.forEach((entry) => {
      strategyCounts[entry.result.strategy] =
        (strategyCounts[entry.result.strategy] || 0) + 1;
    });

    return {
      totalSyncs,
      successRate,
      averageDuration,
      averageNetworkScore,
      strategyCounts,
    };
  }

  // Helper methods
  private recordSyncResult(result: SyncResult): void {
    this.syncHistory.push({
      timestamp: Date.now(),
      result,
    });

    // Keep only last 100 sync results
    if (this.syncHistory.length > 100) {
      this.syncHistory = this.syncHistory.slice(-100);
    }
  }

  private getLastKnownPendingCount(): number {
    // This would typically come from the queue stats
    // For now, return a reasonable estimate
    return 5; // Placeholder
  }

  private estimateSyncDuration(
    actionCount: number,
    strategy: SyncStrategy
  ): number {
    if (actionCount === 0) return 0;

    const baseTimePerAction = 1000; // 1 second per action
    const networkMultiplier = this.lastNetworkStatus?.connectivityScore
      ? 100 / this.lastNetworkStatus.connectivityScore
      : 2;

    const estimatedTime =
      (actionCount * baseTimePerAction * networkMultiplier) /
      strategy.concurrency;
    return Math.max(1000, Math.min(60000, estimatedTime)); // Between 1s and 60s
  }

  private calculateOptimalRetryDelay(networkStatus: NetworkStatus): number {
    const baseDelay = 30000; // 30 seconds
    const scoreMultiplier = (100 - networkStatus.connectivityScore) / 100;
    return baseDelay * (1 + scoreMultiplier * 2); // 30s to 90s based on connection quality
  }

  private createSuccessResult(
    processed: number,
    synced: number,
    failed: number,
    skipped: number,
    duration: number,
    networkScore: number,
    strategy: string,
    errors: Array<{ actionId: string; error: string; willRetry: boolean }> = []
  ): SyncResult {
    return {
      success: failed === 0 || synced > 0,
      processed,
      synced,
      failed,
      skipped,
      duration,
      networkScore,
      strategy,
      errors,
    };
  }

  private createFailureResult(
    error: string,
    duration: number,
    networkScore: number
  ): SyncResult {
    return {
      success: false,
      processed: 0,
      synced: 0,
      failed: 1,
      skipped: 0,
      duration,
      networkScore,
      strategy: "failed",
      errors: [{ actionId: "unknown", error, willRetry: false }],
    };
  }

  private createSkippedResult(reason: string): SyncResult {
    return {
      success: true,
      processed: 0,
      synced: 0,
      failed: 0,
      skipped: 1,
      duration: 0,
      networkScore: this.lastNetworkStatus?.connectivityScore || 0,
      strategy: "skipped",
      errors: [],
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const syncManager = new SyncManager({
  enableAdaptiveSync: true,
  enablePrioritySync: true,
  enableBatchOptimization: true,
  enableRetryOptimization: true,
  debugMode: process.env.NODE_ENV === "development",
});

export default SyncManager;
