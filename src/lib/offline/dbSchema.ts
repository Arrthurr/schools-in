/**
 * Centralized IndexedDB Schema
 *
 * Single source of truth for database configuration used by:
 * - offlineDB.ts (main thread)
 * - sw.ts (service worker)
 *
 * This prevents schema race conditions where different contexts
 * might define different stores for the same DB version.
 */

import type { IDBPDatabase } from "idb";

export const DB_NAME = "schools-in-offline";
export const DB_VERSION = 2;

export const STORES = {
  SCHOOLS: "schools",
  SESSIONS: "sessions",
  PENDING_ACTIONS: "pending-actions",
  USER_DATA: "user-data",
  GEOFENCE_CONFIG: "geofence-config",
} as const;

/**
 * Upgrade callback for IndexedDB
 * Creates all required object stores and indexes
 */
export function upgradeOfflineDB(db: IDBPDatabase<unknown>): void {
  // Schools store
  if (!db.objectStoreNames.contains(STORES.SCHOOLS)) {
    const schoolsStore = db.createObjectStore(STORES.SCHOOLS, {
      keyPath: "id",
    });
    schoolsStore.createIndex("name", "name");
  }

  // Sessions store
  if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
    const sessionsStore = db.createObjectStore(STORES.SESSIONS, {
      keyPath: "id",
    });
    sessionsStore.createIndex("userId", "userId");
    sessionsStore.createIndex("schoolId", "schoolId");
    sessionsStore.createIndex("startTime", "startTime");
  }

  // Pending actions store (for offline operations)
  if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
    const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, {
      keyPath: "id",
      autoIncrement: true,
    });
    pendingStore.createIndex("timestamp", "timestamp");
    pendingStore.createIndex("type", "type");
  }

  // User data store
  if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
    db.createObjectStore(STORES.USER_DATA, {
      keyPath: "id",
    });
  }

  // Geofence config store (v2)
  if (!db.objectStoreNames.contains(STORES.GEOFENCE_CONFIG)) {
    db.createObjectStore(STORES.GEOFENCE_CONFIG, {
      keyPath: "id",
    });
  }
}
