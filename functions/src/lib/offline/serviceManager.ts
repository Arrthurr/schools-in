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
} from "./offlineDB";

export class ServiceManager {
  private static instance: ServiceManager;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  private constructor() {
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;
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
      if (this.isOnline) {
        // Online - perform immediate check-in
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(checkInData),
        });

        if (!response.ok) {
          throw new Error("Check-in failed");
        }

        return await response.json();
      } else {
        // Offline - queue the action
        await queueOfflineAction({
          type: "check-in",
          data: checkInData,
          timestamp: Date.now(),
        });

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
        // Online - perform immediate check-out
        const response = await fetch(
          `/api/sessions/${checkOutData.sessionId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              endTime: new Date(checkOutData.timestamp).toISOString(),
              endCoordinates: checkOutData.coordinates,
              status: "completed",
            }),
          }
        );

        if (!response.ok) {
          throw new Error("Check-out failed");
        }

        return await response.json();
      } else {
        // Offline - queue the action
        await queueOfflineAction({
          type: "check-out",
          data: checkOutData,
          timestamp: Date.now(),
        });

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
    };
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();
