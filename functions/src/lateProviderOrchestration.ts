import type {
  Firestore,
  QueryDocumentSnapshot,
  QuerySnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { sendPushNotification, type PushSubscription } from "./utils";
import { buildDedupId, type LatenessAlert } from "./lateProviderLogic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LateProviderCandidate {
  scheduleId: string;
  dedupId: string;
  providerId: string;
  locationId: string;
  startTime: string;
  providerName: string;
  locationName: string;
}

export interface PushDispatchResult {
  sent: number;
  failed: number;
  missing: number;
}

const DASHBOARD_WRITE_CHUNK_SIZE = 100;

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * Check one schedule through all eligibility gates:
 *   1. Dedup read — fast path
 *   2. Location active
 *   3. Provider assigned (RBAC)
 *   4. Provider user active
 *   5. No active/paused session today
 *
 * Returns null if any gate fails.
 */
export async function checkScheduleEligibility(
  db: Firestore,
  scheduleDoc: QueryDocumentSnapshot,
  todayDateKey: string
): Promise<LateProviderCandidate | null> {
  const scheduleData = scheduleDoc.data();
  const scheduleId = scheduleDoc.id;

  const { providerId, locationId, startTime } = scheduleData;
  if (
    typeof providerId !== "string" ||
    typeof locationId !== "string" ||
    typeof startTime !== "string"
  ) {
    logger.warn(
      `checkLateProviders: skipping malformed schedule doc ${scheduleId}`,
      { scheduleData }
    );
    return null;
  }

  const dedupId = buildDedupId(scheduleId, startTime, todayDateKey);

  // 1. Dedup read — fast path: already alerted for this slot today?
  const dedupDoc = await db.collection("latenessAlerts").doc(dedupId).get();
  if (dedupDoc.exists) {
    logger.info(`checkLateProviders: dedup hit, skipping ${dedupId}`);
    return null;
  }

  // 2. Location must be active
  const locationDoc = await db.collection("locations").doc(locationId).get();
  if (!locationDoc.exists) return null;
  const location = locationDoc.data()!;
  if (location.active === false) {
    logger.info(
      `checkLateProviders: location inactive, skipping schedule ${scheduleId}`
    );
    return null;
  }

  // 3. Provider must be assigned to the location (RBAC single source of truth)
  const assignedProviders: string[] = location.assignedProviders || [];
  if (!assignedProviders.includes(providerId)) {
    logger.info(
      `checkLateProviders: provider ${providerId} not assigned to location ${locationId}, skipping`
    );
    return null;
  }

  // 4. Provider user must be active
  const providerDoc = await db.collection("users").doc(providerId).get();
  if (!providerDoc.exists) return null;
  const provider = providerDoc.data()!;
  if (provider.isActive === false || provider.disabled === true) {
    logger.info(
      `checkLateProviders: provider ${providerId} is inactive/disabled, skipping`
    );
    return null;
  }

  // 5. Check for an active or paused session for this provider+location today
  const sessionsSnapshot = await db
    .collection("sessions")
    .where("userId", "==", providerId)
    .where("locationId", "==", locationId)
    .where("status", "in", ["active", "paused"])
    .where("dayKey", "==", todayDateKey)
    .limit(1)
    .get();

  if (!sessionsSnapshot.empty) {
    logger.info(
      `checkLateProviders: provider ${providerId} has active/paused session, skipping`
    );
    return null;
  }

  return {
    scheduleId,
    dedupId,
    providerId,
    locationId,
    startTime,
    providerName: (provider.displayName as string | undefined) ?? providerId,
    locationName: (location.name as string | undefined) ?? locationId,
  };
}

/**
 * Run eligibility checks in parallel across all late schedules.
 * Returns the subset that passed all gates and are not already deduped.
 */
export async function buildEligibleLateProviders(
  db: Firestore,
  lateSchedules: QueryDocumentSnapshot[],
  todayDateKey: string
): Promise<LateProviderCandidate[]> {
  const results = await Promise.all(
    lateSchedules.map((doc) =>
      checkScheduleEligibility(db, doc, todayDateKey)
    )
  );
  return results.filter((r): r is LateProviderCandidate => r !== null);
}

/**
 * Claim lateness dedup records after dashboard notifications are written.
 * Only the invocation that wins create() should send the push alert.
 */
export async function claimLateProviderDedupSlots(
  db: Firestore,
  lateProviders: LateProviderCandidate[],
  now: Timestamp,
  expireAt: Timestamp
): Promise<LateProviderCandidate[]> {
  const claimedProviders = await Promise.all(
    lateProviders.map(async (provider) => {
      const alertDoc: LatenessAlert = {
        scheduleId: provider.scheduleId,
        providerId: provider.providerId,
        locationId: provider.locationId,
        startTime: provider.startTime,
        alertedAt: now,
        expireAt,
      };

      try {
        await db.collection("latenessAlerts").doc(provider.dedupId).create(alertDoc);
        return provider;
      } catch (error: unknown) {
        if ((error as { code?: string }).code === "already-exists") {
          logger.info(
            `checkLateProviders: dedup race, concurrent invocation claimed ${provider.dedupId}`
          );
          return null;
        }

        logger.error(
          `checkLateProviders: failed to write dedup doc ${provider.dedupId}`,
          { error }
        );
        return null;
      }
    })
  );

  return claimedProviders.filter(
    (provider): provider is LateProviderCandidate => provider !== null
  );
}

// ---------------------------------------------------------------------------
// Push fan-out
// ---------------------------------------------------------------------------

/**
 * Send a single batched push notification to all admin subscriptions.
 * Deletes subscriptions confirmed expired (410/404); preserves on transient errors.
 */
export async function dispatchAdminPushAlerts(
  db: Firestore,
  adminsSnapshot: QuerySnapshot,
  notificationBody: string
): Promise<PushDispatchResult> {
  let sent = 0;
  let failed = 0;
  let missing = 0;

  await Promise.all(
    adminsSnapshot.docs.map(async (adminDoc) => {
      const subscriptionDoc = await db
        .collection("users")
        .doc(adminDoc.id)
        .collection("pushSubscriptions")
        .doc("adminAlerts")
        .get();

      if (!subscriptionDoc.exists) {
        missing++;
        return;
      }

      const subscription = subscriptionDoc.data() as PushSubscription;
      const pushResult = await sendPushNotification(subscription, {
        title: "Provider not checked in",
        body: notificationBody,
        data: { type: "provider-late", url: "/admin/notifications" },
      });

      if (pushResult === "sent") {
        sent++;
      } else {
        failed++;
        // Only delete subscriptions confirmed expired (410/404) — preserve on transient errors
        if (pushResult === "expired") {
          try {
            await subscriptionDoc.ref.delete();
          } catch (deleteErr) {
            logger.warn(
              "checkLateProviders: failed to delete expired subscription",
              { deleteErr }
            );
          }
        }
      }
    })
  );

  return { sent, failed, missing };
}

// ---------------------------------------------------------------------------
// Dashboard notification fan-out
// ---------------------------------------------------------------------------

export interface LateProviderInfo {
  scheduleId: string;
  providerId: string;
  providerName: string;
  locationName: string;
  scheduledTime: string;
  minutesLate: number;
  sessionId?: string | null;
}

/**
 * Create dashboard notification documents for all admins.
 * Uses deterministic IDs with create() so retries do not reopen read alerts.
 */
export async function dispatchAdminDashboardAlerts(
  db: Firestore,
  adminsSnapshot: QuerySnapshot,
  lateProviders: LateProviderInfo[],
  todayDateKey: string
): Promise<void> {
  const writes: Array<() => Promise<void>> = [];
  let createdCount = 0;
  let existingCount = 0;

  for (const adminDoc of adminsSnapshot.docs) {
    for (const provider of lateProviders) {
      const notifRef = db
        .collection("users")
        .doc(adminDoc.id)
        .collection("notifications")
        .doc(`late_provider_${provider.scheduleId}_${todayDateKey}`);

      writes.push(async () => {
        try {
          await notifRef.create({
            id: notifRef.id,
            type: "late_provider",
            sessionId: provider.sessionId || null,
            providerId: provider.providerId,
            providerName: provider.providerName,
            locationName: provider.locationName,
            scheduledTime: provider.scheduledTime,
            minutesLate: provider.minutesLate,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
          });
          createdCount++;
        } catch (error: unknown) {
          if ((error as { code?: string }).code === "already-exists") {
            existingCount++;
            return;
          }

          logger.error("checkLateProviders: failed to create dashboard alert", {
            adminId: adminDoc.id,
            scheduleId: provider.scheduleId,
            error,
          });
          throw error;
        }
      });
    }
  }

  for (let i = 0; i < writes.length; i += DASHBOARD_WRITE_CHUNK_SIZE) {
    const chunk = writes.slice(i, i + DASHBOARD_WRITE_CHUNK_SIZE);
    const results = await Promise.allSettled(chunk.map((write) => write()));
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failure) {
      throw failure.reason;
    }
  }

  logger.info("checkLateProviders: admin dashboard alerts dispatched", {
    adminCount: adminsSnapshot.docs.length,
    lateProviderCount: lateProviders.length,
    createdCount,
    existingCount,
  });
}
