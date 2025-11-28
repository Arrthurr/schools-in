// Custom service worker functionality for Schools In PWA
// This extends the auto-generated next-pwa service worker

import { openDB } from "idb";

// Types
interface OfflineAction {
  id: string;
  type: "checkIn" | "checkOut";
  data: any;
  timestamp: number;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  retryCount: number;
  schoolName?: string;
}

// Database setup for offline data
const DB_NAME = "schools-in-offline";
const DB_VERSION = 1;

const STORES = {
  SCHOOLS: "schools",
  SESSIONS: "sessions",
  PENDING_ACTIONS: "pending-actions",
  USER_DATA: "user-data",
};

// Initialize IndexedDB
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Schools store
      if (!db.objectStoreNames.contains(STORES.SCHOOLS)) {
        const schoolsStore = db.createObjectStore(STORES.SCHOOLS, {
          keyPath: "id",
        });
        schoolsStore.createIndex("name", "name");
      }

      // Sessions store
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionsStore = db.createObjectStore(STORES.SESSIONS, {
          keyPath: "id",
        });
        sessionsStore.createIndex("userId", "userId");
        sessionsStore.createIndex("schoolId", "schoolId");
        sessionsStore.createIndex("startTime", "startTime");
      }

      // Pending actions store (for offline operations)
      if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        const pendingStore = db.createObjectStore(STORES.PENDING_ACTIONS, {
          keyPath: "id",
          autoIncrement: true,
        });
        pendingStore.createIndex("timestamp", "timestamp");
        pendingStore.createIndex("type", "type");
      }

      // User data store
      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        db.createObjectStore(STORES.USER_DATA, {
          keyPath: "id",
        });
      }
    },
  });
}

// Cache school data for offline access
export async function cacheSchoolData(schools: any[]) {
  const db = await initDB();
  const tx = db.transaction(STORES.SCHOOLS, "readwrite");

  for (const school of schools) {
    await tx.store.put(school);
  }

  await tx.done;
}

// Get cached schools for offline use
export async function getCachedSchools(userId?: string) {
  const db = await initDB();
  const schools = await db.getAll(STORES.SCHOOLS);

  // Filter by user assignments if userId provided
  if (userId) {
    return schools.filter((school) =>
      school.assignedProviders?.includes(userId)
    );
  }

  return schools;
}

// Cache session data
export async function cacheSessionData(sessions: any[]) {
  const db = await initDB();
  const tx = db.transaction(STORES.SESSIONS, "readwrite");

  for (const session of sessions) {
    await tx.store.put(session);
  }

  await tx.done;
}

// Get cached sessions
export async function getCachedSessions(userId?: string) {
  const db = await initDB();

  if (userId) {
    return await db.getAllFromIndex(STORES.SESSIONS, "userId", userId);
  }

  return await db.getAll(STORES.SESSIONS);
}

// Queue offline actions
export async function queueOfflineAction(action: {
  type: "check-in" | "check-out" | "session-update";
  data: any;
  timestamp: number;
  retry?: number;
}) {
  const db = await initDB();
  await db.add(STORES.PENDING_ACTIONS, {
    ...action,
    timestamp: action.timestamp || Date.now(),
    retry: action.retry || 0,
  });
}

// Get pending offline actions
export async function getPendingActions() {
  const db = await initDB();
  return await db.getAll(STORES.PENDING_ACTIONS);
}

// Remove completed action
export async function removePendingAction(id: number) {
  const db = await initDB();
  await db.delete(STORES.PENDING_ACTIONS, id);
}

// Cache user data
export async function cacheUserData(userData: any) {
  const db = await initDB();
  await db.put(STORES.USER_DATA, { id: "current-user", ...userData });
}

// Get cached user data
export async function getCachedUserData() {
  const db = await initDB();
  return await db.get(STORES.USER_DATA, "current-user");
}

// Get all queued actions
export async function getQueuedActions(): Promise<OfflineAction[]> {
  const db = await initDB();
  return db.getAll(STORES.PENDING_ACTIONS);
}

// Sync pending actions when online
export async function syncPendingActions(): Promise<void> {
  const db = await initDB();
  const actions = await db.getAll(STORES.PENDING_ACTIONS);

  const {
    createDocument,
    updateDocument,
    getDocument,
    COLLECTIONS,
  } = await import("@/lib/firebase/firestore");
  const { Timestamp } = await import("firebase/firestore");
  const { getDayKey } = await import("@/lib/utils/time");

  for (const action of actions) {
    try {
      let success = false;

      if (action.type === "check-in") {
        // Sync check-in using Firebase SDK
        const payload = action.data;
        const now = Timestamp.now();
        const dayKey = getDayKey(now);

        const sessionData = {
          userId: payload.userId,
          locationId: payload.schoolId || payload.locationId,
          startTime: now,
          checkInTime: now, // Legacy field
          status: "active" as const,
          checkInMethod: "offline-sync" as const,
          distanceFromCenterAtCheckIn: payload.location?.accuracy ?? payload.distanceFromCenterAtCheckIn ?? 0,
          dayKey,
          createdAt: now,
          updatedAt: now,
        };

        await createDocument(COLLECTIONS.SESSIONS, sessionData);
        success = true;
      } else if (action.type === "check-out") {
        // Sync check-out using Firebase SDK
        const sessionId = action.data.sessionId;
        
        if (!sessionId) {
          throw new Error("Session ID is required for check-out");
        }

        const session = await getDocument(COLLECTIONS.SESSIONS, sessionId);

        if (!session) {
          throw new Error("Session not found");
        }

        const sessionData = session as any;
        const startTime = sessionData.startTime || sessionData.checkInTime;
        
        if (!startTime) {
          throw new Error("Session missing start time");
        }

        const now = Timestamp.now();
        const startMs = startTime.toMillis ? startTime.toMillis() : startTime.seconds * 1000;
        const endMs = now.toMillis();
        const durationMinutes = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60)));

        const updateData = {
          endTime: now,
          checkOutTime: now, // Legacy field
          status: "completed" as const,
          durationMinutes,
          updatedAt: now,
        };

        await updateDocument(COLLECTIONS.SESSIONS, sessionId, updateData);
        success = true;
      } else {
        continue; // Skip unknown action types
      }

      if (success) {
        // Remove from queue on success
        await db.delete(STORES.PENDING_ACTIONS, action.id);
      } else {
        // Increment retry count
        action.retry = (action.retry || 0) + 1;
        await db.put(STORES.PENDING_ACTIONS, action);
      }
    } catch (error) {
      console.error("Failed to sync action:", error);
      // Increment retry count
      action.retry = (action.retry || 0) + 1;
      await db.put(STORES.PENDING_ACTIONS, action);
    }
  }
}

// Clear all queued actions
export async function clearQueue(): Promise<void> {
  const db = await initDB();
  await db.clear(STORES.PENDING_ACTIONS);
}

// Clear all cached data (for logout/reset)
export async function clearOfflineData() {
  const db = await initDB();

  await Promise.all([
    db.clear(STORES.SCHOOLS),
    db.clear(STORES.SESSIONS),
    db.clear(STORES.PENDING_ACTIONS),
    db.clear(STORES.USER_DATA),
  ]);
}
