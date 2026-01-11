/**
 * PWA Capabilities Detection Module
 *
 * Detects browser capabilities for background geofencing and provides
 * appropriate fallback strategies based on platform support.
 *
 * Browser Support Matrix:
 * - Periodic Background Sync: Chrome 80+, Edge 80+, Samsung Internet 13+
 * - Background Sync (one-shot): Chrome 49+, Edge 79+, Firefox 44+
 * - Wake Lock: Chrome 84+, Edge 84+, partial Safari 16.4+
 * - Push Notifications: All modern browsers (Safari 16.4+ on iOS)
 * - Service Worker: All modern browsers
 */

import { appLogger } from "@/lib/logging/appLogger";

export interface PWACapabilities {
  periodicBackgroundSync: boolean;
  backgroundSync: boolean;
  wakeLock: boolean;
  pushNotifications: boolean;
  serviceWorkerActive: boolean;
  geolocation: boolean;
  notifications: boolean;
}

export type GeofenceStrategy =
  | "periodic-sync" // Best: Chrome/Edge with Periodic Background Sync
  | "visibility-wakelock" // Good: Safari iOS with Wake Lock
  | "visibility-polling" // Fallback: Firefox and others
  | "manual-only"; // Last resort: No background capability

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isSamsungInternet: boolean;
  isPWA: boolean;
}

export interface CapabilityReport {
  capabilities: PWACapabilities;
  platform: PlatformInfo;
  recommendedStrategy: GeofenceStrategy;
  fallbackStrategy: GeofenceStrategy | null;
  limitations: string[];
}

let cachedCapabilities: PWACapabilities | null = null;
let cachedPlatform: PlatformInfo | null = null;

/**
 * Detect platform/browser information
 */
export function detectPlatform(): PlatformInfo {
  if (cachedPlatform) return cachedPlatform;

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isIOS: false,
      isAndroid: false,
      isChrome: false,
      isFirefox: false,
      isSafari: false,
      isEdge: false,
      isSamsungInternet: false,
      isPWA: false,
    };
  }

  const ua = navigator.userAgent;
  const vendor = navigator.vendor || "";

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isAndroid = /Android/.test(ua);

  const isChrome =
    /Chrome/.test(ua) && /Google Inc/.test(vendor) && !/Edg/.test(ua);

  const isFirefox = /Firefox/.test(ua);

  const isSafari =
    /Safari/.test(ua) && /Apple Computer/.test(vendor) && !/Chrome/.test(ua);

  const isEdge = /Edg/.test(ua);

  const isSamsungInternet = /SamsungBrowser/.test(ua);

  // Check if running as installed PWA
  const isPWA =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://");

  cachedPlatform = {
    isIOS,
    isAndroid,
    isChrome,
    isFirefox,
    isSafari,
    isEdge,
    isSamsungInternet,
    isPWA,
  };

  return cachedPlatform;
}

/**
 * Detect all PWA capabilities
 */
export async function detectCapabilities(): Promise<PWACapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  if (typeof window === "undefined") {
    return {
      periodicBackgroundSync: false,
      backgroundSync: false,
      wakeLock: false,
      pushNotifications: false,
      serviceWorkerActive: false,
      geolocation: false,
      notifications: false,
    };
  }

  const hasServiceWorker = "serviceWorker" in navigator;
  let serviceWorkerActive = false;

  if (hasServiceWorker) {
    try {
      const registration = await navigator.serviceWorker.ready;
      serviceWorkerActive = !!registration.active;
    } catch {
      serviceWorkerActive = false;
    }
  }

  // Periodic Background Sync (Chrome/Edge only)
  const periodicBackgroundSync =
    hasServiceWorker &&
    "periodicSync" in ServiceWorkerRegistration.prototype;

  // One-shot Background Sync
  const backgroundSync =
    hasServiceWorker && "SyncManager" in window;

  // Wake Lock API
  const wakeLock = "wakeLock" in navigator;

  // Push Notifications (requires SW and PushManager)
  const pushNotifications =
    hasServiceWorker &&
    "PushManager" in window &&
    "Notification" in window;

  // Geolocation
  const geolocation = "geolocation" in navigator;

  // Notifications API
  const notifications = "Notification" in window;

  cachedCapabilities = {
    periodicBackgroundSync,
    backgroundSync,
    wakeLock,
    pushNotifications,
    serviceWorkerActive,
    geolocation,
    notifications,
  };

  appLogger.info(
    "PWA capabilities detected",
    cachedCapabilities as unknown as Record<string, unknown>
  );

  return cachedCapabilities;
}

/**
 * Determine the recommended geofence strategy based on capabilities
 */
export function determineGeofenceStrategy(
  capabilities: PWACapabilities,
  platform: PlatformInfo
): GeofenceStrategy {
  // Best case: Periodic Background Sync (Chrome Android, Edge, Samsung)
  if (
    capabilities.periodicBackgroundSync &&
    capabilities.serviceWorkerActive &&
    (platform.isChrome || platform.isEdge || platform.isSamsungInternet)
  ) {
    return "periodic-sync";
  }

  // iOS Safari: Use visibility change + Wake Lock
  if (platform.isIOS && platform.isSafari && capabilities.wakeLock) {
    return "visibility-wakelock";
  }

  // iOS Safari without Wake Lock: Still use visibility polling
  if (platform.isIOS) {
    return "visibility-polling";
  }

  // Android without Periodic Sync: Use visibility + wake lock if available
  if (platform.isAndroid && capabilities.wakeLock) {
    return "visibility-wakelock";
  }

  // Firefox and others: Visibility polling
  if (capabilities.geolocation) {
    return "visibility-polling";
  }

  // No geolocation support
  return "manual-only";
}

/**
 * Determine fallback strategy when primary fails
 */
export function determineFallbackStrategy(
  primaryStrategy: GeofenceStrategy,
  capabilities: PWACapabilities,
  _platform: PlatformInfo
): GeofenceStrategy | null {
  switch (primaryStrategy) {
    case "periodic-sync":
      // Fallback to visibility + wakelock or just visibility
      if (capabilities.wakeLock) {
        return "visibility-wakelock";
      }
      return "visibility-polling";

    case "visibility-wakelock":
      // Fallback to basic visibility polling
      return "visibility-polling";

    case "visibility-polling":
      // Can offer push notification reminders as supplemental
      // but no lower fallback for actual geofencing
      return "manual-only";

    case "manual-only":
      return null;

    default:
      return null;
  }
}

/**
 * Get human-readable limitations for the current platform
 */
export function getCapabilityLimitations(
  capabilities: PWACapabilities,
  platform: PlatformInfo
): string[] {
  const limitations: string[] = [];

  if (!capabilities.periodicBackgroundSync) {
    if (platform.isIOS) {
      limitations.push(
        "iOS does not support background location checks. Geofence detection only works when the app is open."
      );
    } else if (platform.isFirefox) {
      limitations.push(
        "Firefox does not support Periodic Background Sync. Geofence checks run when you open the app."
      );
    } else {
      limitations.push(
        "Your browser has limited background sync support. Install the app for better reliability."
      );
    }
  }

  if (!capabilities.wakeLock) {
    limitations.push(
      "Wake Lock not supported. The screen may dim during countdown timers."
    );
  }

  if (!capabilities.pushNotifications) {
    limitations.push(
      "Push notifications not available. You won't receive check-in/out reminders when away."
    );
  }

  if (!capabilities.serviceWorkerActive) {
    limitations.push(
      "Service worker not active. Offline functionality is limited."
    );
  }

  if (platform.isPWA) {
    // Running as PWA - fewer limitations
  } else {
    limitations.push(
      "Install this app to your home screen for the best experience and more reliable background checks."
    );
  }

  return limitations;
}

/**
 * Generate a comprehensive capability report
 */
export async function getCapabilityReport(): Promise<CapabilityReport> {
  const capabilities = await detectCapabilities();
  const platform = detectPlatform();
  const recommendedStrategy = determineGeofenceStrategy(capabilities, platform);
  const fallbackStrategy = determineFallbackStrategy(
    recommendedStrategy,
    capabilities,
    platform
  );
  const limitations = getCapabilityLimitations(capabilities, platform);

  const report: CapabilityReport = {
    capabilities,
    platform,
    recommendedStrategy,
    fallbackStrategy,
    limitations,
  };

  appLogger.info("Capability report generated", {
    strategy: recommendedStrategy,
    fallback: fallbackStrategy,
    platform: platform.isIOS
      ? "iOS"
      : platform.isAndroid
        ? "Android"
        : "Desktop",
    browser: platform.isChrome
      ? "Chrome"
      : platform.isSafari
        ? "Safari"
        : platform.isFirefox
          ? "Firefox"
          : platform.isEdge
            ? "Edge"
            : "Other",
  });

  return report;
}

/**
 * Check if push notification permission can be requested
 */
export async function canRequestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  // Already granted or denied - can't request again
  if (Notification.permission !== "default") {
    return false;
  }

  return true;
}

/**
 * Get current notification permission state
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Notifications not supported");
  }

  const permission = await Notification.requestPermission();
  appLogger.info("Notification permission result", { permission });
  return permission;
}

/**
 * Clear cached capabilities (useful for testing or after significant changes)
 */
export function clearCapabilityCache(): void {
  cachedCapabilities = null;
  cachedPlatform = null;
}

/**
 * Check if the app should suggest PWA installation
 */
export function shouldSuggestInstall(): boolean {
  const platform = detectPlatform();
  return !platform.isPWA && (platform.isIOS || platform.isAndroid);
}

/**
 * Get strategy-specific configuration
 */
export function getStrategyConfig(strategy: GeofenceStrategy): {
  pollIntervalMs: number;
  useWakeLock: boolean;
  usePushReminders: boolean;
  debouncePolls: number;
} {
  switch (strategy) {
    case "periodic-sync":
      return {
        pollIntervalMs: 60_000, // 1 minute when app is open
        useWakeLock: true,
        usePushReminders: false, // Background sync handles it
        debouncePolls: 2,
      };

    case "visibility-wakelock":
      return {
        pollIntervalMs: 30_000, // More frequent polling needed
        useWakeLock: true,
        usePushReminders: true, // Need reminders when app closed
        debouncePolls: 2,
      };

    case "visibility-polling":
      return {
        pollIntervalMs: 60_000,
        useWakeLock: false,
        usePushReminders: true,
        debouncePolls: 2,
      };

    case "manual-only":
      return {
        pollIntervalMs: 0, // No polling
        useWakeLock: false,
        usePushReminders: true, // Reminders are primary mechanism
        debouncePolls: 1,
      };
  }
}
