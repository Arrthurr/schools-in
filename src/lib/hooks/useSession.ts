// Custom React hook for session management

import { useState, useCallback, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import {
  createDocument,
  updateDocument,
  getSessionsByUser,
  COLLECTIONS,
} from "../firebase/firestore";
import { SessionData } from "../utils/session";
import { Coordinates } from "../utils/location";
import { useAuth } from "./useAuth";

interface UseSessionReturn {
  currentSession: SessionData | null;
  sessions: SessionData[];
  loading: boolean;
  error: string | null;
  checkIn: (schoolId: string, location: Coordinates) => Promise<void>;
  checkOut: (sessionId: string, location: Coordinates) => Promise<void>;
  loadSessions: (userId?: string) => Promise<void>;
  clearError: () => void;
}

export const useSession = (): UseSessionReturn => {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState<SessionData | null>(
    null,
  );
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = useCallback(
    async (schoolId: string, location: Coordinates) => {
      if (!user) {
        setError("User must be authenticated to check in");
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
          sessionData,
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
    [user],
  );

  const checkOut = useCallback(
    async (sessionId: string, location: Coordinates) => {
      setLoading(true);
      setError(null);

      try {
        const checkOutTime = Timestamp.now();
        const updateData = {
          checkOutTime,
          checkOutLocation: location,
          status: "completed" as const,
          updatedAt: checkOutTime,
        };

        await updateDocument(COLLECTIONS.SESSIONS, sessionId, updateData);

        setCurrentSession(null);
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, ...updateData } : session,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check out");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadSessions = useCallback(
    async (userId?: string) => {
      const targetUserId = userId || user?.uid;

      if (!targetUserId) {
        setError("No user ID provided for loading sessions");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const sessionsData = await getSessionsByUser(targetUserId);
        let activeSession: SessionData | null = null;

        // Cast Session array to SessionData array via unknown
        const convertedSessions = sessionsData as unknown as SessionData[];

        // Find active session
        for (const session of convertedSessions) {
          if (session.status === "active") {
            activeSession = session;
            break;
          }
        }

        setSessions(convertedSessions);
        setCurrentSession(activeSession);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sessions",
        );
      } finally {
        setLoading(false);
      }
    },
    [user],
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
    checkIn,
    checkOut,
    loadSessions,
    clearError,
  };
};
