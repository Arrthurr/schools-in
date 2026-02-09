/**
 * Cached Session Service - High-performance session operations with intelligent caching
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../../firebase.config";
import { functions } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Session, Location } from "@/lib/firebase/types";
import { FirebaseCache, CacheTracker } from "@/lib/cache/FirebaseCache";
import {
  getCurrentWeekRange,
  getTodayRange,
  getLastNDaysRange,
  minutesToHours,
} from "@/lib/utils/time";
import { validateGeofence } from "@/lib/utils/geo";

export interface SessionFilters {
  userId?: string;
  locationId?: string;
  status?: "active" | "paused" | "completed" | "cancelled";
  dayKey?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  averageDurationHours: number;
  totalHoursThisWeek: number;
  sessionsThisWeek: number;
  lastUpdated: Date;
}

export interface StartSessionData {
  locationId: string;
  startTime: Date;
  checkInMethod: "geo" | "manual" | "offline-sync";
  distanceFromCenterAtCheckIn: number;
  dayKey: string;
  notes?: string;
  /** GPS coordinates at check-in (required for admin manual check-in, recommended for all) */
  checkInLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface EndSessionData {
  endTime: Date;
  durationMinutes?: number;
  notes?: string;
}

export class CachedSessionService {
  // Start a new session using the callable function
  static async startSession(
    sessionData: StartSessionData,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session> {
    const { forceRefresh = false } = options;

    try {
      // Call the Firebase function to atomically create the session
      const startSessionFunction = httpsCallable(functions, "startSession");
      const result = await startSessionFunction(sessionData);
      const data = result.data as any;

      if (!data.success) {
        throw new Error(data.error || "Failed to start session");
      }

      const session = data.session as Session;

      // Clear related caches to ensure fresh data
      if (forceRefresh) {
        await this.clearSessionCaches(session.userId, session.locationId);
      }

      return session;
    } catch (error: any) {
      console.error("Error starting session:", error);
      throw new Error(error.message || "Failed to start session");
    }
  }

  // End an active session
  static async endSession(
    sessionId: string,
    endData: EndSessionData,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session> {
    const { forceRefresh = false } = options;

    try {
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data() as Session;

      if (sessionData.status !== "active" && sessionData.status !== "paused") {
        throw new Error("Session is not active or paused");
      }

      // Calculate duration if not provided
      let durationMinutes = endData.durationMinutes;
      if (!durationMinutes && sessionData.startTime) {
        const startMs = sessionData.startTime.toMillis();
        const endMs = endData.endTime.getTime();
        durationMinutes = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60)));
      }

      const updatedSessionData = {
        endTime: Timestamp.fromDate(endData.endTime),
        checkOutTime: Timestamp.fromDate(endData.endTime),
        status: "completed" as const,
        active: false,
        durationMinutes,
        notes: endData.notes || sessionData.notes,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(sessionRef, updatedSessionData);

      const updatedSession = {
        ...sessionData,
        ...updatedSessionData,
        id: sessionId,
      };

      // Clear related caches
      if (forceRefresh) {
        await this.clearSessionCaches(
          sessionData.userId,
          sessionData.locationId
        );
      }

      return updatedSession;
    } catch (error: any) {
      console.error("Error ending session:", error);
      throw new Error(error.message || "Failed to end session");
    }
  }

  // Pause an active session
  static async pauseSession(
    sessionId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session> {
    const { forceRefresh = false } = options;

    try {
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data() as Session;

      if (sessionData.status !== "active") {
        throw new Error("Only active sessions can be paused");
      }

      const updatedSessionData = {
        status: "paused" as const,
        active: true,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(sessionRef, updatedSessionData);

      const updatedSession = {
        ...sessionData,
        ...updatedSessionData,
        id: sessionId,
      };

      // Clear related caches
      if (forceRefresh) {
        await this.clearSessionCaches(
          sessionData.userId,
          sessionData.locationId
        );
      }

      return updatedSession;
    } catch (error: any) {
      console.error("Error pausing session:", error);
      throw new Error(error.message || "Failed to pause session");
    }
  }

  // Resume a paused session
  static async resumeSession(
    sessionId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session> {
    const { forceRefresh = false } = options;

    try {
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data() as Session;

      if (sessionData.status !== "paused") {
        throw new Error("Only paused sessions can be resumed");
      }

      const updatedSessionData = {
        status: "active" as const,
        active: true,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(sessionRef, updatedSessionData);

      const updatedSession = {
        ...sessionData,
        ...updatedSessionData,
        id: sessionId,
      };

      // Clear related caches
      if (forceRefresh) {
        await this.clearSessionCaches(
          sessionData.userId,
          sessionData.locationId
        );
      }

      return updatedSession;
    } catch (error: any) {
      console.error("Error resuming session:", error);
      throw new Error(error.message || "Failed to resume session");
    }
  }

  // Get active session for a user
  static async getActiveSession(
    userId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session | null> {
    const { forceRefresh = false } = options;

    const cacheKey = `active_session_${userId}`;

    return FirebaseCache.cacheSessionData(
      cacheKey,
      async () => {
        const q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("userId", "==", userId),
          where("status", "in", ["active", "paused"]),
          orderBy("startTime", "desc"),
          limit(1)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data(),
        } as Session;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get sessions for a user with filtering
  static async getUserSessions(
    userId: string,
    filters: Omit<SessionFilters, "userId"> = {},
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<Session[]> {
    const { forceRefresh = false, limit: limitCount = 50 } = options;

    const cacheKey = FirebaseCache.generateQueryKey(
      `user_sessions_${userId}`,
      filters,
      "startTime",
      limitCount
    );

    return FirebaseCache.cacheSessionData(
      cacheKey,
      async () => {
        let q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("userId", "==", userId)
        );

        // Apply filters
        if (filters.status) {
          q = query(q, where("status", "==", filters.status));
        }

        if (filters.locationId) {
          q = query(q, where("locationId", "==", filters.locationId));
        }

        if (filters.dayKey) {
          q = query(q, where("dayKey", "==", filters.dayKey));
        }

        // Apply date range filter using startTime
        if (filters.startDate) {
          q = query(
            q,
            where("startTime", ">=", Timestamp.fromDate(filters.startDate))
          );
        }

        if (filters.endDate) {
          q = query(
            q,
            where("startTime", "<=", Timestamp.fromDate(filters.endDate))
          );
        }

        // Order by start time and apply limit
        q = query(q, orderBy("startTime", "desc"), limit(limitCount));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Session)
        );
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get sessions for this week for a user
  static async getUserWeeklySessions(
    userId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session[]> {
    const { forceRefresh = false } = options;

    const weekRange = getCurrentWeekRange();

    return this.getUserSessions(
      userId,
      {
        status: "completed",
        startDate: weekRange.start.toDate(),
        endDate: weekRange.end.toDate(),
      },
      { forceRefresh }
    );
  }

  // Get all active sessions (for admin dashboard)
  static async getActiveSessions(
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<Session[]> {
    const { forceRefresh = false, limit: limitCount = 100 } = options;

    const cacheKey = `active_sessions_all_${limitCount}`;

    return FirebaseCache.cacheSessionData(
      cacheKey,
      async () => {
        const q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "active"),
          orderBy("startTime", "desc"),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Session)
        );
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get sessions for today (for admin dashboard)
  static async getTodaySessions(
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session[]> {
    const { forceRefresh = false } = options;

    const todayRange = getTodayRange();

    const cacheKey = `today_sessions_${todayRange.start.toMillis()}`;

    return FirebaseCache.cacheSessionData(
      cacheKey,
      async () => {
        const q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("startTime", ">=", todayRange.start),
          where("startTime", "<=", todayRange.end),
          orderBy("startTime", "desc")
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Session)
        );
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get recent session activity for admin dashboard
  static async getRecentActivity(
    options: { forceRefresh?: boolean; limit?: number } = {}
  ): Promise<Session[]> {
    const { forceRefresh = false, limit: limitCount = 10 } = options;

    const cacheKey = `recent_activity_${limitCount}`;

    return FirebaseCache.cacheSessionData(
      cacheKey,
      async () => {
        const q = query(
          collection(db, COLLECTIONS.SESSIONS),
          orderBy("updatedAt", "desc"),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Session)
        );
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get average session duration for last N days
  static async getAverageSessionDuration(
    days: number = 30,
    options: { forceRefresh?: boolean } = {}
  ): Promise<number> {
    const { forceRefresh = false } = options;

    const dateRange = getLastNDaysRange(days);
    const cacheKey = `avg_duration_${days}_${dateRange.start.toMillis()}`;

    return FirebaseCache.cacheStats(
      cacheKey,
      async () => {
        const q = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "completed"),
          where("startTime", ">=", dateRange.start),
          where("startTime", "<=", dateRange.end)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) return 0;

        let totalDuration = 0;
        let count = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.durationMinutes && data.durationMinutes > 0) {
            totalDuration += data.durationMinutes;
            count++;
          }
        });

        return count > 0 ? minutesToHours(totalDuration / count) : 0;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Get session by ID
  static async getSessionById(
    sessionId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<Session | null> {
    const { forceRefresh = false } = options;

    return FirebaseCache.cacheSessionData(
      `session_${sessionId}`,
      async () => {
        const sessionDoc = await getDoc(
          doc(db, COLLECTIONS.SESSIONS, sessionId)
        );

        if (!sessionDoc.exists()) return null;

        return {
          id: sessionDoc.id,
          ...sessionDoc.data(),
        } as Session;
      },
      {
        forceRefresh,
        onCacheHit: () => CacheTracker.recordHit(),
        onCacheMiss: () => CacheTracker.recordMiss(),
      }
    );
  }

  // Validate geofence for session start
  static async validateSessionGeofence(
    locationId: string,
    userLatitude: number,
    userLongitude: number
  ): Promise<{
    isValid: boolean;
    distance: number;
    radiusMeters: number;
  }> {
    try {
      // Get location data
      const locationDoc = await getDoc(
        doc(db, COLLECTIONS.LOCATIONS, locationId)
      );

      if (!locationDoc.exists()) {
        throw new Error("Location not found");
      }

      const locationData = locationDoc.data() as Location;

      if (!locationData.geo) {
        throw new Error("Location has no GPS coordinates");
      }

      const radiusMeters = locationData.radiusMeters || 300;
      const validation = validateGeofence(
        userLatitude,
        userLongitude,
        locationData.geo,
        radiusMeters
      );

      return {
        isValid: validation.isWithinGeofence,
        distance: validation.distance,
        radiusMeters,
      };
    } catch (error: any) {
      console.error("Error validating geofence:", error);
      throw new Error(error.message || "Failed to validate location");
    }
  }

  // Clear session-related caches
  static async clearSessionCaches(
    userId?: string,
    locationId?: string
  ): Promise<void> {
    const cacheKeys = [
      "sessions_",
      "active_sessions_",
      "recent_activity_",
      "avg_duration_",
      "today_sessions_",
    ];

    if (userId) {
      cacheKeys.push(`active_session_${userId}`, `user_sessions_${userId}`);
    }

    if (locationId) {
      cacheKeys.push(`location_sessions_${locationId}`);
    }

    // Use the available invalidateCache method
    await FirebaseCache.invalidateCache(cacheKeys);
  }

  // Delete a session (admin only)
  static async deleteSession(
    sessionId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<void> {
    const { forceRefresh = false } = options;

    try {
      const sessionRef = doc(db, COLLECTIONS.SESSIONS, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        throw new Error("Session not found");
      }

      const sessionData = sessionDoc.data() as Session;

      await deleteDoc(sessionRef);

      // Clear related caches
      if (forceRefresh) {
        await this.clearSessionCaches(
          sessionData.userId,
          sessionData.locationId
        );
      }
    } catch (error: any) {
      console.error("Error deleting session:", error);
      throw new Error(error.message || "Failed to delete session");
    }
  }
}
