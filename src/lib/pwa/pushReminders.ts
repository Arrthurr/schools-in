/**
 * Push Notification Reminder System
 *
 * Provides push subscription helpers for server-driven notifications
 * (e.g., admin alerts) and client permission management.
 *
 * This module handles:
 * - VAPID key management and subscription
 * - Syncing push subscriptions with Firebase
 * - Coordinating with the service worker for push events
 *
 * Browser Support:
 * - Safari iOS 16.4+: Push notifications (requires user gesture)
 * - Firefox: Push notifications (full support)
 * - Chrome/Edge: Push notifications
 */

import { appLogger } from "@/lib/logging/appLogger";
import { doc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";

const PUSH_SUBSCRIPTION_KEY = "push-subscription";

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current push permission state
 */
export function getPushPermissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Check if we can request push permission
 */
export function canRequestPushPermission(): boolean {
  if (!isPushSupported()) return false;
  return Notification.permission === "default";
}

/**
 * Request push notification permission
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported");
  }

  const permission = await Notification.requestPermission();
  appLogger.info("Push permission requested", { permission });
  return permission;
}

/**
 * Subscribe to push notifications
 * Returns the subscription data to store in Firebase
 */
export async function subscribeToPush(
  vapidPublicKey: string
): Promise<PushSubscriptionData | null> {
  if (!isPushSupported()) {
    appLogger.warn("Push not supported, skipping subscription");
    return null;
  }

  if (Notification.permission !== "granted") {
    appLogger.warn("Push permission not granted");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Validate the existing subscription is still usable
      try {
        extractSubscriptionData(subscription);
      } catch {
        // Stale/invalid subscription — unsubscribe and create a fresh one
        appLogger.warn("Existing push subscription is invalid, re-creating");
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) {
          appLogger.warn("Push unsubscribe returned false for stale subscription");
        }
        subscription = null;
      }
    }

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      appLogger.info("New push subscription created");
    }

    const subscriptionData = extractSubscriptionData(subscription);

    // Cache locally
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PUSH_SUBSCRIPTION_KEY, JSON.stringify(subscriptionData));
    }

    return subscriptionData;
  } catch (error) {
    appLogger.error("Failed to subscribe to push", { error });
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) {
        appLogger.warn("Push unsubscribe returned false");
        return false;
      }
      appLogger.info("Unsubscribed from push notifications");
    }

    // Clear local cache
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(PUSH_SUBSCRIPTION_KEY);
    }

    return true;
  } catch (error) {
    appLogger.error("Failed to unsubscribe from push", { error });
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscriptionData | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return null;

    return extractSubscriptionData(subscription);
  } catch {
    return null;
  }
}

/**
 * Save push subscription to Firebase for server-side push
 */
export async function savePushSubscriptionToFirebase(
  userId: string,
  subscription: PushSubscriptionData,
  subscriptionId: string = "default"
): Promise<void> {
  const docRef = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    "pushSubscriptions",
    subscriptionId
  );

  await setDoc(docRef, {
    ...subscription,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    platform: detectPlatformForPush(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  });

  appLogger.info("Push subscription saved to Firebase", { userId });
}

/**
 * Remove push subscription from Firebase
 */
export async function removePushSubscriptionFromFirebase(
  userId: string,
  subscriptionId: string = "default"
): Promise<void> {
  const docRef = doc(
    db,
    COLLECTIONS.USERS,
    userId,
    "pushSubscriptions",
    subscriptionId
  );

  await deleteDoc(docRef);
  appLogger.info("Push subscription removed from Firebase", { userId });
}


// ============================================
// Helper Functions
// ============================================

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  // Use ArrayBuffer explicitly to avoid ArrayBufferLike/SharedArrayBuffer typing issues
  const outputArray = new Uint8Array(
    new ArrayBuffer(rawData.length)
  ) as Uint8Array<ArrayBuffer>;

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function extractSubscriptionData(
  subscription: PushSubscription
): PushSubscriptionData {
  const json = subscription.toJSON();

  const endpoint = subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription: missing endpoint or keys");
  }

  return {
    endpoint,
    expirationTime: subscription.expirationTime,
    keys: { p256dh, auth },
  };
}

function detectPlatformForPush(): string {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux/.test(ua)) return "linux";

  return "unknown";
}

