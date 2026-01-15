/// <reference lib="webworker" />
import {
  Serwist,
  NetworkFirst,
  CacheFirst,
  ExpirationPlugin,
  type PrecacheEntry,
} from "serwist";

// ============================================
// Background Sync Constants
// ============================================
const GEOFENCE_CHECK_TAG = "geofence-check";
const CHECK_IN_SYNC_TAG = "check-in-sync";
const CHECK_OUT_SYNC_TAG = "check-out-sync";
const SESSION_SYNC_TAG = "session-sync";

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
    }
  } catch (error) {
    console.error("[SW] Periodic geofence check failed:", error);
  }
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
    event.waitUntil(notifyClientsToProcessActionQueue(tag));
  }
});

async function notifyClientsToProcessActionQueue(
  tag: string
): Promise<void> {
  try {
    const pendingAcks = new Map<string, (error?: unknown) => void>();

    const generateRequestId = (): string => {
      try {
        // Some browsers support crypto.randomUUID in SW contexts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyCrypto = (self as any).crypto;
        if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
      } catch {
        // ignore
      }
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    };

    const messageHandler = (event: ExtendableMessageEvent) => {
      const data = (event as ExtendableMessageEvent).data || {};
      const { type, requestId, error } = data;
      if (
        (type === "PROCESS_ACTION_QUEUE_COMPLETE" ||
          type === "PROCESS_ACTION_QUEUE_ERROR") &&
        typeof requestId === "string"
      ) {
        const finish = pendingAcks.get(requestId);
        if (finish) finish(type === "PROCESS_ACTION_QUEUE_ERROR" ? error : undefined);
      }
    };

    self.addEventListener("message", messageHandler);

    try {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      if (clients.length === 0) {
        console.log("[SW] No clients available to process action queue");
        return;
      }

      // IMPORTANT: Only notify a single client to avoid multi-tab races.
      // (Queue processing is additionally protected with a cross-tab lock.)
      const bestClient =
        clients.find((c) => (c as WindowClient).focused) ||
        clients.find((c) => (c as WindowClient).visibilityState === "visible") ||
        clients[0];

      await new Promise<void>((resolve) => {
        const requestId = generateRequestId();
        const channel = new MessageChannel();
        let finished = false;
        const timeout = setTimeout(() => {
          console.warn("[SW] PROCESS_ACTION_QUEUE timeout, continuing");
          finish();
        }, 15000);

        const finish = (error?: unknown) => {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          channel.port1.onmessage = null;
          try {
            channel.port1.close();
          } catch {
            // ignore
          }
          pendingAcks.delete(requestId);
          resolve();
          if (error) {
            console.warn("[SW] PROCESS_ACTION_QUEUE error from client", { error });
          }
        };

        pendingAcks.set(requestId, finish);

        channel.port1.onmessage = (event) => {
          const { type, error } = event.data || {};
          if (type === "PROCESS_ACTION_QUEUE_COMPLETE") {
            finish();
          } else if (type === "PROCESS_ACTION_QUEUE_ERROR") {
            finish(error);
          }
        };

        bestClient.postMessage(
          {
            type: "PROCESS_ACTION_QUEUE",
            source: "service-worker",
            tag,
            requestId,
          },
          [channel.port2]
        );
      });
    } finally {
      self.removeEventListener("message", messageHandler);
      pendingAcks.clear();
    }
  } catch (error) {
    console.error("[SW] Failed to request client action queue processing:", error);
    throw error;
  }
}

// ============================================
// Push Notification Handler
// ============================================
// Handles push events from the server

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) {
    console.log("[SW] Push event with no data");
    return;
  }

  try {
    const payload = event.data.json();

    const title = payload.title || "CampusAccess";
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

  let urlToOpen = "/provider";

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

