// Enhanced service manager with offline queue integration
// Automatically handles online/offline scenarios for check-in/out operations

import { queueManager } from "@/lib/offline/queueManager";
import {
  createDocument,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { getDayKey } from "@/lib/utils/time";

export interface CheckInResult {
  success: boolean;
  sessionId?: string;
  actionId?: string;
  offline?: boolean;
  message?: string;
}

export interface CheckOutResult {
  success: boolean;
  actionId?: string;
  offline?: boolean;
  message?: string;
}

export interface ServiceManagerConfig {
  enableOfflineSupport: boolean;
  autoRetry: boolean;
  debugMode: boolean;
}

class ServiceManager {
  private config: ServiceManagerConfig;

  constructor(config: Partial<ServiceManagerConfig> = {}) {
    this.config = {
      enableOfflineSupport: true,
      autoRetry: true,
      debugMode: process.env.NODE_ENV === "development",
      ...config,
    };
  }

  // Enhanced check-in with offline support
  async checkIn(
    schoolId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number },
    distanceFromCenter?: number
  ): Promise<CheckInResult> {
    try {
      if (this.config.debugMode) {
        console.log("ServiceManager.checkIn:", { schoolId, userId, location });
      }

      if (this.config.enableOfflineSupport) {
        // Use queue manager for offline support
        const result = await queueManager.checkIn(schoolId, userId, location, distanceFromCenter);

        return {
          success: result.success,
          sessionId: result.sessionId,
          actionId: result.actionId,
          offline: result.offline,
          message: result.offline
            ? "Check-in queued for sync when online"
            : "Check-in completed successfully",
        };
      } else {
        // Direct API call without offline support
        return await this.directCheckIn(schoolId, userId, location, distanceFromCenter);
      }
    } catch (error) {
      console.error("ServiceManager.checkIn failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Check-in failed",
      };
    }
  }

  // Enhanced check-out with offline support
  async checkOut(
    sessionId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<CheckOutResult> {
    try {
      if (this.config.debugMode) {
        console.log("ServiceManager.checkOut:", {
          sessionId,
          userId,
          location,
        });
      }

      if (this.config.enableOfflineSupport) {
        // Use queue manager for offline support
        const result = await queueManager.checkOut(sessionId, userId, location);

        return {
          success: result.success,
          actionId: result.actionId,
          offline: result.offline,
          message: result.offline
            ? "Check-out queued for sync when online"
            : "Check-out completed successfully",
        };
      } else {
        // Direct API call without offline support
        return await this.directCheckOut(sessionId, userId, location);
      }
    } catch (error) {
      console.error("ServiceManager.checkOut failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Check-out failed",
      };
    }
  }

  // Direct check-in using Firebase SDK (no offline support)
  private async directCheckIn(
    schoolId: string,
    userId: string,
    location: { latitude: number; longitude: number; accuracy?: number },
    distanceFromCenter?: number
  ): Promise<CheckInResult> {
    try {
      const now = Timestamp.now();
      const dayKey = getDayKey(now);

      // Use actual geofence distance if provided, fall back to accuracy
      const distance = distanceFromCenter ?? location.accuracy ?? 0;

      const sessionData = {
        userId,
        locationId: schoolId,
        startTime: now,
        checkInTime: now, // Legacy field
        status: "active" as const,
        checkInMethod: "geo" as const,
        distanceFromCenterAtCheckIn: distance,
        dayKey,
        createdAt: now,
        updatedAt: now,
      };

      const sessionId = await createDocument(COLLECTIONS.SESSIONS, sessionData);

      return {
        success: true,
        sessionId,
        offline: false,
        message: "Check-in completed successfully",
      };
    } catch (error) {
      throw new Error(
        `Check-in failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Direct check-out using Firebase SDK (no offline support)
  private async directCheckOut(
    sessionId: string,
    _userId: string,
    _location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<CheckOutResult> {
    try {
      const now = Timestamp.now();

      // Get the session to calculate duration
      const { getDocument } = await import("@/lib/firebase/firestore");
      const session = await getDocument(COLLECTIONS.SESSIONS, sessionId);

      if (!session) {
        throw new Error("Session not found");
      }

      const sessionData = session as any;
      const startTime = sessionData.startTime || sessionData.checkInTime;
      
      if (!startTime) {
        throw new Error("Session missing start time");
      }

      // Calculate duration in minutes
      const startMs = startTime.toMillis ? startTime.toMillis() : startTime.seconds * 1000;
      const endMs = now.toMillis();
      const durationMinutes = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60)));

      const updateData = {
        endTime: now,
        checkOutTime: now, // Legacy field
        status: "completed" as const,
        durationMinutes,
        updatedAt: now,
      };

      await updateDocument(COLLECTIONS.SESSIONS, sessionId, updateData);

      return {
        success: true,
        offline: false,
        message: "Check-out completed successfully",
      };
    } catch (error) {
      throw new Error(
        `Check-out failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Get offline queue status
  async getQueueStatus(): Promise<{
    hasPendingActions: boolean;
    hasFailedActions: boolean;
    isOffline: boolean;
    stats: any;
  }> {
    try {
      const [hasPending, hasFailed, stats] = await Promise.all([
        queueManager.hasPendingActions(),
        queueManager.hasFailedActions(),
        queueManager.getStats(),
      ]);

      return {
        hasPendingActions: hasPending,
        hasFailedActions: hasFailed,
        isOffline: queueManager.isOffline(),
        stats,
      };
    } catch (error) {
      console.error("Failed to get queue status:", error);
      return {
        hasPendingActions: false,
        hasFailedActions: false,
        isOffline: false,
        stats: {
          total: 0,
          pending: 0,
          syncing: 0,
          synced: 0,
          failed: 0,
          cancelled: 0,
        },
      };
    }
  }

  // Manually trigger queue sync
  async syncQueue(): Promise<{
    processed: number;
    synced: number;
    failed: number;
  } | null> {
    try {
      return await queueManager.syncNow();
    } catch (error) {
      console.error("Failed to sync queue:", error);
      return null;
    }
  }

  // Get pending actions for a user
  async getPendingActions(userId?: string): Promise<any[]> {
    try {
      return await queueManager.getPendingActions(userId);
    } catch (error) {
      console.error("Failed to get pending actions:", error);
      return [];
    }
  }

  // Subscribe to queue stats updates
  subscribeToQueueStats(callback: (stats: any) => void): () => void {
    try {
      return queueManager.addStatsListener(callback);
    } catch (error) {
      console.error("Failed to subscribe to queue stats:", error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  // Network status helpers
  isOnline(): boolean {
    return navigator.onLine;
  }

  isOffline(): boolean {
    return !navigator.onLine;
  }

  // Add network status change listeners
  addNetworkListeners(
    onOnline?: () => void,
    onOffline?: () => void
  ): () => void {
    const handleOnline = () => {
      if (this.config.debugMode) {
        console.log("ServiceManager: Network online");
      }
      onOnline?.();
    };

    const handleOffline = () => {
      if (this.config.debugMode) {
        console.log("ServiceManager: Network offline");
      }
      onOffline?.();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  // Configuration methods
  enableOfflineSupport(): void {
    this.config.enableOfflineSupport = true;
  }

  disableOfflineSupport(): void {
    this.config.enableOfflineSupport = false;
  }

  isOfflineSupportEnabled(): boolean {
    return this.config.enableOfflineSupport;
  }
}

// Export singleton instance
export const serviceManager = new ServiceManager({
  enableOfflineSupport: true,
  autoRetry: true,
  debugMode: process.env.NODE_ENV === "development",
});

export default ServiceManager;
