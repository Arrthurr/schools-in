import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

import {
  calculateDistance,
  requireAuth,
  isAdminGroup,
  getM365AccessToken,
  getUserM365Groups,
  initializeWebPush,
  sendPushNotification,
  PRODUCTION_CONFIG,
  SESSION_LIMIT_MS,
  type SyncResult,
  type PushSubscription,
  locationMatchesGroup,
  normalizeCanonicalName,
} from "./utils";

import {
  LATE_PROVIDER_GRACE_MINUTES,
  getChicagoTimeContext,
  isScheduleLate,
  buildLatenessNotificationBody,
} from "./lateProviderLogic";

import {
  buildEligibleLateProviders,
  dispatchAdminPushAlerts,
} from "./lateProviderOrchestration";

import {
  validateStartSessionInput,
  validateCheckInMethod,
  validateUserForSession,
  validateProviderAssignment,
  validateLocationActive,
  validateGeofence,
  validateEndSessionInput,
  validateSessionOwnership,
  validateSessionStatus,
  calculateDurationMinutes,
  validateScheduleGating,
  type UpdateSessionNoteInput,
} from "./sessionLifecycle";

import {
  isRecentlyCreated,
  calculateStaleDuration,
  type StaleSessionData,
} from "./cleanupLogic";

admin.initializeApp();

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
      logger.info(
        `Force flag set for M365 sync for user ${userEmail} (${userId}).`
      );
    } else if (resyncRequested) {
      logger.info(
        `Resync requested flag detected for user ${userEmail} (${userId}). Proceeding with full sync.`
      );
    }

    if (!shouldSync) {
      const role: "admin" | "provider" =
        userData?.role === "admin" ? "admin" : "provider";
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

        const allLocations = locationsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: (data.name as string) || "",
            assignedProviders: (data.assignedProviders || []) as string[],
            groupAliases: (data.groupAliases || []) as string[],
          };
        });

        // Filter out admin group from matching
        const schoolGroups = userGroups.filter((group) => !isAdminGroup(group));
        const schoolGroupNames = schoolGroups.map((g) => g.displayName);

        // Find locations that match user's school groups (canonical name + optional groupAliases)
        const matchedLocations: Array<{
          id: string;
          name: string;
          assignedProviders: string[];
          groupAliases: string[];
          matchedBy?: "name" | "alias";
        }> = [];
        const matchedGroupNames = new Set<string>();

        for (const loc of allLocations) {
          for (const groupName of schoolGroupNames) {
            const result = locationMatchesGroup(
              { id: loc.id, name: loc.name, groupAliases: loc.groupAliases },
              groupName
            );
            if (result.match) {
              matchedLocations.push({
                ...loc,
                matchedBy: result.matchedBy,
              });
              matchedGroupNames.add(groupName);
              break;
            }
          }
        }

        // Log unmatched provider groups and candidate location names for debugging
        const unmatchedGroups = schoolGroupNames.filter(
          (g) => !matchedGroupNames.has(g)
        );
        if (unmatchedGroups.length > 0) {
          const candidateNames = allLocations.map((loc) => {
            const aliases = (loc.groupAliases || []).length
              ? ` (aliases: ${(loc.groupAliases || []).join(", ")})`
              : "";
            return `${normalizeCanonicalName(loc.name)}${aliases}`;
          });
          logger.info(
            `M365 sync: unmatched school groups for provider ${userEmail}`,
            {
              unmatchedGroups,
              candidateNormalizedNames: candidateNames,
            }
          );
        }

        // Dedupe by location id (same location could match multiple groups in theory)
        const seenIds = new Set<string>();
        const uniqueMatchedLocations = matchedLocations.filter((loc) => {
          if (seenIds.has(loc.id)) return false;
          seenIds.add(loc.id);
          return true;
        });

        const matchedLocationIds = new Set(uniqueMatchedLocations.map((l) => l.id));

        // Find locations user is currently assigned to
        const currentlyAssignedLocations = allLocations.filter((loc) =>
          loc.assignedProviders.includes(userId)
        );

        // Add user to newly matched locations
        for (const location of uniqueMatchedLocations) {
          if (!location.assignedProviders.includes(userId)) {
            await db
              .collection("locations")
              .doc(location.id)
              .update({
                assignedProviders:
                  admin.firestore.FieldValue.arrayUnion(userId),
                updatedAt: admin.firestore.Timestamp.now(),
              });
            logger.info(`Added user ${userId} to location: ${location.name}`, {
              matchedBy: location.matchedBy ?? "name",
            });
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
                assignedProviders:
                  admin.firestore.FieldValue.arrayRemove(userId),
                updatedAt: admin.firestore.Timestamp.now(),
              });
            logger.info(
              `Removed user ${userId} from location: ${location.name}`
            );
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

  const reason =
    typeof request?.data?.reason === "string"
      ? request.data.reason.trim().slice(0, 500)
      : undefined;

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

// Use imported constants from utils.ts
const sessionLimitInMs = SESSION_LIMIT_MS;

// Callable function to start a session with atomic checks
// Supports role-based check-in methods:
// - Providers: checkInMethod can be 'geo', 'manual', or 'offline-sync'
// - Admins: checkInMethod must be 'manual' (manual check-in with GPS + in-radius enforcement)
exports.startSession = onCall(async (request: any) => {
  try {
    const { data, auth } = request;

    // Authentication check
    if (!auth) {
      throw new Error("Authentication required");
    }

    validateStartSessionInput(data);

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

      validateUserForSession(userData);
      validateCheckInMethod(userRole, data.checkInMethod);

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

      // Prevent offline-sync duplicates: reject if a session already exists
      // for this user with a startTime within 5 minutes of the proposed time
      if (data.checkInMethod === "offline-sync") {
        const proposedStart = new Date(data.startTime).getTime();
        const windowMs = 5 * 60 * 1000; // 5 minutes
        const windowStart = admin.firestore.Timestamp.fromMillis(
          proposedStart - windowMs
        );
        const windowEnd = admin.firestore.Timestamp.fromMillis(
          proposedStart + windowMs
        );

        const duplicateQuery = db
          .collection("sessions")
          .where("userId", "==", userId)
          .where("startTime", ">=", windowStart)
          .where("startTime", "<=", windowEnd);

        const duplicateSnapshot = await transaction.get(duplicateQuery);

        if (!duplicateSnapshot.empty) {
          const existing = duplicateSnapshot.docs[0];
          logger.warn("Rejected duplicate offline-sync session", {
            userId,
            existingSessionId: existing.id,
            proposedStartTime: data.startTime,
            existingStartTime: existing.data().startTime?.toDate?.(),
          });
          throw new Error(
            `Duplicate session detected: session ${existing.id} already exists within 5 minutes of the proposed start time`
          );
        }
      }

      // Verify the location exists
      const locationRef = db.collection("locations").doc(data.locationId);
      const locationDoc = await transaction.get(locationRef);

      if (!locationDoc.exists) {
        throw new Error("Location not found");
      }

      const locationData = locationDoc.data();
      validateLocationActive(locationData);
      validateProviderAssignment(userRole, userId, locationData);

      const radiusMeters = locationData.radiusMeters || 300;
      const distanceFromCenter = validateGeofence(
        data.checkInMethod,
        data.checkInLocation,
        locationData.geo,
        radiusMeters,
        data.distanceFromCenterAtCheckIn
      );

      if (
        data.checkInLocation &&
        typeof data.checkInLocation.latitude === "number" &&
        typeof data.checkInLocation.longitude === "number" &&
        locationData.geo
      ) {
        logger.info("Server-side geofence validation passed", {
          userId,
          locationId: data.locationId,
          distance: Math.round(distanceFromCenter),
          radiusMeters,
        });
      }

      // Schedule-based time gating for provider manual check-in
      if (userRole === "provider" && data.checkInMethod === "manual") {
        // Determine the current time in America/Chicago using Intl for robust TZ handling
        const chicagoFmt = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Chicago",
          hour12: false,
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        const chicagoParts = chicagoFmt.formatToParts(new Date());
        const partVal = (type: string) =>
          chicagoParts.find((p) => p.type === type)?.value ?? "";
        const weekdayMap: Record<string, number> = {
          Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
        };
        const dayOfWeek = weekdayMap[partVal("weekday")] ?? new Date().getDay();
        const chicagoHour = Number(partVal("hour").replace(/^24$/, "00"));
        const chicagoMinute = Number(partVal("minute"));
        const currentMinutes = chicagoHour * 60 + chicagoMinute;

        const schedulesQuery = db
          .collection("schedules")
          .where("providerId", "==", userId)
          .where("locationId", "==", data.locationId)
          .where("dayOfWeek", "==", dayOfWeek);

        const schedulesSnapshot = await transaction.get(schedulesQuery);

        const activeStartTimes = schedulesSnapshot.docs
          .filter((doc: any) => doc.data().isActive !== false)
          .map((doc: any) => doc.data().startTime as string)
          .sort();

        validateScheduleGating(currentMinutes, activeStartTimes);
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
        notes: typeof data.notes === "string" ? data.notes.trim().slice(0, 500) : "",
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
      } else if (error.message.includes("Admins must use manual")) {
        throw error; // Preserve role-based method error
      } else if (error.message.includes("requires checkInLocation")) {
        throw error; // Preserve location requirement error
      } else if (error.message.includes("Check-in opens at")) {
        throw error; // Preserve schedule gating error
      } else if (error.message.includes("Duplicate session detected")) {
        throw new Error(
          "A session already exists for this time. No duplicate was created."
        );
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

    validateEndSessionInput(data);

    const db = admin.firestore();
    const userId = auth.uid;

    let sessionLocationId: string | undefined;

    const result = await db.runTransaction(async (transaction: any) => {
      const sessionRef = db.collection("sessions").doc(data.sessionId);
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data();

      validateSessionOwnership(sessionData.userId, userId);
      validateSessionStatus(sessionData.status);

      const startTime = sessionData.startTime || sessionData.checkInTime;
      if (!startTime) {
        throw new Error("Session missing start time");
      }

      const checkOutTimestamp = admin.firestore.Timestamp.fromDate(
        new Date(data.checkOutTime)
      );
      const durationMinutes = calculateDurationMinutes(
        startTime.toMillis(),
        checkOutTimestamp.toMillis()
      );

      const updateData: Record<string, any> = {
        endTime: checkOutTimestamp,
        checkOutTime: checkOutTimestamp,
        status: "completed",
        active: false,
        durationMinutes,
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (typeof data.notes === "string" && data.notes.trim()) {
        updateData.notes = data.notes.trim().slice(0, 500);
        updateData.hasNotes = true;
        updateData.notesUpdatedAt = admin.firestore.Timestamp.now();
        sessionLocationId = sessionData.locationId;
      }

      if (data.checkOutLocation) {
        updateData.checkOutLocation = {
          latitude: data.checkOutLocation.latitude,
          longitude: data.checkOutLocation.longitude,
          accuracy: data.checkOutLocation.accuracy || null,
        };

        // Look up the location document to get its geo coordinates.
        // sessionData stores locationId, not the geo point itself.
        if (sessionData.locationId) {
          const locationDoc = await transaction.get(
            db.collection("locations").doc(sessionData.locationId)
          );
          const locationGeo = locationDoc.exists
            ? locationDoc.data()?.geo
            : null;

          if (locationGeo) {
            updateData.distanceFromCenterAtCheckOut = Math.round(
              calculateDistance(
                data.checkOutLocation.latitude,
                data.checkOutLocation.longitude,
                locationGeo.latitude,
                locationGeo.longitude
              )
            );
          }
        }
      }

      // Client-provided distance as last-resort fallback
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

    // Fan-out admin notification if notes were submitted at check-out
    const checkOutNote =
      typeof data.notes === "string" ? data.notes.trim().slice(0, 500) : "";
    if (checkOutNote.length > 0) {
      try {
        const [locationResult, adminsSnapshot, providerDoc] = await Promise.all([
          sessionLocationId
            ? db.collection("locations").doc(sessionLocationId).get()
            : Promise.resolve(null),
          db.collection("users").where("role", "==", "admin").get(),
          db.collection("users").doc(userId).get(),
        ]);

        const locationName = locationResult?.exists
          ? locationResult.data()?.name || "Unknown location"
          : "Unknown location";
        const providerData = providerDoc.exists ? providerDoc.data() : null;
        const providerName =
          providerData?.displayName || providerData?.email || "Provider";
        const notePreview =
          checkOutNote.length > 100
            ? checkOutNote.slice(0, 100) + "..."
            : checkOutNote;
        const now = admin.firestore.Timestamp.now();

        const batch = db.batch();
        for (const adminDoc of adminsSnapshot.docs) {
          const notifRef = db
            .collection("users")
            .doc(adminDoc.id)
            .collection("notifications")
            .doc(`session_note_${data.sessionId}`);
          batch.set(notifRef, {
            id: notifRef.id,
            type: "session_note",
            sessionId: data.sessionId,
            providerId: userId,
            providerName,
            locationName,
            notePreview,
            read: false,
            createdAt: now,
          });
        }
        await batch.commit();

        logger.info("Admin notifications sent for check-out note", {
          sessionId: data.sessionId,
          adminsNotified: adminsSnapshot.size,
        });
      } catch (notifError) {
        logger.error(
          "Failed to send admin notifications for check-out note:",
          notifError
        );
        // Don't throw — session close is the critical operation
      }
    }

    logger.info(
      `Session ended successfully for user ${userId}: ${data.sessionId}`
    );

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
    schedule: "every 30 minutes",
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

      // --- Warning pass: notify users with sessions approaching timeout (510-540 min) ---
      const warningWindowMs = 510 * 60 * 1000; // 510 minutes (8h 30m)
      const warningCutoff = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - warningWindowMs
      );

      // Find sessions that started between 510 and 540 minutes ago (approaching timeout)
      const warnByCheckInTime = sessionsRef
        .where("status", "in", ["active", "paused"])
        .where("checkInTime", "<", warningCutoff)
        .where("checkInTime", ">=", cutoff)
        .limit(PRODUCTION_CONFIG.maxBatchSize);

      const warnByStartTime = sessionsRef
        .where("status", "in", ["active", "paused"])
        .where("startTime", "<", warningCutoff)
        .where("startTime", ">=", cutoff)
        .limit(PRODUCTION_CONFIG.maxBatchSize);

      const [warnCheckInSnap, warnStartSnap] = await Promise.all([
        warnByCheckInTime.get(),
        warnByStartTime.get(),
      ]);

      // Deduplicate warning sessions
      const warnSessionMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      warnCheckInSnap.forEach((doc: any) => warnSessionMap.set(doc.id, doc));
      warnStartSnap.forEach((doc: any) => {
        if (!warnSessionMap.has(doc.id)) warnSessionMap.set(doc.id, doc);
      });

      if (warnSessionMap.size > 0) {
        logger.info(
          `Found ${warnSessionMap.size} sessions approaching timeout - sending reminders`
        );

        let pushEnabledForWarning = false;
        try {
          pushEnabledForWarning = initializeWebPush();
        } catch (error) {
          logger.warn(
            "Failed to initialize web push for warning notifications.",
            { error }
          );
        }

        if (pushEnabledForWarning) {
          let warnSent = 0;
          let warnFailed = 0;
          let warnMissing = 0;

          for (const [sessionId, doc] of warnSessionMap) {
            const data = doc.data();
            if (!data) continue;

            // Skip sessions already warned (check for warningNotificationSent flag)
            if (data.warningNotificationSent) continue;

            const userId = data.userId;
            if (!userId) continue;

            // Look up user's push subscription
            const userSubDoc = await db
              .collection("users")
              .doc(userId)
              .collection("pushSubscriptions")
              .doc("sessionAlerts")
              .get();

            // Fall back to adminAlerts subscription if sessionAlerts doesn't exist
            const subDoc = userSubDoc.exists
              ? userSubDoc
              : await db
                  .collection("users")
                  .doc(userId)
                  .collection("pushSubscriptions")
                  .doc("adminAlerts")
                  .get();

            if (!subDoc.exists) {
              warnMissing++;
              continue;
            }

            const subscription = subDoc.data() as PushSubscription;
            const sessionStart =
              data.startTime?.toMillis?.() ||
              data.checkInTime?.toMillis?.() ||
              0;
            const elapsedMin =
              sessionStart > 0
                ? Math.floor((now.toMillis() - sessionStart) / 60000)
                : 90;

            const pushResult = await sendPushNotification(subscription, {
              title: "Still at the school?",
              body: `Your session has been active for ${elapsedMin}+ minutes. Open the app to update your status before it times out.`,
              data: {
                type: "session-timeout-warning",
                sessionId,
              },
            });

            if (pushResult === "sent") {
              warnSent++;
              // Mark session so we don't send duplicate warnings
              try {
                await sessionsRef.doc(sessionId).update({
                  warningNotificationSent: true,
                });
              } catch (updateErr) {
                logger.warn(
                  `Failed to mark session ${sessionId} as warned — may re-notify next cycle`,
                  { error: updateErr }
                );
              }
            } else {
              warnFailed++;
            }
          }

          logger.info("Session timeout warning notifications dispatched", {
            sent: warnSent,
            failed: warnFailed,
            missing: warnMissing,
          });
        }
      }

      // Run multiple queries to catch all stale sessions
      // Primary query using checkInTime
      const staleByCheckInTime = sessionsRef
        .where("status", "in", ["active", "paused"])
        .where("checkInTime", "<", cutoff)
        .limit(PRODUCTION_CONFIG.maxBatchSize);

      // Fallback query for sessions with only startTime (sessions created via useCachedSession)
      const staleByStartTime = sessionsRef
        .where("status", "in", ["active", "paused"])
        .where("startTime", "<", cutoff)
        .limit(PRODUCTION_CONFIG.maxBatchSize);

      // Legacy query for sessions with active: true (older schema)
      const legacyStale = sessionsRef
        .where("active", "==", true)
        .where("startTime", "<", cutoff)
        .limit(100);

      // Execute all queries in parallel
      const [checkInTimeSnapshot, startTimeSnapshot, legacySnapshot] =
        await Promise.all([
          staleByCheckInTime.get(),
          staleByStartTime.get(),
          legacyStale.get(),
        ]);

      // Deduplicate results by session ID
      const sessionMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();

      checkInTimeSnapshot.forEach((doc: any) => {
        sessionMap.set(doc.id, doc);
      });
      startTimeSnapshot.forEach((doc: any) => {
        if (!sessionMap.has(doc.id)) {
          sessionMap.set(doc.id, doc);
        }
      });
      legacySnapshot.forEach((doc: any) => {
        if (!sessionMap.has(doc.id)) {
          sessionMap.set(doc.id, doc);
        }
      });

      if (sessionMap.size === 0) {
        logger.info("No stale sessions found.");
        return;
      }

      logger.info(
        `Found ${sessionMap.size} potential stale sessions (checkInTime: ${checkInTimeSnapshot.size}, startTime: ${startTimeSnapshot.size}, legacy: ${legacySnapshot.size})`
      );

      const batch = db.batch();
      const durationMinutes = Math.floor(sessionLimitInMs / 60000);
      const updateTime = admin.firestore.Timestamp.now();
      const staleSessionIds: string[] = [];
      let skippedRecentlyCreated = 0;
      const nowMs = now.toMillis();

      sessionMap.forEach((doc, docId) => {
        const data = doc.data();
        if (!data) return;

        const sessionEntry: StaleSessionData = {
          id: docId,
          status: data.status,
          startTime: data.startTime,
          checkInTime: data.checkInTime,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        if (isRecentlyCreated(sessionEntry, nowMs)) {
          const createdAt =
            data.createdAt?.toMillis?.() || data.updatedAt?.toMillis?.() || 0;
          const sessionAge = nowMs - createdAt;
          logger.info(
            `Skipping recently-synced session: ${docId} (age: ${Math.round(
              sessionAge / 1000
            )}s)`
          );
          skippedRecentlyCreated++;
          return;
        }

        const actualDurationMinutes = calculateStaleDuration(
          sessionEntry,
          nowMs,
          durationMinutes
        );

        logger.info(`Found stale session: ${docId} (duration: ${actualDurationMinutes}min)`);
        staleSessionIds.push(docId);
        const sessionRef = sessionsRef.doc(docId);
        batch.update(sessionRef, {
          status: "error",
          active: false,
          endTime: updateTime,
          checkOutTime: updateTime,
          durationMinutes: actualDurationMinutes,
          notes: "Session automatically closed due to timeout.",
          updatedAt: updateTime,
          errorCode: "timeout_auto_close",
          needsAdminReview: true,
          adminReviewStatus: "unreviewed",
          adminReviewedAt: admin.firestore.FieldValue.delete(),
          adminReviewedBy: admin.firestore.FieldValue.delete(),
        });
      });

      if (staleSessionIds.length === 0) {
        logger.info(
          `No sessions to clean up (skipped ${skippedRecentlyCreated} recently-created sessions).`
        );
        return;
      }

      await batch.commit();
      logger.info(
        `Cleaned up ${staleSessionIds.length} stale sessions (skipped ${skippedRecentlyCreated} recently-created).`
      );

      // Track cleanup metrics
      const metrics = {
        cleanedSessions: staleSessionIds.length,
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
      let pushEnabled = false;
      try {
        pushEnabled = initializeWebPush();
      } catch (error) {
        logger.warn("Failed to initialize web push. Skipping admin alerts.", {
          error,
        });
      }

      if (pushEnabled) {
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
            const pushResult = await sendPushNotification(subscription, {
              title: "Session auto-closed (timeout)",
              body: `${staleSessionIds.length} session(s) were auto-closed and need review.`,
              data: {
                type: "session-timeout",
                count: staleSessionIds.length,
              },
            });

            if (pushResult === "sent") {
              sent++;
            } else {
              failed++;
              // Only delete expired subscriptions — preserve them on transient errors
              if (pushResult === "expired") {
                await subscriptionDoc.ref.delete();
              }
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

// Late provider admin alerts
exports.checkLateProviders = onSchedule(
  {
    schedule: "every 30 minutes",
    secrets: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"],
  },
  async (_event: any) => {
    try {
      const db = admin.firestore();

      // Must have VAPID configured — return early without writing dedup docs so
      // the alert can still fire on the next run once VAPID is restored.
      let pushEnabled = false;
      try {
        pushEnabled = initializeWebPush();
      } catch (error) {
        logger.warn("checkLateProviders: failed to initialize web push", { error });
      }
      if (!pushEnabled) {
        logger.warn("checkLateProviders: VAPID not configured — skipping run (no dedup written)");
        return;
      }

      const { dayOfWeek, nowMinutes, todayDateKey } = getChicagoTimeContext();
      logger.info("checkLateProviders: running", {
        dayOfWeek, nowMinutes, todayDateKey, graceMinutes: LATE_PROVIDER_GRACE_MINUTES,
      });

      // Query all active schedules for today (Chicago day-of-week)
      const schedulesSnapshot = await db
        .collection("schedules")
        .where("dayOfWeek", "==", dayOfWeek)
        .where("isActive", "==", true)
        .get();
      if (schedulesSnapshot.empty) {
        logger.info("checkLateProviders: no active schedules for today");
        return;
      }

      // Filter to schedules past the grace window (skip docs with malformed startTime)
      const lateSchedules = schedulesSnapshot.docs.filter((doc) => {
        const st = doc.data().startTime;
        if (typeof st !== "string") {
          logger.warn(`checkLateProviders: skipping schedule ${doc.id} — missing or non-string startTime`);
          return false;
        }
        return isScheduleLate(st, nowMinutes);
      });
      if (lateSchedules.length === 0) {
        logger.info("checkLateProviders: no schedules past grace window yet");
        return;
      }

      // Fetch admins BEFORE dedup writes — no admins means nothing to do,
      // and we must not consume a dedup slot for a run that sends nothing.
      const adminsSnapshot = await db
        .collection("users")
        .where("role", "==", "admin")
        .get();
      if (adminsSnapshot.empty) {
        logger.warn("checkLateProviders: no admin users found, skipping run (no dedup written)");
        return;
      }

      // Timestamps computed once for all dedup writes in this invocation
      const now = admin.firestore.Timestamp.now();
      const expireAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + 7 * 24 * 60 * 60 * 1000 // 7 days
      );

      const lateProviders = await buildEligibleLateProviders(
        db, lateSchedules, todayDateKey, now, expireAt
      );
      if (lateProviders.length === 0) {
        logger.info("checkLateProviders: no genuinely late providers found");
        return;
      }
      logger.info(`checkLateProviders: ${lateProviders.length} late provider(s) found`, {
        providers: lateProviders.map((p) => ({ providerId: p.providerId, scheduleId: p.scheduleId })),
      });

      const notificationBody = buildLatenessNotificationBody(
        lateProviders.map((lp) => ({
          providerName: lp.providerName,
          locationName: lp.locationName,
          startTime: lp.startTime,
        }))
      );

      const { sent, failed, missing } = await dispatchAdminPushAlerts(
        db, adminsSnapshot, notificationBody
      );
      logger.info("checkLateProviders: admin push alerts dispatched", {
        sent, failed, missing, lateProviderCount: lateProviders.length,
      });

    } catch (error) {
      logger.error("checkLateProviders: error", error);
      throw error;
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
            feedback.url
              ? `<div class="info-row"><span class="label">URL:</span> ${feedback.url}</div>`
              : ""
          }
          <div class="description">
            <strong>Description:</strong><br>
            ${feedback.description.replace(/\n/g, "<br>")}
          </div>
          <a href="${feedbackUrl}" class="button">View in Admin Console</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from CampusAccess Feedback System</p>
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

/**
 * Callable function to add or update a note on a session.
 * Validates ownership, enforces 500-char limit, and notifies admins.
 */
exports.updateSessionNote = onCall(async (request: any) => {
    try {
      const { data, auth } = request;

      if (!auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      const input = data as UpdateSessionNoteInput;
      if (!input.sessionId || typeof input.notes !== "string") {
        throw new HttpsError(
          "invalid-argument",
          "Missing required fields: sessionId, notes"
        );
      }

      const db = admin.firestore();
      const userId = auth.uid;
      const noteText = input.notes.replace(/<[^>]*>/g, "").trim().slice(0, 500);

      // Validate user is a provider
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found");
      }
      const userData = userDoc.data();
      if (userData?.role !== "provider") {
        throw new HttpsError(
          "permission-denied",
          "Only providers can add session notes"
        );
      }

      // Validate session exists and user owns it
      const sessionRef = db.collection("sessions").doc(input.sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        throw new HttpsError("not-found", "Session not found");
      }
      const sessionData = sessionDoc.data();
      if (sessionData?.userId !== userId) {
        throw new HttpsError(
          "permission-denied",
          "You are not authorized to update this session"
        );
      }

      // Rate limit: reject if notesUpdatedAt is within the last 10 seconds
      const lastUpdate = sessionData?.notesUpdatedAt;
      if (lastUpdate) {
        const lastUpdateMs = lastUpdate.toMillis ? lastUpdate.toMillis() : 0;
        const nowMs = Date.now();
        if (nowMs - lastUpdateMs < 10_000) {
          throw new HttpsError(
            "resource-exhausted",
            "Please wait before updating the note again"
          );
        }
      }

      // Update the session note
      const now = admin.firestore.Timestamp.now();
      const hasNotes = noteText.length > 0;
      await sessionRef.update({
        notes: noteText,
        hasNotes,
        notesUpdatedAt: now,
        updatedAt: now,
      });

      if (hasNotes) {
        // Parallelize independent reads: location name + admin users
        const [locationResult, adminsSnapshot] = await Promise.all([
          sessionData?.locationId
            ? db.collection("locations").doc(sessionData.locationId).get()
            : Promise.resolve(null),
          db.collection("users").where("role", "==", "admin").get(),
        ]);

        let locationName = "Unknown location";
        if (locationResult?.exists) {
          locationName = locationResult.data()?.name || locationName;
        }

        const providerName = userData?.displayName || userData?.email || "Provider";
        const notePreview =
          noteText.length > 100 ? noteText.slice(0, 100) + "..." : noteText;

        const batch = db.batch();

        for (const adminDoc of adminsSnapshot.docs) {
          const notifRef = db
            .collection("users")
            .doc(adminDoc.id)
            .collection("notifications")
            .doc(`session_note_${input.sessionId}`);

          batch.set(notifRef, {
            id: notifRef.id,
            type: "session_note",
            sessionId: input.sessionId,
            providerId: userId,
            providerName,
            locationName,
            notePreview,
            read: false,
            createdAt: now,
          });
        }

        await batch.commit();
      }

      logger.info("Session note updated", {
        sessionId: input.sessionId,
        userId,
        noteLength: noteText.length,
        notified: hasNotes,
      });

      return {
        success: true,
        sessionId: input.sessionId,
        notes: noteText,
        notesUpdatedAt: now.toDate().toISOString(),
      };
    } catch (error) {
      logger.error("Error updating session note:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to update session note");
    }
  }
);

// Push notification helpers imported from ./utils

/**
 * Callable to save or remove an admin's push subscription for late-provider alerts.
 * Used by both the UI and agents — the only way to manage the adminAlerts subscription.
 *
 * data.action: "save" | "remove"
 * data.subscription: { endpoint, keys: { auth, p256dh } }  (required for "save")
 */
exports.manageAdminAlertSubscription = onCall(async (request: any) => {
  const { uid: userId } = requireAuth(request);
  const db = admin.firestore();

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }
  if (userDoc.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can manage alert subscriptions");
  }

  const { action, subscription } = request.data ?? {};
  const subRef = db
    .collection("users")
    .doc(userId)
    .collection("pushSubscriptions")
    .doc("adminAlerts");

  if (action === "save") {
    if (
      typeof subscription?.endpoint !== "string" ||
      typeof subscription?.keys?.auth !== "string" ||
      typeof subscription?.keys?.p256dh !== "string"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "subscription must include endpoint (string) and keys.auth and keys.p256dh (strings)"
      );
    }
    await subRef.set({
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: { auth: subscription.keys.auth, p256dh: subscription.keys.p256dh },
      updatedAt: admin.firestore.Timestamp.now(),
    });
    logger.info(`manageAdminAlertSubscription: saved for ${userId}`);
    return { success: true };
  }

  if (action === "remove") {
    await subRef.delete();
    logger.info(`manageAdminAlertSubscription: removed for ${userId}`);
    return { success: true };
  }

  throw new HttpsError("invalid-argument", "action must be 'save' or 'remove'");
});

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
