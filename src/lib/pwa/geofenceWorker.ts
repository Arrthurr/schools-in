/**
 * Geofence Worker Module
 *
 * Portable geofence logic that can run in Service Worker context.
 * Since service workers cannot access Geolocation API directly,
 * this module handles the coordination and data processing.
 *
 * Usage:
 * - SW receives periodicsync → posts message to client
 * - Client runs geofence check → stores result in IndexedDB
 * - If no client available → SW shows push notification
 */

import { openDB } from "idb";

const DB_NAME = "schools-in-offline";
const DB_VERSION = 2;
const GEOFENCE_CONFIG_STORE = "geofence-config";

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

export interface GeofenceCheckResult {
  insideLocationId: string | null;
  insideLocationName: string | null;
  distanceMeters: number | null;
  hasActiveSession: boolean;
  activeSessionLocationId: string | null;
  suggestedAction: "check-in" | "check-out" | "none";
  checkedAt: number;
}

/**
 * Earth's radius in meters
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate Haversine distance between two coordinates
 * This is duplicated here to allow running in SW context without imports
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Get the geofence config database
 */
async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(GEOFENCE_CONFIG_STORE)) {
        db.createObjectStore(GEOFENCE_CONFIG_STORE, { keyPath: "id" });
      }
    },
  });
}

/**
 * Save geofence configuration to IndexedDB
 * Called from main thread when user logs in or locations change
 */
export async function saveGeofenceConfig(
  config: Omit<GeofenceConfig, "id">
): Promise<void> {
  const db = await getDB();
  await db.put(GEOFENCE_CONFIG_STORE, { id: "current", ...config });
}

/**
 * Get current geofence configuration from IndexedDB
 */
export async function getGeofenceConfig(): Promise<GeofenceConfig | null> {
  const db = await getDB();
  return db.get(GEOFENCE_CONFIG_STORE, "current");
}

/**
 * Update user's last known location
 * Called after each successful geolocation read
 */
export async function updateUserLocation(
  latitude: number,
  longitude: number
): Promise<void> {
  const db = await getDB();
  const config = await db.get(GEOFENCE_CONFIG_STORE, "current");

  if (config) {
    await db.put(GEOFENCE_CONFIG_STORE, {
      ...config,
      lastUserLatitude: latitude,
      lastUserLongitude: longitude,
      lastCheckAt: Date.now(),
    });
  }
}

/**
 * Update active session info in geofence config
 */
export async function updateActiveSession(
  sessionId: string | undefined,
  locationId: string | undefined
): Promise<void> {
  const db = await getDB();
  const config = await db.get(GEOFENCE_CONFIG_STORE, "current");

  if (config) {
    await db.put(GEOFENCE_CONFIG_STORE, {
      ...config,
      activeSessionId: sessionId,
      activeSessionLocationId: locationId,
    });
  }
}

/**
 * Clear geofence configuration (on logout)
 */
export async function clearGeofenceConfig(): Promise<void> {
  const db = await getDB();
  await db.delete(GEOFENCE_CONFIG_STORE, "current");
}

/**
 * Run geofence check using cached config and provided coordinates
 * Returns suggested action based on location and session state
 */
export async function runGeofenceCheck(
  latitude: number,
  longitude: number
): Promise<GeofenceCheckResult> {
  const config = await getGeofenceConfig();

  if (!config || !config.autoGeofenceEnabled) {
    return {
      insideLocationId: null,
      insideLocationName: null,
      distanceMeters: null,
      hasActiveSession: false,
      activeSessionLocationId: null,
      suggestedAction: "none",
      checkedAt: Date.now(),
    };
  }

  // Update last known location
  await updateUserLocation(latitude, longitude);

  const hasActiveSession = !!config.activeSessionId;
  const activeSessionLocationId = config.activeSessionLocationId || null;

  // Find if user is inside any assigned location
  let insideLocation: GeofenceLocation | null = null;
  let closestDistance = Infinity;

  for (const location of config.assignedLocations) {
    const distance = calculateHaversineDistance(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance <= location.radiusMeters) {
      insideLocation = location;
      closestDistance = distance;
      break; // Found a match, use first one
    }

    if (distance < closestDistance) {
      closestDistance = distance;
    }
  }

  // Determine suggested action
  let suggestedAction: GeofenceCheckResult["suggestedAction"] = "none";

  if (hasActiveSession) {
    // User has active session - check if they left the location
    if (activeSessionLocationId) {
      const activeLocation = config.assignedLocations.find(
        (loc) => loc.id === activeSessionLocationId
      );
      if (activeLocation) {
        const distanceFromActive = calculateHaversineDistance(
          latitude,
          longitude,
          activeLocation.latitude,
          activeLocation.longitude
        );
        if (distanceFromActive > activeLocation.radiusMeters) {
          suggestedAction = "check-out";
        }
      }
    }
  } else {
    // No active session - check if they entered a location
    if (insideLocation) {
      suggestedAction = "check-in";
    }
  }

  return {
    insideLocationId: insideLocation?.id || null,
    insideLocationName: insideLocation?.name || null,
    distanceMeters: closestDistance === Infinity ? null : closestDistance,
    hasActiveSession,
    activeSessionLocationId,
    suggestedAction,
    checkedAt: Date.now(),
  };
}

/**
 * Check if user should be prompted based on last check result
 * Used by service worker to decide whether to show notification
 */
export async function shouldShowGeofenceNotification(): Promise<{
  show: boolean;
  action: "check-in" | "check-out" | "none";
  locationName: string | null;
}> {
  const config = await getGeofenceConfig();

  if (!config || !config.autoGeofenceEnabled) {
    return { show: false, action: "none", locationName: null };
  }

  // If we have recent location data, use it
  if (
    config.lastUserLatitude &&
    config.lastUserLongitude &&
    config.lastCheckAt
  ) {
    const ageMs = Date.now() - config.lastCheckAt;
    const maxAgeMs = 10 * 60 * 1000; // 10 minutes

    if (ageMs < maxAgeMs) {
      const result = await runGeofenceCheck(
        config.lastUserLatitude,
        config.lastUserLongitude
      );

      if (result.suggestedAction !== "none") {
        return {
          show: true,
          action: result.suggestedAction,
          locationName: result.insideLocationName,
        };
      }
    }
  }

  return { show: false, action: "none", locationName: null };
}

export const GEOFENCE_CONFIG_KEY = "current";
