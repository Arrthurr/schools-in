/// <reference lib="webworker" />
import {
  Serwist,
  NetworkFirst,
  CacheFirst,
  ExpirationPlugin,
  type PrecacheEntry,
} from "serwist";
import { openDB } from "idb";

// ============================================
// Background Sync Constants
// ============================================
const GEOFENCE_CHECK_TAG = "geofence-check";
const CHECK_IN_SYNC_TAG = "check-in-sync";
const CHECK_OUT_SYNC_TAG = "check-out-sync";
const SESSION_SYNC_TAG = "session-sync";

// IndexedDB constants - MUST match src/lib/offline/dbSchema.ts
// These are duplicated here because SW context cannot use module imports
// from the main app bundle. Keep in sync with dbSchema.ts!
const DB_NAME = "schools-in-offline";
const DB_VERSION = 2;
const STORES = {
  SCHOOLS: "schools",
  SESSIONS: "sessions",
  PENDING_ACTIONS: "pending-actions",
  USER_DATA: "user-data",
  GEOFENCE_CONFIG: "geofence-config",
} as const;

/**
 * Upgrade callback for IndexedDB in SW context
 * Must match the schema in src/lib/offline/dbSchema.ts
 */
function upgradeOfflineDBForSW(db: import("idb").IDBPDatabase<unknown>): void {
  if (!db.objectStoreNames.contains(STORES.SCHOOLS)) {
    const schoolsStore = db.createObjectStore(STORES.SCHOOLS, { keyPath: "id" });
    schoolsStore.createIndex("name", "name");
  }
  if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
    const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: "id" });
    sessionsStore.createIndex("userId", "userId");
    sessionsStore.createIndex("schoolId", "schoolId");
    sessionsStore.createIndex("startTime", "startTime");
  }
  if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
    const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, {
      keyPath: "id",
      autoIncrement: true,
    });
    pendingStore.createIndex("timestamp", "timestamp");
    pendingStore.createIndex("type", "type");
  }
  if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
    db.createObjectStore(STORES.USER_DATA, { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains(STORES.GEOFENCE_CONFIG)) {
    db.createObjectStore(STORES.GEOFENCE_CONFIG, { keyPath: "id" });
  }
}

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Skip waiting and claim clients immediately
self.skipWaiting();
self.addEventListener("activate", () => {
  self.clients.claim();
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Google Fonts stylesheets
    {
      matcher: /^https:\/\/fonts\.googleapis\.com/,
      handler: new CacheFirst({
        cacheName: "google-fonts-stylesheets",
        plugins: [],
      }),
    },
    // Google Fonts webfonts
    {
      matcher: /^https:\/\/fonts\.gstatic\.com/,
      handler: new CacheFirst({
        cacheName: "google-fonts-webfonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
          }),
        ],
      }),
    },
    // Firebase API endpoints
    {
      matcher: /^https:\/\/.*\.firebaseapp\.com/,
      handler: new NetworkFirst({
        cacheName: "firebase-api",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24, // 1 day
          }),
        ],
      }),
    },
    // Local API routes
    {
      matcher: /\/api\//,
      handler: new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60, // 1 hour
          }),
        ],
      }),
    },
    // Images (PNG, JPG, JPEG, SVG, GIF, WebP, AVIF, ICO)
    {
      matcher: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
    },
    // Google profile images
    {
      matcher: /^https:\/\/.*\.googleusercontent\.com/,
      handler: new CacheFirst({
        cacheName: "google-profile-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
          }),
        ],
      }),
    },
    // Firebase Storage images
    {
      matcher: /^https:\/\/firebasestorage\.googleapis\.com/,
      handler: new CacheFirst({
        cacheName: "firebase-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          }),
        ],
      }),
    },
    // Default cache for navigation and static assets
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "script" || request.destination === "style",
      handler: new CacheFirst({
        cacheName: "static-resources",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
  ],
});

// Listen for skip waiting message from update prompt
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ============================================
// Periodic Background Sync Handler
// ============================================
// Chrome/Edge only - triggers every 15-60 min based on engagement score

self.addEventListener("periodicsync", (event: any) => {
  if (event.tag === GEOFENCE_CHECK_TAG) {
    event.waitUntil(handlePeriodicGeofenceCheck());
  }
});

async function handlePeriodicGeofenceCheck(): Promise<void> {
  try {
    // Check for active clients (open tabs/windows)
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: false,
    });

    if (clients.length > 0) {
      // Post message to first client to run geofence check
      // Client has access to Geolocation API, SW does not
      clients[0].postMessage({ type: "GEOFENCE_CHECK_REQUESTED" });
      console.log("[SW] Geofence check requested via client message");
    } else {
      // No active client - check if we should show notification
      const shouldNotify = await checkShouldShowGeofenceNotification();
      if (shouldNotify.show) {
        await showGeofenceReminderNotification(
          shouldNotify.action,
          shouldNotify.locationName
        );
      }
    }
  } catch (error) {
    console.error("[SW] Periodic geofence check failed:", error);
  }
}

async function checkShouldShowGeofenceNotification(): Promise<{
  show: boolean;
  action: "check-in" | "check-out" | "none";
  locationName: string | null;
}> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade: upgradeOfflineDBForSW,
    });
    const config = await db.get(STORES.GEOFENCE_CONFIG, "current");

    if (!config || !config.autoGeofenceEnabled) {
      return { show: false, action: "none", locationName: null };
    }

    // Check if we have a stale location that might need attention
    if (config.lastCheckAt) {
      const ageMs = Date.now() - config.lastCheckAt;
      const staleThresholdMs = 30 * 60 * 1000; // 30 minutes

      if (ageMs > staleThresholdMs) {
        // Location data is stale, prompt user to open app
        if (config.activeSessionId) {
          // Has active session but hasn't checked in a while
          const location = config.assignedLocations?.find(
            (loc: any) => loc.id === config.activeSessionLocationId
          );
          return {
            show: true,
            action: "check-out",
            locationName: location?.name || null,
          };
        }
      }
    }

    return { show: false, action: "none", locationName: null };
  } catch {
    return { show: false, action: "none", locationName: null };
  }
}

async function showGeofenceReminderNotification(
  action: "check-in" | "check-out" | "none",
  locationName: string | null
): Promise<void> {
  const title =
    action === "check-in" ? "Check-in Reminder" : "Check-out Reminder";

  const body =
    action === "check-in"
      ? "Open Schools In to check in at your location"
      : locationName
        ? `Are you still at ${locationName}?`
        : "Open Schools In to update your session";

  await self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "geofence-reminder",
    requireInteraction: true,
    data: { action, locationName },
  });
}

// ============================================
// Background Sync Handler (Offline Actions)
// ============================================
// Syncs pending check-in/check-out actions when back online

self.addEventListener("sync", (event: any) => {
  const tag = event.tag;

  if (
    tag === CHECK_IN_SYNC_TAG ||
    tag === CHECK_OUT_SYNC_TAG ||
    tag === SESSION_SYNC_TAG
  ) {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions(): Promise<void> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade: upgradeOfflineDBForSW,
    });
    const actions = await db.getAll(STORES.PENDING_ACTIONS);

    if (actions.length === 0) {
      console.log("[SW] No pending actions to sync");
      return;
    }

    console.log(`[SW] Syncing ${actions.length} pending actions`);

    // Notify clients that sync is starting
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((client) => {
      client.postMessage({
        type: "BACKGROUND_SYNC_STARTED",
        count: actions.length,
      });
    });

    // Process each action
    for (const action of actions) {
      try {
        // Post to client to handle the actual Firebase operation
        // SW cannot directly use Firebase SDK due to auth context
        if (clients.length > 0) {
          clients[0].postMessage({
            type: "SYNC_ACTION_REQUESTED",
            action,
          });
        }
      } catch (error) {
        console.error("[SW] Failed to sync action:", action.id, error);
      }
    }

    // Notify clients that sync completed
    clients.forEach((client) => {
      client.postMessage({
        type: "BACKGROUND_SYNC_COMPLETED",
        count: actions.length,
      });
    });
  } catch (error) {
    console.error("[SW] Background sync failed:", error);
    throw error; // Rethrow to retry sync
  }
}

// ============================================
// Push Notification Handler
// ============================================
// Handles push events from the server for geofence reminders

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) {
    console.log("[SW] Push event with no data");
    return;
  }

  try {
    const payload = event.data.json();

    const title = payload.title || "Schools In";
    type NotificationOptionsWithActions = NotificationOptions & {
      actions?: Array<{ action: string; title: string; icon?: string }>;
    };

    const options: NotificationOptionsWithActions = {
      body: payload.body || "You have a new notification",
      icon: payload.icon || "/icons/icon-192x192.png",
      badge: payload.badge || "/icons/icon-72x72.png",
      tag: payload.tag || "schools-in-notification",
      requireInteraction: payload.requireInteraction ?? true,
      data: payload.data || {},
    };

    // Add actions if this is a geofence reminder
    if (payload.data?.action === "check-in" || payload.data?.action === "check-out") {
      options.actions = [
        { action: "open", title: "Open App" },
        { action: "dismiss", title: "Dismiss" },
      ];
    }

    event.waitUntil(self.registration.showNotification(title, options));

    console.log("[SW] Push notification shown:", title);
  } catch (error) {
    console.error("[SW] Error processing push event:", error);
  }
});

// ============================================
// Notification Click Handler
// ============================================

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data;
  const action = event.action;

  // Handle dismiss action
  if (action === "dismiss") {
    return;
  }

  // Determine URL based on notification type
  let urlToOpen = "/provider";
  if (data?.action === "check-in" || data?.action === "check-out") {
    urlToOpen = "/provider";
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If there's already a window open, focus it and navigate
        for (const client of clientList) {
          if ("focus" in client) {
            // Send message to client about the notification action
            client.postMessage({
              type: "NOTIFICATION_CLICKED",
              action: data?.action,
              data,
            });
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// Notification Close Handler
// ============================================

self.addEventListener("notificationclose", (event: NotificationEvent) => {
  const data = event.notification.data;
  console.log("[SW] Notification closed:", data?.action || "unknown");
});

serwist.addEventListeners();

