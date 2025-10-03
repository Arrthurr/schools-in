import { useState, useEffect, useCallback } from "react";
import { Timestamp, onSnapshot, doc, collection, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { Session, ProviderMetrics } from "../firebase/types";
import { useCachedAuth } from "./useCachedAuth";
import { getDayKey, minutesToHours } from "../utils/time";
import { CachedSessionService } from "../services/cachedSessionService";
import { COLLECTIONS } from "../firebase/firestore";

interface ExtendedProviderMetrics extends ProviderMetrics {
  // Additional weekly metrics
  locationsVisited: number;
  averageSessionDuration: number; // in minutes
  completionRate: number; // percentage
  totalSessionsThisWeek: number;
  longestSessionDuration: number; // in minutes
  shortestSessionDuration: number; // in minutes
  mostVisitedLocation?: string;
}

interface UseProviderMetricsReturn {
  // Current session data
  currentSession: Session | null;
  lastCompletedSession: Session | null;
  isLoading: boolean;
  error: string | null;

  // Weekly metrics
  weeklyMetrics: ExtendedProviderMetrics;

  // Session management functions
  startSession: (
    locationId: string,
    checkInMethod?: "geo" | "manual",
    distanceFromCenter?: number
  ) => Promise<void>;
  endSession: (notes?: string) => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;

  // Refresh function
  refresh: () => Promise<void>;

  // Session state helpers
  isSessionActive: boolean;
  sessionDuration: number; // in minutes
  canStartSession: boolean;
  canEndSession: boolean;
}

/**
 * Custom hook for provider dashboard metrics and session management
 * Provides real-time session data and weekly metrics for the provider dashboard
 */
export function useProviderMetrics(): UseProviderMetricsReturn {
  const { user, loading: authLoading } = useCachedAuth();
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [lastCompletedSession, setLastCompletedSession] = useState<Session | null>(null);
  const [weeklyMetrics, setWeeklyMetrics] = useState<ExtendedProviderMetrics>({
    currentSession: null,
    weeklySessionsCount: 0,
    weeklyTotalHours: 0,
    locationsVisited: 0,
    averageSessionDuration: 0,
    completionRate: 0,
    totalSessionsThisWeek: 0,
    longestSessionDuration: 0,
    shortestSessionDuration: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Calculated session state
  const isSessionActive = currentSession?.status === "active";
  const canStartSession = !currentSession;
  const hasValidSession =
    currentSession && ["active", "paused"].includes(currentSession.status);
  const canEndSession = Boolean(hasValidSession);

  // Update session duration in real-time
  useEffect(() => {
    if (!currentSession || currentSession.status !== "active") {
      setSessionDuration(0);
      return;
    }

    const updateDuration = () => {
      if (!currentSession || currentSession.status !== "active") {
        setSessionDuration(0);
        return;
      }
      
      const toDate = (v: any): Date | null => {
        if (!v) return null;
        if (typeof v.toDate === "function") return v.toDate();
        if (v instanceof Date) return v;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      
      const start = toDate(currentSession.startTime) || toDate(currentSession.checkInTime);
      if (!start) return;
      
      const now = new Date();
      const durationMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);
      setSessionDuration(durationMinutes);
    };

    // Update immediately
    updateDuration();

    // Update every minute
    const interval = setInterval(updateDuration, 60000);

    return () => clearInterval(interval);
  }, [currentSession]);

  // Real-time: active/paused session for the current user
  useEffect(() => {
    if (!user?.uid) return;

    // New schema: status in ['active', 'paused']
    const activeQ = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("userId", "==", user.uid),
      where("status", "in", ["active", "paused"]),
      orderBy("startTime", "desc"),
      limit(1)
    );

    // Legacy fallback: active == true
    const legacyQ = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("userId", "==", user.uid),
      where("active", "==", true),
      orderBy("startTime", "desc"),
      limit(1)
    );

    const unsubscribers: Array<() => void> = [];

    const handleActiveSnapshot = (snap: any) => {
      if (snap.empty) {
        // Let legacy listener take over if it finds one; otherwise clear
        setCurrentSession((prev) => {
          // If we still had a session, drop it
          if (prev) setSessionDuration(0);
          return null;
        });
        return;
      }
      const d = snap.docs[0];
      const data = d.data() as any;
      const status =
        data.status ??
        (typeof data.active === "boolean" ? (data.active ? "active" : "completed") : undefined);
      const sessionData: Session = { id: d.id, ...data, status };
      setCurrentSession(sessionData);
    };

    const unsubNew = onSnapshot(activeQ, handleActiveSnapshot, (err) => {
      console.error("Active session listener (status) error:", err);
      setError("Failed to listen for active session");
    });
    const unsubLegacy = onSnapshot(legacyQ, (snap) => {
      // Only set if we don't already have an active session from the new schema
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data() as any;
        const sessionData: Session = { id: d.id, ...data, status: "active" };
        setCurrentSession((curr) => curr ?? sessionData);
      }
    });
    unsubscribers.push(unsubNew, unsubLegacy);

    return () => unsubscribers.forEach((u) => u());
  }, [user?.uid]);

  // Real-time: last completed session for the current user
  useEffect(() => {
    if (!user?.uid) return;

    const completedQ = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("userId", "==", user.uid),
      where("status", "==", "completed"),
      orderBy("endTime", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(completedQ, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setLastCompletedSession({ id: d.id, ...(d.data() as any) } as Session);
      }
    });

    return unsubscribe;
  }, [user?.uid]);

  // Fetch current session and weekly metrics
  const fetchMetrics = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch current active session
      const activeSession = await CachedSessionService.getActiveSession(
        user.uid
      );
      setCurrentSession(activeSession);

      // Fetch weekly sessions (include all sessions, not just completed ones)
      const allWeeklySessions =
        await CachedSessionService.getUserWeeklySessions(user.uid);
      const completedWeeklySessions = allWeeklySessions.filter(
        (session) => session.status === "completed"
      );

      // Calculate basic metrics
      const weeklySessionsCount = completedWeeklySessions.length;
      const totalSessionsThisWeek = allWeeklySessions.length;

      // Calculate durations
      const sessionDurations = completedWeeklySessions
        .map((session) => session.durationMinutes ?? 0)
        .filter((duration) => duration > 0);

      const totalMinutes = sessionDurations.reduce(
        (sum, duration) => sum + duration,
        0
      );
      const weeklyTotalHours = minutesToHours(totalMinutes);

      // Calculate extended metrics
      const locationsVisited = new Set(
        completedWeeklySessions.map((s) => s.locationId)
      ).size;
      const averageSessionDuration =
        sessionDurations.length > 0
          ? totalMinutes / sessionDurations.length
          : 0;
      const completionRate =
        totalSessionsThisWeek > 0
          ? (weeklySessionsCount / totalSessionsThisWeek) * 100
          : 0;
      const longestSessionDuration =
        sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0;
      const shortestSessionDuration =
        sessionDurations.length > 0 ? Math.min(...sessionDurations) : 0;

      // Find most visited location
      const locationCounts = completedWeeklySessions.reduce((acc, session) => {
        acc[session.locationId] = (acc[session.locationId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostVisitedLocation =
        Object.keys(locationCounts).length > 0
          ? Object.keys(locationCounts).reduce((a, b) =>
              locationCounts[a] > locationCounts[b] ? a : b
            )
          : undefined;

      setWeeklyMetrics({
        currentSession: activeSession,
        weeklySessionsCount,
        weeklyTotalHours,
        locationsVisited,
        averageSessionDuration,
        completionRate,
        totalSessionsThisWeek,
        longestSessionDuration,
        shortestSessionDuration,
        mostVisitedLocation,
      });
    } catch (err) {
      console.error("Error fetching provider metrics:", err);
      setError("Failed to load metrics");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Refresh metrics data
  const refresh = useCallback(async () => {
    await fetchMetrics();
  }, [fetchMetrics]);

  // Session management functions
  const startSession = async (
    locationId: string,
    checkInMethod: "geo" | "manual" = "manual",
    distanceFromCenter: number = 0
  ) => {
    if (!user) throw new Error("User not authenticated");

    try {
      setError(null);
      const startTime = new Date();
      const newSession = await CachedSessionService.startSession({
        locationId,
        startTime,
        checkInMethod,
        distanceFromCenterAtCheckIn: distanceFromCenter,
        dayKey: getDayKey(Timestamp.fromDate(startTime)),
      });
      setCurrentSession(newSession);
      // Refresh metrics to include new session
      await fetchMetrics();
    } catch (err) {
      console.error("Error starting session:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start session";
      setError(errorMessage);
      throw err;
    }
  };

  const endSession = async (notes?: string) => {
    if (!currentSession || !user) return;

    try {
      setError(null);
      await CachedSessionService.endSession(currentSession.id, {
        endTime: new Date(),
        notes,
      });
      setSessionDuration(0);
      // Do not setCurrentSession(null) here; let the listener drop it
      await fetchMetrics();
    } catch (err) {
      console.error("Error ending session:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to end session";
      setError(errorMessage);
      throw err;
    }
  };

  const pauseSession = async () => {
    if (!currentSession || !user) return;

    try {
      setError(null);
      const updatedSession = await CachedSessionService.pauseSession(
        currentSession.id
      );
      setCurrentSession(updatedSession);
    } catch (err) {
      console.error("Error pausing session:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to pause session";
      setError(errorMessage);
      throw err;
    }
  };

  const resumeSession = async () => {
    if (!currentSession || !user) return;

    try {
      setError(null);
      const updatedSession = await CachedSessionService.resumeSession(
        currentSession.id
      );
      setCurrentSession(updatedSession);
    } catch (err) {
      console.error("Error resuming session:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resume session";
      setError(errorMessage);
      throw err;
    }
  };

  // Fetch metrics when user changes or component mounts
  useEffect(() => {
    if (!authLoading) {
      fetchMetrics();
    }
  }, [authLoading, fetchMetrics]);

  // Set up real-time subscription for current session updates
  useEffect(() => {
    if (!user || !currentSession) return;

    const sessionDoc = doc(db, COLLECTIONS.SESSIONS, currentSession.id);

    const unsubscribe = onSnapshot(
      sessionDoc,
      (snapshot) => {
        if (snapshot.exists()) {
          const updatedSession = {
            id: snapshot.id,
            ...snapshot.data(),
          } as Session;
          setCurrentSession(updatedSession);
        } else {
          setCurrentSession(null);
        }
      },
      (error) => {
        console.error("Error in session real-time subscription:", error);
        setError("Lost connection to session updates");
      }
    );

    return unsubscribe;
  }, [user, currentSession?.id]);

  return {
    currentSession,
    lastCompletedSession,
    isLoading: authLoading || isLoading,
    error,
    weeklyMetrics,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    refresh,
    isSessionActive,
    sessionDuration,
    canStartSession,
    canEndSession,
  };
}
