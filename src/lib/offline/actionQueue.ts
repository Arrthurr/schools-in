// Offline action queue for check-in/out operations
// Handles storing, managing, and syncing actions when offline

import { initCacheDB, CACHE_STORES } from "./cacheStrategy";
import { httpsCallable } from "firebase/functions";
import { Timestamp } from "firebase/firestore";
import { getDayKey } from "@/lib/utils/time";
import { functions } from "../../../firebase.config";

type ActionQueueLockRecord = {
  id: string;
  ownerId: string;
  createdAt: number;
  expiresAt: number;
};

const ACTION_QUEUE_LOCK_ID = "action_queue_processing_lock";
const ACTION_QUEUE_LOCK_TTL_MS = 2 * 60 * 1000; // 2 minutes
const ACTION_QUEUE_LOCK_HEARTBEAT_MS = 15 * 1000; // 15 seconds
const TAB_ID_SESSION_KEY = "__schools_in_tab_id";

function getTabId(): string {
  if (typeof window === "undefined") {
    // Should not happen for this module in normal app usage, but keep it safe.
    return `nonwindow-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  try {
    const existing = window.sessionStorage.getItem(TAB_ID_SESSION_KEY);
    if (existing) return existing;
    const created = `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(TAB_ID_SESSION_KEY, created);
    return created;
  } catch {
    // sessionStorage can be blocked; fall back to per-load id
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

async function tryAcquireActionQueueLock(): Promise<{
  acquired: boolean;
  ownerId: string;
}> {
  const ownerId = getTabId();
  const now = Date.now();
  const expiresAt = now + ACTION_QUEUE_LOCK_TTL_MS;

  const db = await initCacheDB();
  const tx = db.transaction(CACHE_STORES.LOCKS, "readwrite");
  const store = tx.objectStore(CACHE_STORES.LOCKS);

  const existing = (await store.get(ACTION_QUEUE_LOCK_ID)) as
    | ActionQueueLockRecord
    | undefined;

  if (existing && existing.expiresAt > now && existing.ownerId !== ownerId) {
    await tx.done;
    return { acquired: false, ownerId };
  }

  const record: ActionQueueLockRecord = {
    id: ACTION_QUEUE_LOCK_ID,
    ownerId,
    createdAt: existing?.createdAt ?? now,
    expiresAt,
  };

  await store.put(record);
  await tx.done;

  // Verify we still own it (in case of ultra-tight races).
  const verify = (await db.get(CACHE_STORES.LOCKS, ACTION_QUEUE_LOCK_ID)) as
    | ActionQueueLockRecord
    | undefined;

  return { acquired: verify?.ownerId === ownerId, ownerId };
}

async function refreshActionQueueLock(ownerId: string): Promise<void> {
  try {
    const db = await initCacheDB();
    const now = Date.now();
    const tx = db.transaction(CACHE_STORES.LOCKS, "readwrite");
    const store = tx.objectStore(CACHE_STORES.LOCKS);
    const existing = (await store.get(ACTION_QUEUE_LOCK_ID)) as
      | ActionQueueLockRecord
      | undefined;

    if (!existing || existing.ownerId !== ownerId) {
      await tx.done;
      return;
    }

    existing.expiresAt = now + ACTION_QUEUE_LOCK_TTL_MS;
    await store.put(existing);
    await tx.done;
  } catch {
    // ignore best-effort heartbeat failures
  }
}

async function releaseActionQueueLock(ownerId: string): Promise<void> {
  try {
    const db = await initCacheDB();
    const tx = db.transaction(CACHE_STORES.LOCKS, "readwrite");
    const store = tx.objectStore(CACHE_STORES.LOCKS);
    const existing = (await store.get(ACTION_QUEUE_LOCK_ID)) as
      | ActionQueueLockRecord
      | undefined;

    if (existing?.ownerId === ownerId) {
      await store.delete(ACTION_QUEUE_LOCK_ID);
    }
    await tx.done;
  } catch {
    // ignore release failures; TTL will expire
  }
}

// Action types for the offline queue
export const QUEUE_ACTIONS = {
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
} as const;

export type QueueActionType = typeof QUEUE_ACTIONS[keyof typeof QUEUE_ACTIONS];

// Status of queued actions
export const QUEUE_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type QueueStatus = (typeof QUEUE_STATUS)[keyof typeof QUEUE_STATUS];

// Interface for queued actions
export interface QueuedAction {
  id: string;
  type: QueueActionType;
  payload: any;
  timestamp: number;
  status: QueueStatus;
  retryCount: number;
  maxRetries: number;
  userId: string;
  sessionId?: string;
  schoolId?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  };
  metadata?: {
    userAgent?: string;
    appVersion?: string;
    platform?: string;
    networkStatus?: string;
  };
  // For cache management
  _cached?: boolean;
  _cachedAt?: number;
  _expiresAt?: number;
}

// Configuration for the action queue
export const QUEUE_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // 1 second base delay
  RETRY_DELAY_MULTIPLIER: 2, // Exponential backoff
  MAX_QUEUE_SIZE: 1000,
  SYNC_INTERVAL: 30000, // 30 seconds
  BATCH_SIZE: 10, // Process 10 actions at a time
  EXPIRATION_TIME: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Initialize the action queue database
export async function initActionQueue(): Promise<void> {
  try {
    await initCacheDB();
    console.log("Action queue initialized successfully");
  } catch (error) {
    console.error("Failed to initialize action queue:", error);
    throw error;
  }
}

// Add an action to the offline queue
export async function queueAction(
  type: QueueActionType,
  payload: any,
  userId: string,
  metadata?: Partial<QueuedAction>
): Promise<string> {
  try {
    if (![QUEUE_ACTIONS.CHECK_IN, QUEUE_ACTIONS.CHECK_OUT].includes(type)) {
      throw new Error(`Unsupported action type: ${type}`);
    }

    const db = await initCacheDB();
    const actionId = generateActionId();
    const now = Date.now();

    const queuedAction: QueuedAction = {
      id: actionId,
      type,
      payload,
      timestamp: now,
      status: QUEUE_STATUS.PENDING,
      retryCount: 0,
      maxRetries: QUEUE_CONFIG.MAX_RETRY_ATTEMPTS,
      userId,
      metadata: {
        userAgent: navigator.userAgent,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
        platform: navigator.platform,
        networkStatus: navigator.onLine ? "online" : "offline",
        ...metadata?.metadata,
      },
      ...metadata,
      // Cache metadata
      _cached: true,
      _cachedAt: now,
      _expiresAt: now + QUEUE_CONFIG.EXPIRATION_TIME,
    };

    await db.add(CACHE_STORES.PENDING_ACTIONS, queuedAction);

    console.log(`Action queued: ${type} for user ${userId}`, queuedAction);

    // Trigger immediate sync if online
    if (navigator.onLine) {
      setTimeout(() => processQueue(), 100);
    }

    return actionId;
  } catch (error) {
    console.error("Failed to queue action:", error);
    throw error;
  }
}

// Queue a check-in action
export async function queueCheckIn(
  schoolId: string,
  userId: string,
  location: { latitude: number; longitude: number; accuracy?: number },
  distanceFromCenter?: number
): Promise<string> {
  const payload = {
    schoolId,
    userId,
    location: {
      ...location,
      timestamp: Date.now(),
    },
    // Persist actual geofence distance so syncCheckIn can use it on replay
    distanceFromCenterAtCheckIn: distanceFromCenter ?? location.accuracy ?? 0,
    action: "check_in",
    timestamp: Date.now(),
  };

  return queueAction(QUEUE_ACTIONS.CHECK_IN, payload, userId, {
    schoolId,
    location: {
      ...location,
      timestamp: Date.now(),
    },
  });
}

// Queue a check-out action
export async function queueCheckOut(
  sessionId: string,
  userId: string,
  location: { latitude: number; longitude: number; accuracy?: number }
): Promise<string> {
  const payload = {
    sessionId,
    userId,
    location: {
      ...location,
      timestamp: Date.now(),
    },
    action: "check_out",
    timestamp: Date.now(),
  };

  return queueAction(QUEUE_ACTIONS.CHECK_OUT, payload, userId, {
    sessionId,
    location: {
      ...location,
      timestamp: Date.now(),
    },
  });
}

// Get all pending actions from the queue
export async function getPendingActions(
  userId?: string
): Promise<QueuedAction[]> {
  try {
    const db = await initCacheDB();
    const allActions = await db.getAll(CACHE_STORES.PENDING_ACTIONS);

    let actions = allActions.filter(
      (action: QueuedAction) =>
        action.status === QUEUE_STATUS.PENDING ||
        action.status === QUEUE_STATUS.FAILED
    );

    if (userId) {
      actions = actions.filter(
        (action: QueuedAction) => action.userId === userId
      );
    }

    // Sort by timestamp (oldest first)
    actions.sort(
      (a: QueuedAction, b: QueuedAction) => a.timestamp - b.timestamp
    );

    return actions;
  } catch (error) {
    console.error("Failed to get pending actions:", error);
    return [];
  }
}

// Update action status
export async function updateActionStatus(
  actionId: string,
  status: QueueStatus,
  errorMessage?: string
): Promise<void> {
  try {
    const db = await initCacheDB();
    const action = await db.get(CACHE_STORES.PENDING_ACTIONS, actionId);

    if (action) {
      action.status = status;
      action._cachedAt = Date.now();

      if (status === QUEUE_STATUS.FAILED && errorMessage) {
        action.errorMessage = errorMessage;
        action.retryCount += 1;
      }

      if (status === QUEUE_STATUS.SYNCED) {
        action.syncedAt = Date.now();
      }

      await db.put(CACHE_STORES.PENDING_ACTIONS, action);
    }
  } catch (error) {
    console.error("Failed to update action status:", error);
  }
}

// Remove completed actions from the queue
export async function removeCompletedActions(): Promise<number> {
  try {
    const db = await initCacheDB();
    const allActions = await db.getAll(CACHE_STORES.PENDING_ACTIONS);

    let removedCount = 0;
    const now = Date.now();

    for (const action of allActions) {
      const shouldRemove =
        action.status === QUEUE_STATUS.SYNCED ||
        action.status === QUEUE_STATUS.CANCELLED ||
        (action._expiresAt && action._expiresAt < now) ||
        (action.retryCount >= action.maxRetries &&
          action.status === QUEUE_STATUS.FAILED);

      if (shouldRemove) {
        await db.delete(CACHE_STORES.PENDING_ACTIONS, action.id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Removed ${removedCount} completed actions from queue`);
    }

    return removedCount;
  } catch (error) {
    console.error("Failed to remove completed actions:", error);
    return 0;
  }
}

// Process the action queue (sync with server)
export async function processQueue(): Promise<{
  processed: number;
  synced: number;
  failed: number;
}> {
  try {
    const lock = await tryAcquireActionQueueLock();
    if (!lock.acquired) {
      // Another tab is already processing the shared IndexedDB queue.
      return { processed: 0, synced: 0, failed: 0 };
    }

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      heartbeat = setInterval(() => {
        refreshActionQueueLock(lock.ownerId).catch(() => undefined);
      }, ACTION_QUEUE_LOCK_HEARTBEAT_MS);

    const pendingActions = await getPendingActions();

    if (pendingActions.length === 0) {
      return { processed: 0, synced: 0, failed: 0 };
    }

    console.log(`Processing ${pendingActions.length} pending actions`);

    let synced = 0;
    let failed = 0;
    let processed = 0;

    // Process actions in batches
    const batches = chunkArray(pendingActions, QUEUE_CONFIG.BATCH_SIZE);

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map((action) => processQueuedAction(action))
      );

      batchResults.forEach((result, index) => {
        processed++;
        if (result.status === "fulfilled" && result.value) {
          synced++;
        } else {
          failed++;
          console.error(
            `Failed to process action ${batch[index].id}:`,
            result.status === "rejected" ? result.reason : "Unknown error"
          );
        }
      });

      // Small delay between batches to avoid overwhelming the server
      if (batches.length > 1) {
        await delay(500);
      }
    }

    // Clean up completed actions
    await removeCompletedActions();

    console.log(
      `Queue processing complete: ${synced} synced, ${failed} failed`
    );

    return { processed, synced, failed };
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await releaseActionQueueLock(lock.ownerId);
    }
  } catch (error) {
    console.error("Failed to process queue:", error);
    return { processed: 0, synced: 0, failed: 0 };
  }
}

// Process a single action
export async function processQueuedAction(action: QueuedAction): Promise<boolean> {
  try {
    await updateActionStatus(action.id, QUEUE_STATUS.SYNCING);

    let success = false;

    success = await syncActionByType(action);

    if (success) {
      await updateActionStatus(action.id, QUEUE_STATUS.SYNCED);
    } else {
      await updateActionStatus(
        action.id,
        QUEUE_STATUS.FAILED,
        "Sync operation failed"
      );
    }

    return success;
  } catch (error) {
    console.error(`Error processing action ${action.id}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await updateActionStatus(action.id, QUEUE_STATUS.FAILED, errorMessage);
    return false;
  }
}

async function syncActionByType(action: QueuedAction): Promise<boolean> {
  switch (action.type) {
    case QUEUE_ACTIONS.CHECK_IN:
      return syncCheckIn(action);
    case QUEUE_ACTIONS.CHECK_OUT:
      return syncCheckOut(action);
    default:
      console.warn(`Unknown action type: ${action.type}`);
      return false;
  }
}

// Sync check-in action using Cloud Function
async function syncCheckIn(action: QueuedAction): Promise<boolean> {
  const payload = action.payload;
  const startMs = payload.location?.timestamp ?? action.timestamp;
  const startDate = new Date(startMs);
  const startTimestamp = Timestamp.fromMillis(startMs);
  const dayKey = getDayKey(startTimestamp);

  const startSessionFn = httpsCallable(functions, "startSession");

  try {
    const response = await startSessionFn({
      locationId: payload.schoolId || action.schoolId || payload.locationId,
      startTime: startDate.toISOString(),
      checkInMethod: "offline-sync",
      distanceFromCenterAtCheckIn:
        payload.distanceFromCenterAtCheckIn ??
        payload.location?.accuracy ??
        0,
      dayKey,
      checkInLocation: payload.location
        ? {
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            accuracy: payload.location.accuracy,
          }
        : undefined,
    });

    const data = (response as any)?.data;
    if (!data?.success) {
      throw new Error("startSession callable returned failure");
    }

    console.log("Check-in synced successfully:", {
      sessionId: data.sessionId,
      actionId: action.id,
    });
    return true;
  } catch (error) {
    console.error("Failed to sync check-in:", error);
    return false;
  }
}

// Sync check-out action using Cloud Function
async function syncCheckOut(action: QueuedAction): Promise<boolean> {
  const sessionId = action.sessionId || action.payload.sessionId;
  if (!sessionId) {
    console.error("Session ID is required for check-out");
    return false;
  }

  const checkoutMs = action.payload.location?.timestamp ?? action.timestamp;
  const checkoutDate = new Date(checkoutMs);

  const endSessionFn = httpsCallable(functions, "endSession");

  try {
    const response = await endSessionFn({
      sessionId,
      checkOutTime: checkoutDate.toISOString(),
      checkOutLocation: action.payload.location
        ? {
            latitude: action.payload.location.latitude,
            longitude: action.payload.location.longitude,
            accuracy: action.payload.location.accuracy,
          }
        : undefined,
      distanceFromCenterAtCheckOut:
        action.payload.location?.accuracy ??
        action.payload.distanceFromCenterAtCheckOut ??
        undefined,
    });

    const data = (response as any)?.data;
    if (!data?.success) {
      throw new Error("endSession callable returned failure");
    }

    console.log("Check-out synced successfully:", {
      sessionId,
      actionId: action.id,
    });
    return true;
  } catch (error) {
    console.error("Failed to sync check-out:", error);
    return false;
  }
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  total: number;
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  cancelled: number;
  oldestPending?: number;
  newestPending?: number;
}> {
  try {
    const db = await initCacheDB();
    const allActions = await db.getAll(CACHE_STORES.PENDING_ACTIONS);

    const stats = {
      total: allActions.length,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
      oldestPending: undefined as number | undefined,
      newestPending: undefined as number | undefined,
    };

    const pendingTimestamps: number[] = [];

    allActions.forEach((action: QueuedAction) => {
      switch (action.status) {
        case QUEUE_STATUS.PENDING:
          stats.pending++;
          pendingTimestamps.push(action.timestamp);
          break;
        case QUEUE_STATUS.SYNCING:
          stats.syncing++;
          break;
        case QUEUE_STATUS.SYNCED:
          stats.synced++;
          break;
        case QUEUE_STATUS.FAILED:
          stats.failed++;
          break;
        case QUEUE_STATUS.CANCELLED:
          stats.cancelled++;
          break;
      }
    });

    if (pendingTimestamps.length > 0) {
      stats.oldestPending = Math.min(...pendingTimestamps);
      stats.newestPending = Math.max(...pendingTimestamps);
    }

    return stats;
  } catch (error) {
    console.error("Failed to get queue stats:", error);
    return {
      total: 0,
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      cancelled: 0,
    };
  }
}

// Cancel a pending action
export async function cancelAction(actionId: string): Promise<boolean> {
  try {
    await updateActionStatus(actionId, QUEUE_STATUS.CANCELLED);
    console.log(`Action ${actionId} cancelled`);
    return true;
  } catch (error) {
    console.error("Failed to cancel action:", error);
    return false;
  }
}

// Retry a failed action
export async function retryAction(actionId: string): Promise<boolean> {
  try {
    const db = await initCacheDB();
    const action = await db.get(CACHE_STORES.PENDING_ACTIONS, actionId);

    if (action && action.status === QUEUE_STATUS.FAILED) {
      if (action.retryCount < action.maxRetries) {
        action.status = QUEUE_STATUS.PENDING;
        action.retryCount = Math.max(0, action.retryCount - 1); // Reset retry count
        await db.put(CACHE_STORES.PENDING_ACTIONS, action);

        // Trigger immediate processing
        setTimeout(() => processQueue(), 100);

        return true;
      } else {
        console.warn(`Action ${actionId} has exceeded max retries`);
        return false;
      }
    }

    return false;
  } catch (error) {
    console.error("Failed to retry action:", error);
    return false;
  }
}

// Utility functions
function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
