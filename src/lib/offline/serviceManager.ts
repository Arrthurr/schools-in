"use client";

import {
  initDB,
  cacheSchoolData,
  getCachedSchools,
  cacheSessionData,
  getCachedSessions,
  cacheUserData,
  getCachedUserData,
  clearOfflineData,
} from "./offlineDB";
import { queueManager } from "./queueManager";

// Background Sync tags
const CHECK_IN_SYNC_TAG = "check-in-sync";
const CHECK_OUT_SYNC_TAG = "check-out-sync";
const SESSION_SYNC_TAG = "session-sync";

/**
 * Check if Background Sync API is supported
 */
function isBackgroundSyncSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "SyncManager" in window
  );
}

/**
 * Register a background sync event
 */
async function registerBackgroundSync(tag: string): Promise<boolean> {
  if (!isBackgroundSyncSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register(tag);
    console.log(`[ServiceManager] Registered background sync: ${tag}`);
    return true;
  } catch (error) {
    console.warn(
      `[ServiceManager] Failed to register background sync: ${tag}`,
      error
    );
    return false;
  }
}

export class ServiceManager {
  private static instance: ServiceManager;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private backgroundSyncSupported: boolean = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;
      this.backgroundSyncSupported = isBackgroundSyncSupported();
      this.setupEventListeners();
      this.initializeOfflineDB();
    }
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  private setupEventListeners() {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.onOnline();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.onOffline();
    });

    // Listen for service worker messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        this.handleServiceWorkerMessage(event);
      });
    }
  }

  private async initializeOfflineDB() {
    try {
      await initDB();
      console.log("Offline database initialized");
    } catch (error) {
      console.error("Failed to initialize offline database:", error);
    }
  }

  private async onOnline() {
    console.log("Device came online");

    // Trigger background sync
    if (!this.syncInProgress) {
      await this.performBackgroundSync();
    }

    // Notify components about online status
    this.notifyStatusChange("online");
  }

  private onOffline() {
    console.log("Device went offline");
    this.notifyStatusChange("offline");
  }

  private async handleServiceWorkerMessage(event: MessageEvent) {
    const { data, ports } = event;
    const responsePort = ports?.[0];

    switch (data.type) {
      case "BACKGROUND_SYNC":
        await this.performBackgroundSync();
        break;
      case "PROCESS_ACTION_QUEUE":
        try {
          await this.performBackgroundSync();
          if (responsePort) {
            responsePort.postMessage({ type: "PROCESS_ACTION_QUEUE_COMPLETE" });
          } else if (data?.requestId && navigator.serviceWorker?.controller) {
            // Fallback path: if MessageChannel port transfer failed, respond via SW message handler
            navigator.serviceWorker.controller.postMessage({
              type: "PROCESS_ACTION_QUEUE_COMPLETE",
              requestId: data.requestId,
            });
          } else {
            console.warn(
              "[ServiceManager] PROCESS_ACTION_QUEUE missing response port; cannot acknowledge",
              { hasRequestId: Boolean(data?.requestId) }
            );
          }
        } catch (error) {
          console.error("[ServiceManager] PROCESS_ACTION_QUEUE failed", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown sync failure";
          if (responsePort) {
            responsePort.postMessage({
              type: "PROCESS_ACTION_QUEUE_ERROR",
              error: errorMessage,
            });
          } else if (data?.requestId && navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "PROCESS_ACTION_QUEUE_ERROR",
              requestId: data.requestId,
              error: errorMessage,
            });
          } else {
            console.warn(
              "[ServiceManager] PROCESS_ACTION_QUEUE missing response port; cannot send error acknowledgement",
              { hasRequestId: Boolean(data?.requestId), error: errorMessage }
            );
          }
        }
        break;
      case "CACHE_UPDATE":
        this.notifyStatusChange("cache-updated");
        break;
      case "BACKGROUND_SYNC_STARTED":
        console.log(
          `[ServiceManager] Background sync started: ${data.count} actions`
        );
        this.notifyStatusChange("sync-started");
        break;
      case "BACKGROUND_SYNC_COMPLETED":
        console.log(
          `[ServiceManager] Background sync completed: ${data.count} actions`
        );
        this.notifyStatusChange("sync-completed");
        break;
      default:
        console.log("Unknown service worker message:", data);
    }
  }

  private notifyStatusChange(status: string) {
    // Dispatch custom event for components to listen to
    window.dispatchEvent(
      new CustomEvent("service-manager-status", {
        detail: { status, isOnline: this.isOnline },
      })
    );
  }

  // Public API methods

  public isDeviceOnline(): boolean {
    return this.isOnline;
  }

  public async cacheUserSchools(schools: any[]) {
    try {
      await cacheSchoolData(schools);
      console.log(`Cached ${schools.length} schools for offline use`);
    } catch (error) {
      console.error("Failed to cache school data:", error);
    }
  }

  public async getOfflineSchools(userId?: string) {
    try {
      return await getCachedSchools(userId);
    } catch (error) {
      console.error("Failed to get offline schools:", error);
      return [];
    }
  }

  public async cacheUserSessions(sessions: any[]) {
    try {
      await cacheSessionData(sessions);
      console.log(`Cached ${sessions.length} sessions for offline use`);
    } catch (error) {
      console.error("Failed to cache session data:", error);
    }
  }

  public async getOfflineSessions(userId?: string) {
    try {
      return await getCachedSessions(userId);
    } catch (error) {
      console.error("Failed to get offline sessions:", error);
      return [];
    }
  }

  public async performOfflineCheckIn(checkInData: {
    schoolId: string;
    userId: string;
    coordinates: { lat: number; lng: number };
    timestamp: number;
  }) {
    try {
      const result = await queueManager.checkIn(
        checkInData.schoolId,
        checkInData.userId,
        {
          latitude: checkInData.coordinates.lat,
          longitude: checkInData.coordinates.lng,
        }
      );

      if (this.backgroundSyncSupported && result.offline) {
        await registerBackgroundSync(CHECK_IN_SYNC_TAG);
      }

      if (result.offline) {
        const localSession = {
          id: result.actionId || `offline-${Date.now()}`,
          schoolId: checkInData.schoolId,
          userId: checkInData.userId,
          coordinates: checkInData.coordinates,
          status: "pending-sync",
          startTime: new Date(checkInData.timestamp).toISOString(),
        };
        await cacheSessionData([localSession]);
        console.log("Check-in queued for offline sync");
        return localSession;
      }

      return result;
    } catch (error) {
      console.error("Check-in error:", error);
      throw error;
    }
  }

  public async performOfflineCheckOut(checkOutData: {
    sessionId: string;
    coordinates: { lat: number; lng: number };
    timestamp: number;
    userId?: string;
  }) {
    try {
      const result = await queueManager.checkOut(
        checkOutData.sessionId,
        checkOutData.userId || "unknown-user",
        {
          latitude: checkOutData.coordinates.lat,
          longitude: checkOutData.coordinates.lng,
        }
      );

      if (this.backgroundSyncSupported && result.offline) {
        await registerBackgroundSync(CHECK_OUT_SYNC_TAG);
      }

      if (result.offline) {
        console.log("Check-out queued for offline sync");
        return { status: "pending-sync" };
      }

      return result;
    } catch (error) {
      console.error("Check-out error:", error);
      throw error;
    }
  }

  public async performBackgroundSync() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log("Starting background sync...");

    try {
      await queueManager.syncNow(true);
      console.log("Background sync completed");
      this.notifyStatusChange("sync-completed");
    } catch (error) {
      console.error("Background sync failed:", error);
      this.notifyStatusChange("sync-failed");
    } finally {
      this.syncInProgress = false;
    }
  }

  public async cacheCurrentUser(userData: any) {
    try {
      await cacheUserData(userData);
    } catch (error) {
      console.error("Failed to cache user data:", error);
    }
  }

  public async getOfflineUserData() {
    try {
      return await getCachedUserData();
    } catch (error) {
      console.error("Failed to get offline user data:", error);
      return null;
    }
  }

  public async clearAllOfflineData() {
    try {
      await clearOfflineData();
      console.log("All offline data cleared");
    } catch (error) {
      console.error("Failed to clear offline data:", error);
    }
  }

  public getSyncStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      backgroundSyncSupported: this.backgroundSyncSupported,
    };
  }

  /**
   * Check if Background Sync API is supported
   */
  public isBackgroundSyncSupported(): boolean {
    return this.backgroundSyncSupported;
  }

  /**
   * Check if there are pending actions waiting to sync
   */
  public async hasPendingActions(): Promise<boolean> {
    return queueManager.hasPendingActions();
  }

  /**
   * Manually trigger a background sync registration
   * Useful for testing or forcing a sync attempt
   */
  public async triggerBackgroundSync(): Promise<boolean> {
    if (!this.backgroundSyncSupported) {
      // Fall back to manual sync
      await this.performBackgroundSync();
      return false;
    }

    return await registerBackgroundSync(SESSION_SYNC_TAG);
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
