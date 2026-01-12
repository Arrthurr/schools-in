import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as webpush from "web-push";

admin.initializeApp();

// ============================================================================
// Microsoft 365 Group Sync Configuration
// ============================================================================
// These values should be set via Firebase Functions config or environment secrets:
// firebase functions:secrets:set MS_TENANT_ID
// firebase functions:secrets:set MS_CLIENT_ID
// firebase functions:secrets:set MS_CLIENT_SECRET
// firebase functions:secrets:set DMDL_OFFICE_GROUP_ID (optional, preferred)
// firebase functions:secrets:set DMDL_OFFICE_GROUP_NAME (default: "DMDL Office")
// ============================================================================

const DEFAULT_ADMIN_GROUP_NAME = "DMDL Office";

interface M365Group {
  id: string;
  displayName: string;
}

interface SyncResult {
  role: "admin" | "provider";
  assignedLocations: Array<{ id: string; name: string }>;
  removedLocations: Array<{ id: string; name: string }>;
  groupsFound: string[];
  alreadySynced?: boolean;
}

function getAdminGroupConfig() {
  return {
    adminGroupId: process.env.DMDL_OFFICE_GROUP_ID?.toLowerCase(),
    adminGroupName: (process.env.DMDL_OFFICE_GROUP_NAME ||
      DEFAULT_ADMIN_GROUP_NAME).toLowerCase(),
  };
}

function isAdminGroup(group: M365Group): boolean {
  const { adminGroupId, adminGroupName } = getAdminGroupConfig();
  const byId = adminGroupId && group.id?.toLowerCase() === adminGroupId;
  const byName =
    group.displayName && group.displayName.toLowerCase() === adminGroupName;
  return Boolean(byId || byName);
}

function requireAuth(request: any): { uid: string; email: string } {
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
 * Acquire an app-only access token from Microsoft Identity Platform
 * using client credentials flow
 */
async function getM365AccessToken(): Promise<string> {
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
async function getUserM365Groups(
  accessToken: string,
  userEmail: string
): Promise<M365Group[]> {
  const groups: M365Group[] = [];

  // Use the user's email (UPN) to query their group membership
  let url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    userEmail
  )}/memberOf?$select=id,displayName&$top=100`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
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

    const data = await response.json();

    // Filter to only include groups (not other directory objects like roles)
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

    // Handle pagination
    url = data["@odata.nextLink"] || null;
  }

  return groups;
}

/**
 * Sync user role and school assignments from Microsoft 365 groups
 *
 * This callable function:
 * 1. Fetches the user's M365 group memberships
 * 2. Determines if user is admin (member of DMDL Office) or provider
 * 3. Matches school groups to Firestore locations by exact name match
 * 4. Updates the user's role in Firestore
 * 5. Updates locations.assignedProviders for matched schools
 * 6. Removes user from locations they're no longer assigned to
 */
exports.syncUserFromM365 = onCall(
  {
    secrets: [
      "MS_TENANT_ID",
      "MS_CLIENT_ID",
      "MS_CLIENT_SECRET",
      "DMDL_OFFICE_GROUP_ID",
      "DMDL_OFFICE_GROUP_NAME",
    ],
  },
  async (request: any): Promise<SyncResult> => {
    const { uid: userId, email: userEmail } = requireAuth(request);
    const db = admin.firestore();
    const userRef = db.collection("users").doc(userId);

    const forceFlag = Boolean(request?.data?.force);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const hasSynced = Boolean(userData?.m365SyncedAt);
    const resyncRequested = Boolean(userData?.m365ResyncRequestedAt);
    const shouldSync = forceFlag || resyncRequested || !hasSynced;

    if (forceFlag) {
      logger.info(`Force flag set for M365 sync for user ${userEmail} (${userId}).`);
    } else if (resyncRequested) {
      logger.info(
        `Resync requested flag detected for user ${userEmail} (${userId}). Proceeding with full sync.`
      );
    }

    if (!shouldSync) {
      const role: "admin" | "provider" = userData?.role === "admin" ? "admin" : "provider";
      logger.info(
        `Skipping M365 sync for user ${userEmail} (${userId}) – already synced and no resync requested.`
      );
      return {
        role,
        assignedLocations: [],
        removedLocations: [],
        groupsFound: [],
        alreadySynced: true,
      };
    }

    logger.info(`Starting M365 sync for user: ${userEmail} (${userId})`);

    try {
      // Step 1: Get M365 access token
      const accessToken = await getM365AccessToken();

      // Step 2: Fetch user's group memberships
      const userGroups = await getUserM365Groups(accessToken, userEmail);
      const groupNames = userGroups.map((g) => g.displayName);

      logger.info(
        `User ${userEmail} is member of ${userGroups.length} groups:`,
        groupNames
      );

      // Step 3: Determine role based on DMDL Office membership
      const isAdmin = userGroups.some(isAdminGroup);
      const role: "admin" | "provider" = isAdmin ? "admin" : "provider";

      logger.info(`User ${userEmail} role determined: ${role}`);

      // Step 4: Update or create user document with role
      await userRef.set(
        {
          role,
          updatedAt: admin.firestore.Timestamp.now(),
          email: userEmail,
        },
        { merge: true }
      );

      // Step 5: Match groups to Firestore locations (for providers only)
      // Admins don't need school assignments as they have access to all
      const assignedLocations: Array<{ id: string; name: string }> = [];
      const removedLocations: Array<{ id: string; name: string }> = [];

      if (role === "provider") {
        // Get all active locations from Firestore
        const locationsSnapshot = await db
          .collection("locations")
          .where("active", "==", true)
          .get();

        const allLocations = locationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: (doc.data().name as string) || "",
          assignedProviders: (doc.data().assignedProviders || []) as string[],
        }));

        // Filter out admin group from matching
        const schoolGroups = userGroups.filter((group) => !isAdminGroup(group));
        const schoolGroupNames = schoolGroups.map((g) => g.displayName);

        // Find locations that match user's school groups (exact name match)
        const matchedLocations = allLocations.filter((loc) =>
          schoolGroupNames.some(
            (groupName) => groupName.toLowerCase() === loc.name.toLowerCase()
          )
        );

        const matchedLocationIds = new Set(matchedLocations.map((l) => l.id));

        // Find locations user is currently assigned to
        const currentlyAssignedLocations = allLocations.filter((loc) =>
          loc.assignedProviders.includes(userId)
        );

        // Add user to newly matched locations
        for (const location of matchedLocations) {
          if (!location.assignedProviders.includes(userId)) {
            await db
              .collection("locations")
              .doc(location.id)
              .update({
                assignedProviders: admin.firestore.FieldValue.arrayUnion(userId),
                updatedAt: admin.firestore.Timestamp.now(),
              });
            logger.info(`Added user ${userId} to location: ${location.name}`);
          }
          assignedLocations.push({ id: location.id, name: location.name });
        }

        // Remove user from locations they're no longer in groups for
        for (const location of currentlyAssignedLocations) {
          if (!matchedLocationIds.has(location.id)) {
            await db
              .collection("locations")
              .doc(location.id)
              .update({
                assignedProviders: admin.firestore.FieldValue.arrayRemove(userId),
                updatedAt: admin.firestore.Timestamp.now(),
              });
            logger.info(`Removed user ${userId} from location: ${location.name}`);
            removedLocations.push({ id: location.id, name: location.name });
          }
        }
      }

      const result: SyncResult = {
        role,
        assignedLocations,
        removedLocations,
        groupsFound: groupNames,
      };

      await userRef.set(
        {
          m365SyncedAt: admin.firestore.Timestamp.now(),
          m365SyncedVersion: 1,
          m365ResyncRequestedAt: admin.firestore.FieldValue.delete(),
          m365ResyncReason: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true }
      );

      logger.info(`M365 sync completed for user ${userEmail}:`, result);

      return result;
    } catch (error) {
      logger.error(`M365 sync failed for user ${userEmail}:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        `Failed to sync user from Microsoft 365: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);

exports.requestM365Resync = onCall(async (request: any) => {
  const { uid: userId, email } = requireAuth(request);
  const db = admin.firestore();
  const userRef = db.collection("users").doc(userId);

  const reason = typeof request?.data?.reason === "string" ?
    request.data.reason.trim().slice(0, 500) :
    undefined;

  await userRef.set(
    {
      m365ResyncRequestedAt: admin.firestore.Timestamp.now(),
      m365ResyncReason: reason || admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now(),
      email,
    },
    { merge: true }
  );

  logger.info(`Resync requested for user ${email} (${userId})`);

  return { success: true };
});

// Production configuration
const _PRODUCTION_CONFIG = {
  sessionTimeoutHours: 2,
  cleanupIntervalHours: 1,
  maxBatchSize: 500,
  performanceThresholds: {
    queryTimeMs: 1000,
    batchTimeMs: 5000,
  },
};

const sessionLimitInMs =
  _PRODUCTION_CONFIG.sessionTimeoutHours * 60 * 60 * 1000;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
function calculateDistance(
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

// Callable function to start a session with atomic checks
// Supports role-based check-in methods:
// - Providers: checkInMethod must be 'geo' or 'offline-sync' (auto check-in)
// - Admins: checkInMethod must be 'manual' (manual check-in with GPS + in-radius enforcement)
exports.startSession = onCall(async (request: any) => {
  try {
    const { data, auth } = request;

    // Authentication check
    if (!auth) {
      throw new Error("Authentication required");
    }

    // Validate input data
    if (
      !data ||
      !data.locationId ||
      !data.startTime ||
      !data.checkInMethod ||
      !data.dayKey
    ) {
      throw new Error(
        "Missing required session data: locationId, startTime, checkInMethod, dayKey"
      );
    }

    // Validate checkInMethod
    const validMethods = ["geo", "manual", "offline-sync"];
    if (!validMethods.includes(data.checkInMethod)) {
      throw new Error(
        `Invalid checkInMethod: ${data.checkInMethod}. Must be one of: ${validMethods.join(", ")}`
      );
    }

    const db = admin.firestore();
    const userId = auth.uid;

    // Use a transaction to atomically check for existing active sessions and create new one
    const result = await db.runTransaction(async (transaction: any) => {
      // Check if user exists and is active
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      const userRole = userData.role as "provider" | "admin";

      // Validate role-based checkInMethod
      if (userRole === "provider") {
        // Providers can only use geo or offline-sync (automatic check-in)
        if (data.checkInMethod === "manual") {
          throw new Error(
            "Providers cannot use manual check-in. Automatic check-in is enabled for your account."
          );
        }
      } else if (userRole === "admin") {
        // Admins can only use manual check-in
        if (data.checkInMethod !== "manual") {
          throw new Error(
            "Admins must use manual check-in method."
          );
        }
      } else {
        throw new Error("Invalid user role for session creation");
      }

      if (userData.isActive === false || userData.disabled === true) {
        throw new Error("User account is not active");
      }

      // Check for existing active or paused sessions for this user
      const existingSessionsQuery = db
        .collection("sessions")
        .where("userId", "==", userId)
        .where("status", "in", ["active", "paused"]);

      const existingSessionsSnapshot = await transaction.get(
        existingSessionsQuery
      );

      if (!existingSessionsSnapshot.empty) {
        const existingSession = existingSessionsSnapshot.docs[0];
        throw new Error(
          `User already has an ${existingSession.data().status} session: ${
            existingSession.id
          }`
        );
      }

      // Verify the location exists
      const locationRef = db.collection("locations").doc(data.locationId);
      const locationDoc = await transaction.get(locationRef);

      if (!locationDoc.exists) {
        throw new Error("Location not found");
      }

      const locationData = locationDoc.data();
      if (locationData.active === false) {
        throw new Error("Location is not active");
      }

      // Role-based location access check
      if (userRole === "provider") {
        // Check if provider is assigned to this location
        if (
          !locationData.assignedProviders ||
          !locationData.assignedProviders.includes(userId)
        ) {
          throw new Error("Provider is not assigned to this location");
        }
      }
      // Admins can access any location (no assignment check needed)

      // Calculate distance from center and enforce geofence for both roles
      let distanceFromCenter = data.distanceFromCenterAtCheckIn || 0;
      const radiusMeters = locationData.radiusMeters || 100;

      // If checkInLocation is provided, calculate distance server-side
      if (
        data.checkInLocation &&
        typeof data.checkInLocation.latitude === "number" &&
        typeof data.checkInLocation.longitude === "number" &&
        locationData.geo
      ) {
        const locGeo = locationData.geo;
        distanceFromCenter = calculateDistance(
          data.checkInLocation.latitude,
          data.checkInLocation.longitude,
          locGeo.latitude,
          locGeo.longitude
        );

        // Enforce geofence - must be within radius
        if (distanceFromCenter > radiusMeters) {
          throw new Error(
            `You must be within ${radiusMeters}m of the location to check in. Current distance: ${Math.round(distanceFromCenter)}m`
          );
        }

        logger.info("Server-side geofence validation passed", {
          userId,
          locationId: data.locationId,
          distance: Math.round(distanceFromCenter),
          radiusMeters,
        });
      } else if (userRole === "admin" && data.checkInMethod === "manual") {
        // For admin manual check-in, checkInLocation is required
        throw new Error(
          "Admin manual check-in requires checkInLocation with latitude and longitude"
        );
      }

      // Create the new session document
      const sessionData: { [key: string]: any } = {
        id: null, // Will be set after creation
        userId: userId,
        locationId: data.locationId,
        startTime: admin.firestore.Timestamp.fromDate(new Date(data.startTime)),
        checkInTime: admin.firestore.Timestamp.fromDate(
          new Date(data.startTime)
        ),
        endTime: null,
        status: "active",
        active: true,
        checkInMethod: data.checkInMethod,
        distanceFromCenterAtCheckIn: Math.round(distanceFromCenter),
        dayKey: data.dayKey,
        notes: data.notes || "",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      // Store check-in location if provided
      if (data.checkInLocation) {
        sessionData.checkInLocation = {
          latitude: data.checkInLocation.latitude,
          longitude: data.checkInLocation.longitude,
          accuracy: data.checkInLocation.accuracy || null,
        };
      }

      // Add optional fields if provided
      if (data.durationMinutes !== undefined) {
        sessionData.durationMinutes = data.durationMinutes;
      }

      const sessionRef = db.collection("sessions").doc();
      sessionData.id = sessionRef.id;

      transaction.set(sessionRef, sessionData);

      // Update user's last activity
      transaction.update(userRef, {
        lastActiveAt: admin.firestore.Timestamp.now(),
      });

      return {
        sessionId: sessionRef.id,
        sessionData: sessionData,
      };
    });

    logger.info(
      `Session started successfully for user ${userId}: ${result.sessionId}`
    );

    return {
      success: true,
      sessionId: result.sessionId,
      session: result.sessionData,
    };
  } catch (error) {
    logger.error("Error starting session:", error);

    // Return user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("already has an")) {
        throw new Error(
          "You already have an active session. Please end your current session before starting a new one."
        );
      } else if (error.message.includes("not assigned")) {
        throw new Error("You are not authorized to check in at this location.");
      } else if (error.message.includes("not active")) {
        throw new Error("This location is currently unavailable for check-in.");
      } else if (error.message.includes("User not found")) {
        throw new Error("User account not found. Please contact support.");
      } else if (error.message.includes("must be within")) {
        throw error; // Preserve geofence error message
      } else if (error.message.includes("Providers cannot use manual")) {
        throw error; // Preserve role-based method error
      } else if (error.message.includes("Admins must use manual")) {
        throw error; // Preserve role-based method error
      } else if (error.message.includes("requires checkInLocation")) {
        throw error; // Preserve location requirement error
      } else if (error.message.includes("Missing required")) {
        throw new Error("Invalid session data provided.");
      }
    }

    throw new Error("Failed to start session. Please try again.");
  }
});

/**
 * Callable function to end a session with server-side validation
 */
exports.endSession = onCall(async (request: any) => {
  try {
    const { data, auth } = request;

    if (!auth) {
      throw new Error("Authentication required");
    }

    if (!data?.sessionId || !data?.checkOutTime) {
      throw new Error("Missing required session data: sessionId, checkOutTime");
    }

    const db = admin.firestore();
    const userId = auth.uid;

    const result = await db.runTransaction(async (transaction: any) => {
      const sessionRef = db.collection("sessions").doc(data.sessionId);
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data();

      if (sessionData.userId !== userId) {
        throw new Error("You are not authorized to end this session.");
      }

      if (!["active", "paused"].includes(sessionData.status)) {
        throw new Error("Session is not active.");
      }

      const startTime = sessionData.startTime || sessionData.checkInTime;
      if (!startTime) {
        throw new Error("Session missing start time");
      }

      const checkOutTimestamp = admin.firestore.Timestamp.fromDate(
        new Date(data.checkOutTime)
      );
      const durationMinutes = Math.max(
        0,
        Math.floor(
          (checkOutTimestamp.toMillis() - startTime.toMillis()) / (1000 * 60)
        )
      );

      const updateData: Record<string, any> = {
        endTime: checkOutTimestamp,
        checkOutTime: checkOutTimestamp,
        status: "completed",
        active: false,
        durationMinutes,
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (data.checkOutLocation) {
        updateData.checkOutLocation = {
          latitude: data.checkOutLocation.latitude,
          longitude: data.checkOutLocation.longitude,
          accuracy: data.checkOutLocation.accuracy || null,
        };

        if (sessionData.geo) {
          updateData.distanceFromCenterAtCheckOut = Math.round(
            calculateDistance(
              data.checkOutLocation.latitude,
              data.checkOutLocation.longitude,
              sessionData.geo.latitude,
              sessionData.geo.longitude
            )
          );
        }
      }

      if (
        updateData.distanceFromCenterAtCheckOut === undefined &&
        typeof data.distanceFromCenterAtCheckOut === "number"
      ) {
        updateData.distanceFromCenterAtCheckOut = Math.round(
          data.distanceFromCenterAtCheckOut
        );
      }

      transaction.update(sessionRef, updateData);

      transaction.update(db.collection("users").doc(userId), {
        lastActiveAt: admin.firestore.Timestamp.now(),
      });

      return updateData;
    });

    logger.info(`Session ended successfully for user ${userId}: ${data.sessionId}`);

    return {
      success: true,
      sessionId: data.sessionId,
      sessionUpdates: result,
    };
  } catch (error) {
    logger.error("Error ending session:", error);
    throw error instanceof Error ? error : new Error("Failed to end session");
  }
});

exports.cleanupStaleSessions = onSchedule(
  {
    schedule: "every 15 minutes",
    secrets: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"],
  },
  async (_event: any) => {
    try {
      const db = admin.firestore();
      const sessionsRef = db.collection("sessions");

      const now = admin.firestore.Timestamp.now();
      const cutoff = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - sessionLimitInMs
      );

      const staleSessionsQuery = sessionsRef
        .where("status", "in", ["active", "paused"])
        .where("checkInTime", "<", cutoff)
        .limit(_PRODUCTION_CONFIG.maxBatchSize);

      const staleSessionsSnapshot = await staleSessionsQuery.get();

      if (staleSessionsSnapshot.empty) {
        logger.info("No stale sessions found.");
        return;
      }

      const batch = db.batch();
      const durationMinutes = Math.floor(sessionLimitInMs / 60000);
      const updateTime = admin.firestore.Timestamp.now();
      const staleSessionIds: string[] = [];

      staleSessionsSnapshot.forEach((doc: any) => {
        logger.info(`Found stale session: ${doc.id}`);
        staleSessionIds.push(doc.id);
        const sessionRef = sessionsRef.doc(doc.id);
        batch.update(sessionRef, {
          status: "error",
          active: false, // Ensures legacy listener drops the session
          endTime: cutoff, // Primary end time field
          checkOutTime: cutoff, // Legacy compatibility
          durationMinutes: durationMinutes, // Max duration in minutes
          notes: "Session automatically closed due to timeout.",
          updatedAt: updateTime, // Track update time
          errorCode: "timeout_auto_close",
          needsAdminReview: true,
          adminReviewStatus: "unreviewed",
          adminReviewedAt: admin.firestore.FieldValue.delete(),
          adminReviewedBy: admin.firestore.FieldValue.delete(),
        });
      });

      await batch.commit();
      logger.info(`Cleaned up ${staleSessionsSnapshot.size} stale sessions.`);

      // Track cleanup metrics
      const metrics = {
        cleanedSessions: staleSessionsSnapshot.size,
        timestamp: admin.firestore.Timestamp.now(),
        type: "session_cleanup",
      };

      await db
        .collection("system")
        .doc("cleanup_metrics")
        .set(metrics, { merge: true });

      // Persist an alert record for auditability
      const alertSessionIds = staleSessionIds.slice(0, 50); // cap payload size
      await db
        .collection("system")
        .doc("adminAlerts")
        .collection("events")
        .add({
          type: "session-timeout",
          createdAt: admin.firestore.Timestamp.now(),
          count: staleSessionIds.length,
          sessionIds: alertSessionIds,
          status: "unread",
        });

      // Notify subscribed admins via push
      if (initializeWebPush()) {
        const adminsSnapshot = await db
          .collection("users")
          .where("role", "==", "admin")
          .get();

        if (!adminsSnapshot.empty) {
          let sent = 0;
          let failed = 0;
          let missing = 0;

          for (const adminDoc of adminsSnapshot.docs) {
            const subscriptionDoc = await db
              .collection("users")
              .doc(adminDoc.id)
              .collection("pushSubscriptions")
              .doc("adminAlerts")
              .get();

            if (!subscriptionDoc.exists) {
              missing++;
              continue;
            }

            const subscription = subscriptionDoc.data() as PushSubscription;
            const success = await sendPushNotification(subscription, {
              title: "Session auto-closed (timeout)",
              body: `${staleSessionIds.length} session(s) were auto-closed and need review.`,
              data: {
                type: "session-timeout",
                count: staleSessionIds.length,
              },
            });

            if (success) {
              sent++;
            } else {
              failed++;
              await subscriptionDoc.ref.delete();
            }
          }

          logger.info("Admin timeout alerts dispatched", {
            sent,
            failed,
            missing,
          });
        }
      } else {
        logger.warn("Skipping admin push alerts - VAPID not configured");
      }
    } catch (error) {
      logger.error("Error cleaning up stale sessions:", error);
      logger.error("Error occurred:", error);
      throw error; // Re-throw for proper error tracking
    }
  }
);

// Daily statistics aggregation
exports.generateDailyStats = onSchedule(
  "every day 02:00",
  async (_event: any) => {
    try {
      const db = admin.firestore();
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const startOfDay = admin.firestore.Timestamp.fromDate(
        new Date(yesterday.setHours(0, 0, 0, 0))
      );
      const endOfDay = admin.firestore.Timestamp.fromDate(
        new Date(yesterday.setHours(23, 59, 59, 999))
      );

      // Aggregate session statistics
      const sessionsQuery = db
        .collection("sessions")
        .where("startTime", ">=", startOfDay)
        .where("startTime", "<=", endOfDay);

      const sessionsSnapshot = await sessionsQuery.get();

      const sessionStats: { [key: string]: any } = {
        date: admin.firestore.Timestamp.fromDate(yesterday),
        totalSessions: sessionsSnapshot.size,
        completedSessions: 0,
        averageDuration: 0,
        byLocation: {},
        byProvider: {},
      };

      let totalDuration = 0;

      sessionsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data.status === "completed") {
          sessionStats.completedSessions++;
          if (data.startTime && data.endTime) {
            const duration =
              data.endTime.toMillis() - data.startTime.toMillis();
            totalDuration += duration;
          }
        }

        // Track by location
        if (data.locationId) {
          sessionStats.byLocation[data.locationId] =
            (sessionStats.byLocation[data.locationId] || 0) + 1;
        }

        // Track by provider
        if (data.userId) {
          sessionStats.byProvider[data.userId] =
            (sessionStats.byProvider[data.userId] || 0) + 1;
        }
      });

      if (sessionStats.completedSessions > 0) {
        sessionStats.averageDuration =
          totalDuration / sessionStats.completedSessions;
      }

      // Store daily statistics
      await db
        .collection("system")
        .doc(`daily_stats_${yesterday.toISOString().split("T")[0]}`)
        .set(sessionStats);

      logger.info("Daily statistics generated:", sessionStats);
    } catch (error) {
      logger.error("Error generating daily statistics:", error);
      logger.error("Error occurred:", error);
      throw error;
    }
  }
);

// Cache performance monitoring

exports.trackCachePerformance = onCall(async (request: any) => {
  try {
    const { data } = request;

    const db = admin.firestore();

    // Validate request data

    if (!data || typeof data !== "object") {
      throw new Error("Invalid cache performance data");
    }

    const cacheMetrics = {
      ...data,

      timestamp: admin.firestore.Timestamp.now(),

      source: "client",
    };

    // Store cache performance metrics

    await db.collection("cache_stats").add(cacheMetrics);

    return { success: true, timestamp: cacheMetrics.timestamp };
  } catch (error) {
    logger.error("Error tracking cache performance:", error);

    logger.error("Error occurred:", error);

    throw error;
  }
});

// Health check endpoint

exports.healthCheck = onCall(async (_request: any) => {
  try {
    const db = admin.firestore();

    // Perform basic connectivity tests

    const checks = {
      firestore: false,

      auth: false,

      storage: false,

      timestamp: admin.firestore.Timestamp.now(),
    };

    // Test Firestore connectivity

    try {
      await db.collection("system").doc("health_check").set({
        test: true,

        timestamp: admin.firestore.Timestamp.now(),
      });

      checks.firestore = true;
    } catch (error) {
      logger.warn("Firestore health check failed:", error);
    }

    // Test Auth connectivity

    try {
      await admin.auth().listUsers(1);

      checks.auth = true;
    } catch (error) {
      logger.warn("Auth health check failed:", error);
    }

    // Test Storage connectivity

    try {
      const bucket = admin.storage().bucket();

      await bucket.exists();

      checks.storage = true;
    } catch (error) {
      logger.warn("Storage health check failed:", error);
    }

    const allHealthy = Object.values(checks)

      .filter((v) => typeof v === "boolean")

      .every(Boolean);

    return {
      status: allHealthy ? "healthy" : "degraded",

      checks,

      version: "1.0.0",
    };
  } catch (error) {
    logger.error("Health check failed:", error);

    logger.error("Error occurred:", error);

    return {
      status: "error",

      error: (error as Error).message,

      timestamp: admin.firestore.Timestamp.now(),
    };
  }
});

// User activity tracking

exports.trackUserActivity = onCall(async (request: any) => {
  try {
    const { data, auth } = request;

    if (!auth) {
      throw new Error("Authentication required");
    }

    const db = admin.firestore();

    // Update user's last activity

    await db

      .collection("users")

      .doc(auth.uid)

      .update({
        lastActiveAt: admin.firestore.Timestamp.now(),

        lastActivityType: data.activityType || "unknown",
      });

    // Track activity in system collection for analytics

    await db

      .collection("system")
      .doc("analytics")
      .collection("user_activity")

      .add({
        userId: auth.uid,

        activityType: data.activityType,

        metadata: data.metadata || {},

        timestamp: admin.firestore.Timestamp.now(),
      });

    return { success: true };
  } catch (error) {
    logger.error("Error tracking user activity:", error);

    logger.error("Error occurred:", error);

    throw error;
  }
});

// Notify on new feedback

exports.notifyOnFeedback = onDocumentCreated(
  "feedback/{feedbackId}",
  async (event: any) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.warn("Feedback snapshot is null, skipping notification");
      return;
    }

    const feedback = snapshot.data();
    const feedbackId = event.params.feedbackId;

    logger.info(`New feedback received: ${feedbackId}`, feedback);

    // Get configuration from environment variables
    const adminEmail =
      process.env.ADMIN_EMAIL || "admin@schools-in-check.web.app";
    const baseUrl = process.env.BASE_URL || "https://schools-in-check.web.app";

    // Email configuration - supports multiple providers
    const emailConfig = {
      // Option 1: SendGrid (recommended for production)
      sendGridApiKey: process.env.SENDGRID_API_KEY,

      // Option 2: SMTP (Gmail, custom SMTP server)
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || "587"),
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
      smtpFrom: process.env.SMTP_FROM || adminEmail,
    };

    const emailSubject = `New Feedback: ${feedback.category} - ${feedback.severity}`;
    const feedbackUrl = `${baseUrl}/admin/feedback/${feedbackId}`;

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; 
          border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; 
          text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; color: #374151; }
        .description { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Feedback Received</h2>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">From:</span> ${
  feedback.providerName || "Unknown"
} 
            (${feedback.providerEmail || "No email"})
          </div>
          <div class="info-row">
            <span class="label">Category:</span> ${feedback.category}
          </div>
          <div class="info-row">
            <span class="label">Severity:</span> ${feedback.severity}
          </div>
          ${
  feedback.url ?
    `<div class="info-row"><span class="label">URL:</span> ${feedback.url}</div>` :
    ""
}
          <div class="description">
            <strong>Description:</strong><br>
            ${feedback.description.replace(/\n/g, "<br>")}
          </div>
          <a href="${feedbackUrl}" class="button">View in Admin Console</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from Schools-In Feedback System</p>
        </div>
      </div>
    </body>
    </html>
  `;

    const emailText = `
New feedback received from ${feedback.providerName || "Unknown"} (${
  feedback.providerEmail || "No email"
}).

Category: ${feedback.category}
Severity: ${feedback.severity}
${feedback.url ? `URL: ${feedback.url}\n` : ""}
Description:
${feedback.description}

View in Admin Console: ${feedbackUrl}
  `.trim();

    try {
      // Use SendGrid SMTP if API key is configured (SendGrid SMTP relay)
      if (emailConfig.sendGridApiKey) {
        // const nodemailer = require("nodemailer"); // Imported at top

        const transporter = nodemailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          secure: false,
          auth: {
            user: "apikey",
            pass: emailConfig.sendGridApiKey,
          },
        });

        await transporter.sendMail({
          from: emailConfig.smtpFrom,
          to: adminEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });

        logger.info(
          `Email sent via SendGrid SMTP to ${adminEmail} for feedback ${feedbackId}`
        );
        return;
      }

      // Fallback to custom SMTP if configured
      if (
        emailConfig.smtpHost &&
        emailConfig.smtpUser &&
        emailConfig.smtpPassword
      ) {
        // const nodemailer = require("nodemailer"); // Imported at top

        const transporter = nodemailer.createTransport({
          host: emailConfig.smtpHost,
          port: emailConfig.smtpPort,
          secure: emailConfig.smtpPort === 465,
          auth: {
            user: emailConfig.smtpUser,
            pass: emailConfig.smtpPassword,
          },
        });

        await transporter.sendMail({
          from: emailConfig.smtpFrom,
          to: adminEmail,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });

        logger.info(
          `Email sent via SMTP to ${adminEmail} for feedback ${feedbackId}`
        );
        return;
      }

      // If no email provider is configured, log the email payload
      logger.warn(
        "No email provider configured. Email notification not sent.",
        {
          to: adminEmail,
          subject: emailSubject,
          feedbackId,
        }
      );

      // Log the email payload for manual sending or debugging
      logger.info("Email notification payload (not sent):", {
        to: adminEmail,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });
    } catch (error) {
      logger.error("Error sending feedback notification email:", error);
      // Don't throw - we don't want to fail the feedback creation if email fails
      // The feedback is already saved, email is just a notification
    }
  }
);

// ============================================================================
// Push Notification Functions for Geofence Reminders
// ============================================================================
// These functions send push notifications to users who have subscribed
// for geofence check-in/out reminders (for platforms without background sync)
// ============================================================================

interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  platform: string;
  userAgent: string;
}

/**
 * Initialize web-push with VAPID keys
 */
function initializeWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@schools-in-check.web.app";

  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn("VAPID keys not configured. Push notifications will not work.");
    return false;
  }

  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  return true;
}

/**
 * Send a push notification to a specific subscription
 */
async function sendPushNotification(
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
        tag: "geofence-reminder",
        requireInteraction: true,
        data: payload.data || {},
      })
    );

    return true;
  } catch (error: any) {
    // Handle expired or invalid subscriptions
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
 * Scheduled function to send morning geofence check-in reminders
 * Runs at 8 AM every weekday
 */
exports.sendMorningGeofenceReminders = onSchedule(
  {
    schedule: "0 8 * * 1-5", // 8 AM, Monday-Friday
    timeZone: "America/New_York", // Adjust to your timezone
    secrets: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"],
  },
  async (_event: any) => {
    if (!initializeWebPush()) {
      logger.warn("Skipping push notifications - VAPID not configured");
      return;
    }

    const db = admin.firestore();

    try {
      // Get all users with active geofence preferences and push subscriptions
      const usersSnapshot = await db
        .collection("users")
        .where("autoGeofenceCheckEnabled", "==", true)
        .where("role", "==", "provider")
        .get();

      if (usersSnapshot.empty) {
        logger.info("No users with auto-geofence enabled");
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      let noSubscriptionCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        // Check if user has an active session (don't remind if already checked in)
        const activeSessionQuery = await db
          .collection("sessions")
          .where("userId", "==", userId)
          .where("status", "in", ["active", "paused"])
          .limit(1)
          .get();

        if (!activeSessionQuery.empty) {
          continue; // User is already checked in
        }

        // Get user's push subscription
        const subscriptionDoc = await db
          .collection("users")
          .doc(userId)
          .collection("pushSubscriptions")
          .doc("geofence")
          .get();

        if (!subscriptionDoc.exists) {
          noSubscriptionCount++;
          continue;
        }

        const subscription = subscriptionDoc.data() as PushSubscription;

        // Send the reminder
        const success = await sendPushNotification(subscription, {
          title: "Check-in Reminder",
          body: "Don't forget to check in when you arrive at your location",
          data: { action: "check-in", type: "morning-reminder" },
        });

        if (success) {
          successCount++;
        } else {
          failedCount++;
          // Remove invalid subscription
          await subscriptionDoc.ref.delete();
        }
      }

      logger.info("Morning geofence reminders sent", {
        success: successCount,
        failed: failedCount,
        noSubscription: noSubscriptionCount,
      });
    } catch (error) {
      logger.error("Error sending morning geofence reminders", { error });
      throw error;
    }
  }
);

/**
 * Scheduled function to send evening geofence check-out reminders
 * Runs at 5 PM every weekday
 */
exports.sendEveningGeofenceReminders = onSchedule(
  {
    schedule: "0 17 * * 1-5", // 5 PM, Monday-Friday
    timeZone: "America/New_York", // Adjust to your timezone
    secrets: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"],
  },
  async (_event: any) => {
    if (!initializeWebPush()) {
      logger.warn("Skipping push notifications - VAPID not configured");
      return;
    }

    const db = admin.firestore();

    try {
      // Get all active sessions
      const activeSessionsSnapshot = await db
        .collection("sessions")
        .where("status", "in", ["active", "paused"])
        .get();

      if (activeSessionsSnapshot.empty) {
        logger.info("No active sessions for evening reminders");
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      let noSubscriptionCount = 0;

      for (const sessionDoc of activeSessionsSnapshot.docs) {
        const session = sessionDoc.data();
        const userId = session.userId;

        // Get user's push subscription
        const subscriptionDoc = await db
          .collection("users")
          .doc(userId)
          .collection("pushSubscriptions")
          .doc("geofence")
          .get();

        if (!subscriptionDoc.exists) {
          noSubscriptionCount++;
          continue;
        }

        const subscription = subscriptionDoc.data() as PushSubscription;

        // Get location name if available
        let locationName = "your location";
        if (session.locationId) {
          const locationDoc = await db
            .collection("locations")
            .doc(session.locationId)
            .get();

          if (locationDoc.exists) {
            locationName = locationDoc.data()?.name || locationName;
          }
        }

        // Calculate session duration
        const startTime = session.startTime?.toDate() || new Date();
        const durationMs = Date.now() - startTime.getTime();
        const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMinutes = Math.floor(
          (durationMs % (1000 * 60 * 60)) / (1000 * 60)
        );
        const durationText =
          durationHours > 0
            ? `${durationHours}h ${durationMinutes}m`
            : `${durationMinutes}m`;

        // Send the reminder
        const success = await sendPushNotification(subscription, {
          title: "Check-out Reminder",
          body: `Still at ${locationName}? Session: ${durationText}`,
          data: {
            action: "check-out",
            type: "evening-reminder",
            sessionId: sessionDoc.id,
            locationName,
          },
        });

        if (success) {
          successCount++;
        } else {
          failedCount++;
          // Remove invalid subscription
          await subscriptionDoc.ref.delete();
        }
      }

      logger.info("Evening geofence reminders sent", {
        success: successCount,
        failed: failedCount,
        noSubscription: noSubscriptionCount,
      });
    } catch (error) {
      logger.error("Error sending evening geofence reminders", { error });
      throw error;
    }
  }
);

/**
 * Callable function to send an immediate push notification to a user
 * Used for testing or ad-hoc notifications
 */
exports.sendGeofenceReminder = onCall(
  {
    secrets: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"],
  },
  async (request: any) => {
    const { uid: userId } = requireAuth(request);

    if (!initializeWebPush()) {
      throw new HttpsError(
        "failed-precondition",
        "Push notifications not configured"
      );
    }

    const db = admin.firestore();
    const { type = "check-in", locationName } = request.data || {};

    // Get user's push subscription
    const subscriptionDoc = await db
      .collection("users")
      .doc(userId)
      .collection("pushSubscriptions")
      .doc("geofence")
      .get();

    if (!subscriptionDoc.exists) {
      throw new HttpsError(
        "not-found",
        "No push subscription found for this user"
      );
    }

    const subscription = subscriptionDoc.data() as PushSubscription;

    const payload =
      type === "check-out"
        ? {
            title: "Check-out Reminder",
            body: locationName
              ? `Don't forget to check out from ${locationName}`
              : "Don't forget to check out when you leave",
            data: { action: "check-out", type: "manual-reminder" },
          }
        : {
            title: "Check-in Reminder",
            body: locationName
              ? `Are you at ${locationName}? Don't forget to check in`
              : "Don't forget to check in at your location",
            data: { action: "check-in", type: "manual-reminder" },
          };

    const success = await sendPushNotification(subscription, payload);

    if (!success) {
      // Remove invalid subscription
      await subscriptionDoc.ref.delete();
      throw new HttpsError("unavailable", "Push notification failed - subscription may have expired");
    }

    return { success: true };
  }
);

/**
 * Callable function to register VAPID public key (for client to fetch)
 */
exports.getVapidPublicKey = onCall(
  {
    secrets: ["VAPID_PUBLIC_KEY"],
  },
  async (_request: any) => {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      throw new HttpsError(
        "failed-precondition",
        "VAPID public key not configured"
      );
    }

    return { vapidPublicKey };
  }
);
