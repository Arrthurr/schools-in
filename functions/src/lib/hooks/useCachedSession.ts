"use client";

/**
 * Cached session management hook with real-time updates and intelligent caching
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Session } from "@/lib/firebase/types";
import { FirebaseCache, CacheTracker } from "@/lib/cache/FirebaseCache";
import {
  getCachedUserSessions,
  getCachedDocument,
} from "@/lib/firebase/cachedFirestore";

export interface SessionState {
  activeSession: Session | null;
  recentSessions: Session[];
  loading: boolean;
  error: string | null;
}

export function useCachedSession(userId: string | undefined) {
  const [state, setState] = useState<SessionState>({
    activeSession: null,
    recentSessions: [],
    loading: true,
    error: null,
  });

  const [realtimeUnsubscribe, setRealtimeUnsubscribe] =
    useState<Unsubscribe | null>(null);

  // Load sessions with caching
  const loadSessions = useCallback(
    async (forceRefresh = false) => {
      if (!userId) {
        setState({
          activeSession: null,
          recentSessions: [],
          loading: false,
          error: null,
        });
        return;
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        // Load active session and recent sessions in parallel
        const [activeSessionData, recentSessionsData] = await Promise.all([
          // Active session
          FirebaseCache.cacheSessionData(
            `active_session_${userId}`,
            async () => {
              const q = query(
                collection(db, COLLECTIONS.SESSIONS),
                where("userId", "==", userId),
                where("status", "==", "active"),
                limit(1)
              );

              const snapshot = await getDocs(q);
              if (snapshot.empty) return null;

              return {
                id: snapshot.docs[0].id,
                ...snapshot.docs[0].data(),
              } as Session;
            },
            {
              forceRefresh,
              onCacheHit: () => CacheTracker.recordHit(),
              onCacheMiss: () => CacheTracker.recordMiss(),
            }
          ),

          // Recent sessions
          getCachedUserSessions(userId, {
            limit: 10,
            forceRefresh,
          }),
        ]);

        setState({
          activeSession: activeSessionData,
          recentSessions: recentSessionsData,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to load sessions:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error ? error.message : "Failed to load sessions",
        }));
      }
    },
    [userId]
  );

  // Set up real-time subscription for active session
  useEffect(() => {
    if (!userId) return;

    // Clean up previous subscription
    if (realtimeUnsubscribe) {
      realtimeUnsubscribe();
    }

    // Subscribe to active sessions
    const q = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("userId", "==", userId),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let activeSession: Session | null = null;

        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          activeSession = {
            id: doc.id,
            ...doc.data(),
          } as Session;

          // Update cache with real-time data
          FirebaseCache.cacheSessionData(
            `active_session_${userId}`,
            () => Promise.resolve(activeSession),
            { forceRefresh: true }
          );
        }

        setState((prev) => ({
          ...prev,
          activeSession,
        }));
      },
      (error) => {
        console.error("Real-time session subscription error:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to subscribe to session updates",
        }));
      }
    );

    setRealtimeUnsubscribe(() => unsubscribe);

    // Load initial data
    loadSessions();

    return () => {
      unsubscribe();
    };
  }, [userId, loadSessions]);

  // Create new session with cache invalidation
  const createSession = useCallback(
    async (sessionData: Omit<Session, "id">) => {
      if (!userId) return null;

      try {
        // Create session in Firestore
        const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), {
          ...sessionData,
          userId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        const newSession: Session = {
          id: docRef.id,
          ...sessionData,
          userId,
        };

        // Update local state optimistically
        setState((prev) => ({
          ...prev,
          activeSession:
            newSession.status === "active" ? newSession : prev.activeSession,
          recentSessions: [newSession, ...prev.recentSessions.slice(0, 9)],
        }));

        // Invalidate cache
        await FirebaseCache.invalidateCache([
          `active_session_${userId}`,
          `user_sessions_${userId}`,
          "active_sessions",
          "session_",
        ]);

        return docRef.id;
      } catch (error) {
        console.error("Failed to create session:", error);
        throw error;
      }
    },
    [userId]
  );

  // Update session with cache invalidation
  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<Session>) => {
      if (!userId) return;

      try {
        // Update in Firestore
        await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
          ...updates,
          updatedAt: Timestamp.now(),
        });

        // Update local state optimistically
        setState((prev) => ({
          ...prev,
          activeSession:
            prev.activeSession?.id === sessionId
              ? { ...prev.activeSession, ...updates }
              : prev.activeSession,
          recentSessions: prev.recentSessions.map((session) =>
            session.id === sessionId ? { ...session, ...updates } : session
          ),
        }));

        // Invalidate cache
        await FirebaseCache.invalidateCache([
          `session_${sessionId}`,
          `active_session_${userId}`,
          `user_sessions_${userId}`,
          "active_sessions",
          "session_",
        ]);
      } catch (error) {
        console.error("Failed to update session:", error);
        throw error;
      }
    },
    [userId]
  );

  // Force refresh sessions (bypass cache)
  const refreshSessions = useCallback(async () => {
    await loadSessions(true);
  }, [loadSessions]);

  // Get session duration for active session
  const getSessionDuration = useCallback((): number => {
    if (!state.activeSession?.checkInTime) return 0;

    const startTime =
      state.activeSession.checkInTime instanceof Date
        ? state.activeSession.checkInTime
        : state.activeSession.checkInTime.toDate();

    return Date.now() - startTime.getTime();
  }, [state.activeSession]);

  return {
    activeSession: state.activeSession,
    recentSessions: state.recentSessions,
    loading: state.loading,
    error: state.error,
    createSession,
    updateSession,
    refreshSessions,
    getSessionDuration,
    isActive: !!state.activeSession,
  };
}

// Hook for admin session monitoring with caching
export function useAdminSessionMonitoring() {
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadActiveSessions = async () => {
      try {
        const { getCachedActiveSessions } = await import(
          "@/lib/firebase/cachedFirestore"
        );

        const sessions = await getCachedActiveSessions();

        if (mounted) {
          setActiveSessions(sessions);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load active sessions:", error);
        if (mounted) {
          setError("Failed to load active sessions");
          setLoading(false);
        }
      }
    };

    // Load initial data
    loadActiveSessions();

    // Set up real-time subscription
    const q = query(
      collection(db, COLLECTIONS.SESSIONS),
      where("status", "==", "active"),
      orderBy("startTime", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Session)
        );

        if (mounted) {
          setActiveSessions(sessions);

          // Update cache
          FirebaseCache.cacheSessionData(
            "active_sessions",
            () => Promise.resolve(sessions),
            { forceRefresh: true }
          );
        }
      },
      (error) => {
        console.error("Active sessions subscription error:", error);
        if (mounted) {
          setError("Failed to monitor active sessions");
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    activeSessions,
    loading,
    error,
    count: activeSessions.length,
  };
}
