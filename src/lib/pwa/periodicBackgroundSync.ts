/**
 * Periodic Background Sync Manager
 *
 * Handles registration and management of Periodic Background Sync API
 * for background geofence checking on Chrome/Android.
 *
 * Browser Support: Chrome 80+, Edge 80+, Samsung Internet 13+
 * Requires: Site engagement score, installed PWA preferred
 */

import { appLogger } from "@/lib/logging/appLogger";

const GEOFENCE_CHECK_TAG = "geofence-check";
const MIN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes (browser minimum)

export interface PeriodicSyncStatus {
  supported: boolean;
  registered: boolean;
  permissionState: PermissionState | "unsupported";
  tag: string;
  minInterval: number;
}

/**
 * Check if Periodic Background Sync is supported
 */
export function isPeriodicBackgroundSyncSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "periodicSync" in ServiceWorkerRegistration.prototype
  );
}

/**
 * Get the current permission state for periodic background sync
 */
async function getPeriodicSyncPermission(): Promise<PermissionState | "unsupported"> {
  if (!isPeriodicBackgroundSyncSupported()) {
    return "unsupported";
  }

  try {
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    return status.state;
  } catch {
    return "unsupported";
  }
}

/**
 * Register for periodic geofence checks
 * Browser will trigger every 15-60 minutes based on engagement score
 */
export async function registerPeriodicGeofenceSync(): Promise<boolean> {
  if (!isPeriodicBackgroundSyncSupported()) {
    appLogger.info("Periodic Background Sync not supported");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const periodicSync = (registration as any).periodicSync;

    if (!periodicSync) {
      appLogger.warn("periodicSync not available on registration");
      return false;
    }

    await periodicSync.register(GEOFENCE_CHECK_TAG, {
      minInterval: MIN_INTERVAL_MS,
    });

    appLogger.info("Periodic geofence sync registered", {
      tag: GEOFENCE_CHECK_TAG,
      minInterval: MIN_INTERVAL_MS,
    });

    return true;
  } catch (error) {
    appLogger.warn("Failed to register periodic geofence sync", { error });
    return false;
  }
}

/**
 * Unregister periodic geofence checks
 */
export async function unregisterPeriodicGeofenceSync(): Promise<boolean> {
  if (!isPeriodicBackgroundSyncSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const periodicSync = (registration as any).periodicSync;

    if (!periodicSync) {
      return false;
    }

    await periodicSync.unregister(GEOFENCE_CHECK_TAG);

    appLogger.info("Periodic geofence sync unregistered", {
      tag: GEOFENCE_CHECK_TAG,
    });

    return true;
  } catch (error) {
    appLogger.warn("Failed to unregister periodic geofence sync", { error });
    return false;
  }
}

/**
 * Check if periodic geofence sync is currently registered
 */
export async function isPeriodicGeofenceSyncRegistered(): Promise<boolean> {
  if (!isPeriodicBackgroundSyncSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const periodicSync = (registration as any).periodicSync;

    if (!periodicSync) {
      return false;
    }

    const tags = await periodicSync.getTags();
    return tags.includes(GEOFENCE_CHECK_TAG);
  } catch {
    return false;
  }
}

/**
 * Get comprehensive status of periodic background sync
 */
export async function getPeriodicSyncStatus(): Promise<PeriodicSyncStatus> {
  const supported = isPeriodicBackgroundSyncSupported();
  const permissionState = await getPeriodicSyncPermission();
  const registered = await isPeriodicGeofenceSyncRegistered();

  return {
    supported,
    registered,
    permissionState,
    tag: GEOFENCE_CHECK_TAG,
    minInterval: MIN_INTERVAL_MS,
  };
}

/**
 * Listen for service worker messages requesting geofence check
 * This is triggered when the SW receives a periodicsync event
 */
export function setupGeofenceCheckListener(
  onCheckRequested: () => void
): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    // Return no-op cleanup function
    return () => undefined;
  }

  const handler = (event: MessageEvent) => {
    if (event.data?.type === "GEOFENCE_CHECK_REQUESTED") {
      appLogger.info("Geofence check requested by service worker");
      onCheckRequested();
    }
  };

  navigator.serviceWorker.addEventListener("message", handler);

  return () => {
    navigator.serviceWorker.removeEventListener("message", handler);
  };
}

export const PERIODIC_SYNC_TAG = GEOFENCE_CHECK_TAG;
