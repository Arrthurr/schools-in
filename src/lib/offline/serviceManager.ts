"use client";

import {
  initDB,
  cacheSchoolData,
  getCachedSchools,
  cacheSessionData,
  getCachedSessions,
  queueOfflineAction,
  syncPendingActions,
  cacheUserData,
  getCachedUserData,
  clearOfflineData,
  hasPendingActions,
} from "./offlineDB";
import {
  createDocument,
  updateDocument,
  COLLECTIONS,
} from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { getDayKey } from "@/lib/utils/time";

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
    console.warn(`[ServiceManager] Failed to register background sync: ${tag}`, error);
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

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { data } = event;

    switch (data.type) {
      case "BACKGROUND_SYNC":
        this.performBackgroundSync();
        break;
      case "CACHE_UPDATE":
        this.notifyStatusChange("cache-updated");
        break;
      case "BACKGROUND_SYNC_STARTED":
        console.log(`[ServiceManager] Background sync started: ${data.count} actions`);
        this.notifyStatusChange("sync-started");
        break;
      case "BACKGROUND_SYNC_COMPLETED":
        console.log(`[ServiceManager] Background sync completed: ${data.count} actions`);
        this.notifyStatusChange("sync-completed");
        break;
      case "SYNC_ACTION_REQUESTED":
        // SW is requesting us to sync a specific action
        this.handleSyncActionRequest(data.action);
        break;
      default:
        console.log("Unknown service worker message:", data);
    }
  }

  private async handleSyncActionRequest(action: any) {
    if (!action) return;

    try {
      // Process the action through the normal sync flow
      await syncPendingActions();
      this.notifyStatusChange("sync-completed");
    } catch (error) {
      console.error("[ServiceManager] Failed to process sync action:", error);
      this.notifyStatusChange("sync-failed");
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
      if (this.isOnline) {
        // Online - perform immediate check-in using Firebase SDK
        const now = Timestamp.now();
        const dayKey = getDayKey(now);

        const sessionData = {
          userId: checkInData.userId,
          locationId: checkInData.schoolId,
          startTime: now,
          checkInTime: now, // Legacy field
          status: "active" as const,
          checkInMethod: "geo" as const,
          distanceFromCenterAtCheckIn: checkInData.coordinates.lat ? 0 : 0, // Use accuracy if available
          dayKey,
          createdAt: now,
          updatedAt: now,
        };

        const sessionId = await createDocument(COLLECTIONS.SESSIONS, sessionData);

        return {
          id: sessionId,
          ...sessionData,
        };
      } else {
        // Offline - queue the action
        await queueOfflineAction({
          type: "check-in",
          data: checkInData,
          timestamp: Date.now(),
        });

        // Register background sync if supported
        if (this.backgroundSyncSupported) {
          await registerBackgroundSync(CHECK_IN_SYNC_TAG);
        }

        // Create local session record
        const localSession = {
          id: `offline-${Date.now()}`,
          ...checkInData,
          status: "pending-sync",
          startTime: new Date(checkInData.timestamp).toISOString(),
        };

        // Cache locally
        await cacheSessionData([localSession]);

        console.log("Check-in queued for offline sync");
        return localSession;
      }
    } catch (error) {
      console.error("Check-in error:", error);
      throw error;
    }
  }

  public async performOfflineCheckOut(checkOutData: {
    sessionId: string;
    coordinates: { lat: number; lng: number };
    timestamp: number;
  }) {
    try {
      if (this.isOnline) {
        // Online - perform immediate check-out using Firebase SDK
        const { getDocument } = await import("@/lib/firebase/firestore");
        const session = await getDocument(COLLECTIONS.SESSIONS, checkOutData.sessionId);

        if (!session) {
          throw new Error("Session not found");
        }

        const sessionData = session as any;
        const startTime = sessionData.startTime || sessionData.checkInTime;
        
        if (!startTime) {
          throw new Error("Session missing start time");
        }

        const now = Timestamp.now();
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

        await updateDocument(COLLECTIONS.SESSIONS, checkOutData.sessionId, updateData);

        return {
          id: checkOutData.sessionId,
          ...sessionData,
          ...updateData,
        };
      } else {
        // Offline - queue the action
        await queueOfflineAction({
          type: "check-out",
          data: checkOutData,
          timestamp: Date.now(),
        });

        // Register background sync if supported
        if (this.backgroundSyncSupported) {
          await registerBackgroundSync(CHECK_OUT_SYNC_TAG);
        }

        console.log("Check-out queued for offline sync");
        return { status: "pending-sync" };
      }
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
      await syncPendingActions();
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
    try {
      return await hasPendingActions();
    } catch {
      return false;
    }
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
