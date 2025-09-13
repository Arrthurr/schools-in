// Custom React hook for session management

import { useState, useCallback, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import {
  createDocument,
  updateDocument,
  getSessionsByUser,
  COLLECTIONS,
} from "../firebase/firestore";
import { SessionData, calculateSessionDuration } from "../utils/session";
import { Coordinates } from "../utils/location";
import { useAuth } from "./useAuth";

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
        const sessionData = {
          userId: user.uid,
          schoolId,
          checkInTime: Timestamp.now(),
          checkInLocation: location,
          status: "active" as const,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const sessionId = await createDocument(
          COLLECTIONS.SESSIONS,
          sessionData
        );

        const newSession = {
          id: sessionId,
          ...sessionData,
        };

        setCurrentSession(newSession);
        setSessions((prev) => [newSession, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check in");
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
        const checkOutTime = Timestamp.now();

        // Find the current session to get check-in time for duration calculation
        const currentSessionData =
          currentSession ||
          sessions.find((session) => session.id === sessionId);

        let duration = 0;
        if (currentSessionData?.checkInTime) {
          // Calculate duration in minutes
          duration = Math.round(
            (checkOutTime.toMillis() -
              currentSessionData.checkInTime.toMillis()) /
              (1000 * 60)
          );
        }

        const updateData = {
          checkOutTime,
          checkOutLocation: location,
          status: "completed" as const,
          duration,
          updatedAt: checkOutTime,
        };

        await updateDocument(COLLECTIONS.SESSIONS, sessionId, updateData);

        setCurrentSession(null);
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, ...updateData } : session
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check out");
      } finally {
        setLoading(false);
      }
    },
    [currentSession, sessions]
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
