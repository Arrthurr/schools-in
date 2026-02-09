import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as webpush from "web-push";

// ============================================================================
// Configuration
// ============================================================================

export const PRODUCTION_CONFIG = {
  sessionTimeoutHours: 2,
  cleanupIntervalHours: 1,
  maxBatchSize: 500,
  performanceThresholds: {
    queryTimeMs: 1000,
    batchTimeMs: 5000,
  },
};

export const SESSION_LIMIT_MS =
  PRODUCTION_CONFIG.sessionTimeoutHours * 60 * 60 * 1000;

// Grace period for recently-synced offline sessions (15 minutes)
export const RECENTLY_CREATED_GRACE_MS = 15 * 60 * 1000;

export const DEFAULT_ADMIN_GROUP_NAME = "DMDL Office";

// ============================================================================
// Types
// ============================================================================

export interface M365Group {
  id: string;
  displayName: string;
}

export interface SyncResult {
  role: "admin" | "provider";
  assignedLocations: Array<{ id: string; name: string }>;
  removedLocations: Array<{ id: string; name: string }>;
  groupsFound: string[];
  alreadySynced?: boolean;
}

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  platform: string;
  userAgent: string;
}

// ============================================================================
// Pure utility functions
// ============================================================================

/**
 * Get admin group configuration from environment variables
 */
export function getAdminGroupConfig() {
  return {
    adminGroupId: process.env.DMDL_OFFICE_GROUP_ID?.toLowerCase(),
    adminGroupName: (
      process.env.DMDL_OFFICE_GROUP_NAME || DEFAULT_ADMIN_GROUP_NAME
    ).toLowerCase(),
  };
}

/**
 * Determine if a Microsoft 365 group is the admin group
 */
export function isAdminGroup(group: M365Group): boolean {
  const { adminGroupId, adminGroupName } = getAdminGroupConfig();
  const byId = adminGroupId && group.id?.toLowerCase() === adminGroupId;
  const byName =
    group.displayName && group.displayName.toLowerCase() === adminGroupName;
  return Boolean(byId || byName);
}

/**
 * Validate that request has authentication and return user info
 */
export function requireAuth(request: any): { uid: string; email: string } {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }
  const emailFromData =
    typeof data?.email === "string" ? data.email.trim() : undefined;
  const email = emailFromData || auth.token.email;
  if (!email) {
    throw new HttpsError(
      "failed-precondition",
      "User email not available in authentication token"
    );
  }
  return { uid: auth.uid, email };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// Push notification helpers
// ============================================================================

/**
 * Initialize web-push with VAPID keys from environment
 * @returns true if push is configured and ready
 */
export function initializeWebPush(): boolean {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  let vapidEmail = (
    process.env.VAPID_EMAIL || "mailto:admin@schools-in-check.web.app"
  ).trim();

  if (!vapidEmail) {
    logger.warn(
      "VAPID email not configured. Push notifications will not work."
    );
    return false;
  }

  const vapidEmailLower = vapidEmail.toLowerCase();
  if (
    !vapidEmailLower.startsWith("mailto:") &&
    !vapidEmailLower.startsWith("https://")
  ) {
    if (vapidEmail.includes("@")) {
      vapidEmail = `mailto:${vapidEmail}`;
    } else {
      logger.warn(
        "VAPID email is not a valid URL or email. Push notifications will not work."
      );
      return false;
    }
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn("VAPID keys not configured. Push notifications will not work.");
    return false;
  }

  try {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
    return true;
  } catch (error) {
    logger.warn(
      "Invalid VAPID configuration. Push notifications will not work.",
      { error }
    );
    return false;
  }
}

/**
 * Send a push notification to a specific subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: { title: string; body: string; data?: Record<string, any> }
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        tag: "schools-in-notification",
        requireInteraction: true,
        data: payload.data || {},
      })
    );

    return true;
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      logger.info("Push subscription expired or invalid", {
        endpoint: subscription.endpoint,
      });
      return false;
    }
    logger.error("Failed to send push notification", { error });
    return false;
  }
}

/**
 * Acquire an app-only access token from Microsoft Identity Platform
 * using client credentials flow
 */
export async function getM365AccessToken(): Promise<string> {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new HttpsError(
      "failed-precondition",
      "Microsoft 365 configuration missing. Ensure MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET are set."
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Failed to acquire M365 access token:", errorText);
    throw new HttpsError(
      "internal",
      `Failed to acquire M365 access token: ${response.status}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch all groups a user is a member of from Microsoft Graph
 */
export async function getUserM365Groups(
  accessToken: string,
  userEmail: string
): Promise<M365Group[]> {
  const groups: M365Group[] = [];

  let url: string | null = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    userEmail
  )}/memberOf?$select=id,displayName&$top=100`;

  while (url) {
    const response: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to fetch user groups for ${userEmail}:`, errorText);
      throw new HttpsError(
        "internal",
        `Failed to fetch user groups: ${response.status}`
      );
    }

    const data: any = await response.json();

    for (const item of data.value || []) {
      if (
        item["@odata.type"] === "#microsoft.graph.group" &&
        item.displayName
      ) {
        groups.push({
          id: item.id,
          displayName: item.displayName,
        });
      }
    }

    url = data["@odata.nextLink"] || null;
  }

  return groups;
}
