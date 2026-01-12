// Custom service worker functionality for Schools In PWA
// This extends the auto-generated next-pwa service worker

import { openDB } from "idb";
import { DB_NAME, DB_VERSION, STORES, upgradeOfflineDB } from "./dbSchema";

// Geofence configuration types
export interface GeofenceLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface GeofenceConfig {
  id: "current";
  userId: string;
  assignedLocations: GeofenceLocation[];
  activeSessionId?: string;
  activeSessionLocationId?: string;
  lastUserLatitude?: number;
  lastUserLongitude?: number;
  lastCheckAt?: number;
  autoGeofenceEnabled: boolean;
}

// Initialize IndexedDB using centralized schema
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade: upgradeOfflineDB,
  });
}

// Cache school data for offline access
export async function cacheSchoolData(schools: any[]) {
  const db = await initDB();
  const tx = db.transaction(STORES.SCHOOLS, "readwrite");

  for (const school of schools) {
    await tx.store.put(school);
  }

  await tx.done;
}

// Get cached schools for offline use
export async function getCachedSchools(userId?: string) {
  const db = await initDB();
  const schools = await db.getAll(STORES.SCHOOLS);

  // Filter by user assignments if userId provided
  if (userId) {
    return schools.filter((school) =>
      school.assignedProviders?.includes(userId)
    );
  }

  return schools;
}

// Cache session data
export async function cacheSessionData(sessions: any[]) {
  const db = await initDB();
  const tx = db.transaction(STORES.SESSIONS, "readwrite");

  for (const session of sessions) {
    await tx.store.put(session);
  }

  await tx.done;
}

// Get cached sessions
export async function getCachedSessions(userId?: string) {
  const db = await initDB();

  if (userId) {
    return await db.getAllFromIndex(STORES.SESSIONS, "userId", userId);
  }

  return await db.getAll(STORES.SESSIONS);
}

// Queue offline actions
// Cache user data
export async function cacheUserData(userData: any) {
  const db = await initDB();
  await db.put(STORES.USER_DATA, { id: "current-user", ...userData });
}

// Get cached user data
export async function getCachedUserData() {
  const db = await initDB();
  return await db.get(STORES.USER_DATA, "current-user");
}

// Get all queued actions
// Clear all cached data (for logout/reset)
export async function clearOfflineData() {
  const db = await initDB();

  await Promise.all([
    db.clear(STORES.SCHOOLS),
    db.clear(STORES.SESSIONS),
    db.clear(STORES.PENDING_ACTIONS),
    db.clear(STORES.USER_DATA),
    db.clear(STORES.GEOFENCE_CONFIG),
  ]);
}

// ============================================
// Geofence Config Functions
// ============================================

// Save geofence configuration
export async function saveGeofenceConfig(
  config: Omit<GeofenceConfig, "id">
): Promise<void> {
  const db = await initDB();
  await db.put(STORES.GEOFENCE_CONFIG, { id: "current", ...config });
}

// Get current geofence configuration
export async function getGeofenceConfig(): Promise<GeofenceConfig | null> {
  const db = await initDB();
  return db.get(STORES.GEOFENCE_CONFIG, "current");
}

// Update user's last known location
export async function updateGeofenceUserLocation(
  latitude: number,
  longitude: number
): Promise<void> {
  const db = await initDB();
  const config = await db.get(STORES.GEOFENCE_CONFIG, "current");

  if (config) {
    await db.put(STORES.GEOFENCE_CONFIG, {
      ...config,
      lastUserLatitude: latitude,
      lastUserLongitude: longitude,
      lastCheckAt: Date.now(),
    });
  }
}

// Update active session info in geofence config
export async function updateGeofenceActiveSession(
  sessionId: string | undefined,
  locationId: string | undefined
): Promise<void> {
  const db = await initDB();
  const config = await db.get(STORES.GEOFENCE_CONFIG, "current");

  if (config) {
    await db.put(STORES.GEOFENCE_CONFIG, {
      ...config,
      activeSessionId: sessionId,
      activeSessionLocationId: locationId,
    });
  }
}

// Clear geofence configuration (on logout)
export async function clearGeofenceConfig(): Promise<void> {
  const db = await initDB();
  await db.delete(STORES.GEOFENCE_CONFIG, "current");
}
