/**
 * Push Notification Reminder System
 *
 * Provides push notification reminders for geofence check-ins on platforms
 * that don't support background sync (Safari iOS, Firefox).
 *
 * This module handles:
 * - VAPID key management and subscription
 * - Scheduling local notification reminders
 * - Syncing push subscriptions with Firebase
 * - Coordinating with the service worker for push events
 *
 * Browser Support:
 * - Safari iOS 16.4+: Push notifications (requires user gesture)
 * - Firefox: Push notifications (full support)
 * - Chrome/Edge: Push notifications (but typically use Background Sync instead)
 */

import { appLogger } from "@/lib/logging/appLogger";
import { doc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";

const PUSH_SUBSCRIPTION_KEY = "geofence-push-subscription";
const REMINDER_SETTINGS_KEY = "geofence-reminder-settings";

export interface ReminderSettings {
  enabled: boolean;
  morningReminderHour: number; // 0-23
  eveningReminderHour: number; // 0-23
  workDaysOnly: boolean; // Mon-Fri only
  lastUpdated: number;
}

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  morningReminderHour: 8, // 8 AM
  eveningReminderHour: 17, // 5 PM
  workDaysOnly: true,
  lastUpdated: Date.now(),
};

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

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
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
      await subscription.unsubscribe();
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
  subscriptionId: string = "geofence"
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
  subscriptionId: string = "geofence"
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

/**
 * Save admin alert push subscription (separate doc id to avoid mixing with geofence)
 */
export async function saveAdminAlertSubscriptionToFirebase(
  userId: string,
  subscription: PushSubscriptionData
): Promise<void> {
  await savePushSubscriptionToFirebase(userId, subscription, "adminAlerts");
}

/**
 * Remove admin alert push subscription
 */
export async function removeAdminAlertSubscriptionFromFirebase(
  userId: string
): Promise<void> {
  await removePushSubscriptionFromFirebase(userId, "adminAlerts");
}

/**
 * Get reminder settings from localStorage
 */
export function getReminderSettings(): ReminderSettings {
  if (typeof localStorage === "undefined") {
    return DEFAULT_REMINDER_SETTINGS;
  }

  const stored = localStorage.getItem(REMINDER_SETTINGS_KEY);
  if (!stored) {
    return DEFAULT_REMINDER_SETTINGS;
  }

  try {
    return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

/**
 * Save reminder settings to localStorage
 */
export function saveReminderSettings(settings: Partial<ReminderSettings>): void {
  if (typeof localStorage === "undefined") return;

  const current = getReminderSettings();
  const updated: ReminderSettings = {
    ...current,
    ...settings,
    lastUpdated: Date.now(),
  };

  localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(updated));
  appLogger.info("Reminder settings saved", updated);
}

/**
 * Show a local notification (for immediate reminders)
 */
export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {}
): Promise<void> {
  if (!isPushSupported()) {
    appLogger.warn("Notifications not supported");
    return;
  }

  if (Notification.permission !== "granted") {
    appLogger.warn("Notification permission not granted");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification(title, {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: "geofence-reminder",
      requireInteraction: true,
      ...options,
    });

    appLogger.info("Local notification shown", { title });
  } catch (error) {
    appLogger.error("Failed to show notification", { error });
  }
}

/**
 * Show check-in reminder notification
 */
export async function showCheckInReminder(locationName?: string): Promise<void> {
  const body = locationName
    ? `Don't forget to check in at ${locationName}`
    : "Open Schools In to check in at your location";

  await showLocalNotification("Check-in Reminder", {
    body,
    data: { action: "check-in", locationName },
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
  });
}

/**
 * Show check-out reminder notification
 */
export async function showCheckOutReminder(
  locationName?: string,
  sessionDuration?: string
): Promise<void> {
  let body = "Don't forget to check out when you leave";

  if (locationName && sessionDuration) {
    body = `Still at ${locationName}? Session: ${sessionDuration}`;
  } else if (locationName) {
    body = `Don't forget to check out from ${locationName}`;
  }

  await showLocalNotification("Check-out Reminder", {
    body,
    data: { action: "check-out", locationName },
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
  });
}

/**
 * Schedule a visibility-based reminder check
 * This uses the Page Visibility API to show reminders when the user returns to the app
 */
export function setupVisibilityReminder(
  onVisible: () => void
): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  const handler = () => {
    if (document.visibilityState === "visible") {
      onVisible();
    }
  };

  document.addEventListener("visibilitychange", handler);

  return () => {
    document.removeEventListener("visibilitychange", handler);
  };
}

/**
 * Check if it's a good time to show reminders based on settings
 */
export function isReminderTime(): boolean {
  const settings = getReminderSettings();

  if (!settings.enabled) return false;

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Check if it's a work day (Mon-Fri = 1-5)
  if (settings.workDaysOnly && (day === 0 || day === 6)) {
    return false;
  }

  // Check if it's around morning or evening reminder time (within 1 hour)
  const isNearMorning = Math.abs(hour - settings.morningReminderHour) <= 1;
  const isNearEvening = Math.abs(hour - settings.eveningReminderHour) <= 1;

  return isNearMorning || isNearEvening;
}

/**
 * Get the next scheduled reminder time
 */
export function getNextReminderTime(): Date | null {
  const settings = getReminderSettings();

  if (!settings.enabled) return null;

  const now = new Date();
  const today = new Date(now);

  // Try morning reminder today
  today.setHours(settings.morningReminderHour, 0, 0, 0);
  if (today > now) {
    if (!settings.workDaysOnly || (today.getDay() >= 1 && today.getDay() <= 5)) {
      return today;
    }
  }

  // Try evening reminder today
  today.setHours(settings.eveningReminderHour, 0, 0, 0);
  if (today > now) {
    if (!settings.workDaysOnly || (today.getDay() >= 1 && today.getDay() <= 5)) {
      return today;
    }
  }

  // Find next valid day
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(settings.morningReminderHour, 0, 0, 0);

  if (settings.workDaysOnly) {
    // Skip to Monday if it's Friday evening or weekend
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
  }

  return tomorrow;
}

// ============================================
// Helper Functions
// ============================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function extractSubscriptionData(
  subscription: PushSubscription
): PushSubscriptionData {
  const json = subscription.toJSON();

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: json.keys?.p256dh || "",
      auth: json.keys?.auth || "",
    },
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

// ============================================
// Push Reminder Orchestration
// ============================================

export interface PushReminderConfig {
  userId: string;
  vapidPublicKey: string;
  onPermissionDenied?: () => void;
  onSubscriptionFailed?: (error: Error) => void;
}

/**
 * Initialize push reminders for a user
 * Call this when the user enables auto-geofence on unsupported platforms
 */
export async function initializePushReminders(
  config: PushReminderConfig
): Promise<boolean> {
  const { userId, vapidPublicKey, onPermissionDenied, onSubscriptionFailed } = config;

  // Check if push is supported
  if (!isPushSupported()) {
    appLogger.info("Push not supported, skipping initialization");
    return false;
  }

  // Check/request permission
  let permission = getPushPermissionState();

  if (permission === "default") {
    permission = await requestPushPermission();
  }

  if (permission === "denied") {
    appLogger.warn("Push permission denied");
    onPermissionDenied?.();
    return false;
  }

  if (permission !== "granted") {
    return false;
  }

  // Subscribe to push
  try {
    const subscription = await subscribeToPush(vapidPublicKey);

    if (!subscription) {
      throw new Error("Failed to create push subscription");
    }

    // Save to Firebase for server-side push
    await savePushSubscriptionToFirebase(userId, subscription);

    appLogger.info("Push reminders initialized successfully");
    return true;
  } catch (error) {
    appLogger.error("Failed to initialize push reminders", { error });
    onSubscriptionFailed?.(error as Error);
    return false;
  }
}

/**
 * Cleanup push reminders for a user (e.g., on logout or disable)
 */
export async function cleanupPushReminders(userId: string): Promise<void> {
  try {
    await unsubscribeFromPush();
    await removePushSubscriptionFromFirebase(userId);
    appLogger.info("Push reminders cleaned up");
  } catch (error) {
    appLogger.error("Failed to cleanup push reminders", { error });
  }
}
