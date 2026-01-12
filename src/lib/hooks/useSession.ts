// Custom React hook for session management

import { useState, useCallback, useEffect } from "react";
import { Timestamp, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getSessionsByUser,
  COLLECTIONS,
} from "../firebase/firestore";
import { SessionData, calculateSessionDuration } from "../utils/session";
import { getDayKey } from "../utils/time";
import { Coordinates } from "../utils/location";
import { useAuth } from "./useAuth";
import { db, functions } from "../../../firebase.config";
import { queueManager } from "../offline/queueManager";

interface UseSessionReturn {
  currentSession: SessionData | null;
  sessions: SessionData[];
  loading: boolean;
  error: string | null;
  totalSessions: number;
  hasMore: boolean;
  checkIn: (schoolId: string, location: Coordinates) => Promise<void>;
  checkOut: (sessionId: string, location: Coordinates) => Promise<void>;
  loadSessions: (
    userId?: string,
    page?: number,
    pageSize?: number,
    filters?: {
      schoolId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) => Promise<void>;
  clearError: () => void;
}

export const useSession = (): UseSessionReturn => {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState<SessionData | null>(
    null
  );
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const checkIn = useCallback(
    async (schoolId: string, location: Coordinates) => {
      if (!user) {
        setError("User must be authenticated to check in");
        return;
      }

      if (currentSession) {
        setError("You already have an active session. Please check out first.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const startDate = new Date();
        const startSessionFn = httpsCallable(functions, "startSession");

        const payload = {
          locationId: schoolId,
          startTime: startDate.toISOString(),
          checkInMethod: "geo",
          distanceFromCenterAtCheckIn: location.accuracy ?? 0,
          dayKey: getDayKey(Timestamp.fromDate(startDate)),
          checkInLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          },
        };

        if (!navigator.onLine) {
          throw new Error("Offline - queue check-in");
        }

        const result = await startSessionFn(payload);
        const data = result.data as any;

        if (!data?.success) {
          throw new Error("Failed to start session");
        }

        const newSession: SessionData = {
          id: data.sessionId,
          userId: user.uid,
          locationId: schoolId,
          schoolId,
          checkInTime: Timestamp.fromDate(startDate),
          checkInLocation: location,
          status: "active",
          checkInMethod: "geo",
          distanceFromCenterAtCheckIn: location.accuracy ?? 0,
          dayKey: payload.dayKey,
        };

        setCurrentSession(newSession);
        setSessions((prev) => [newSession, ...prev]);
      } catch (err) {
        console.error("Check-in error:", err);

        try {
          const queued = await queueManager.checkIn(schoolId, user.uid, {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          });

          if (queued.offline) {
            setError("Offline: check-in queued for sync");
          } else if (!queued.success) {
            setError("Failed to check in");
          }
        } catch (queueError) {
          console.error("Failed to queue offline check-in:", queueError);
          setError(
            queueError instanceof Error
              ? queueError.message
              : "Failed to check in"
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [user, currentSession]
  );

  const checkOut = useCallback(
    async (sessionId: string, location: Coordinates) => {
      setLoading(true);
      setError(null);

      try {
        const checkOutDate = new Date();
        if (!navigator.onLine) {
          throw new Error("Offline - queue check-out");
        }

        const endSessionFn = httpsCallable(functions, "endSession");
        const response = await endSessionFn({
          sessionId,
          checkOutTime: checkOutDate.toISOString(),
          checkOutLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          },
          distanceFromCenterAtCheckOut: location.accuracy ?? undefined,
        });

        const data = response.data as any;
        if (!data?.success) {
          throw new Error("Failed to complete session");
        }

        setCurrentSession(null);
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  status: "completed",
                  checkOutTime: Timestamp.fromDate(checkOutDate),
                  endTime: Timestamp.fromDate(checkOutDate),
                  checkOutLocation: location,
                }
              : session
          )
        );
      } catch (err) {
        try {
          const queued = await queueManager.checkOut(sessionId, user?.uid || "unknown-user", {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          });

          if (queued.offline) {
            setError("Offline: check-out queued for sync");
            // Don't clear currentSession here - it's only queued, not completed.
            // The real-time subscription will clear it when checkout actually syncs to the server.
          } else if (!queued.success) {
            setError("Failed to check out");
          }
        } catch (queueError) {
          setError(
            queueError instanceof Error
              ? queueError.message
              : "Failed to check out"
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [currentSession, sessions, user?.uid]
  );

  const loadSessions = useCallback(
    async (
      userId?: string,
      page: number = 1,
      pageSize: number = 10,
      filters?: {
        schoolId?: string;
        startDate?: Date;
        endDate?: Date;
      }
    ) => {
      const targetUserId = userId || user?.uid;

      if (!targetUserId) {
        setError("No user ID provided for loading sessions");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await getSessionsByUser(
          targetUserId,
          page,
          pageSize,
          filters
        );
        let activeSession: SessionData | null = null;

        // Cast Session array to SessionData array via unknown
        const convertedSessions = result.sessions as unknown as SessionData[];

        // Ensure all completed sessions have duration calculated
        const sessionsWithDuration = convertedSessions.map((session) => {
          if (
            session.status === "completed" &&
            !session.duration &&
            session.checkInTime &&
            session.checkOutTime
          ) {
            return {
              ...session,
              duration: calculateSessionDuration(
                session.checkInTime,
                session.checkOutTime
              ),
            };
          }
          return session;
        });

        // Find active session
        for (const session of sessionsWithDuration) {
          if (session.status === "active") {
            activeSession = session;
            break;
          }
        }

        setSessions(sessionsWithDuration);
        setCurrentSession(activeSession);
        setTotalSessions(result.total);
        setHasMore(result.hasMore);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sessions"
        );
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load sessions when user changes
  useEffect(() => {
    if (user?.uid) {
      loadSessions(user.uid);
    } else {
      setCurrentSession(null);
      setSessions([]);
    }
  }, [user?.uid, loadSessions]);

  // Real-time active/paused session listener to keep currentSession in sync
  useEffect(() => {
    if (!user?.uid) {
      setCurrentSession(null);
      return;
    }

    const activeQ = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("userId", "==", user.uid),
      where("status", "in", ["active", "paused"]),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const legacyQ = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("userId", "==", user.uid),
      where("active", "==", true),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubNew = onSnapshot(activeQ, (snap) => {
      if (snap.empty) {
        setCurrentSession(null);
        return;
      }
      const d = snap.docs[0];
      const data = d.data() as any;
      const session: SessionData = {
        id: d.id,
        ...(data as SessionData),
      };
      setCurrentSession(session);
    });

    const unsubLegacy = onSnapshot(legacyQ, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data() as any;
        const session: SessionData = {
          id: d.id,
          ...(data as SessionData),
          status: "active",
        };
        setCurrentSession((curr) => curr ?? session);
      }
    });

    return () => {
      unsubNew();
      unsubLegacy();
    };
  }, [user?.uid]);

  return {
    currentSession,
    sessions,
    loading,
    error,
    totalSessions,
    hasMore,
    checkIn,
    checkOut,
    loadSessions,
    clearError,
  };
};
