"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Session } from "@/lib/firebase/types";

export interface ActiveSessionWithDetails {
  id: string;
  userId: string;
  locationId: string;
  startTime: any; // Timestamp
  status: string;
  providerName: string;
  schoolName: string;
  elapsedTime: string; // e.g., "35m ago"
}

export function useActiveSessions() {
  const [activeSessions, setActiveSessions] = useState<
    ActiveSessionWithDetails[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadActiveSessions() {
      setLoading(true);
      setError(null);
      try {
        // Fetch active sessions
        const activeQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "active"),
          orderBy("startTime", "desc")
        );
        const activeSnap = await getDocs(activeQ);
        const sessions = activeSnap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) } as Session & any)
        );

        if (sessions.length === 0) {
          if (!cancelled) {
            setActiveSessions([]);
            setLoading(false);
          }
          return;
        }

        // Get unique user and location IDs
        const userIds = Array.from(new Set(sessions.map((s) => s.userId)));
        const locationIds = Array.from(
          new Set(sessions.map((s) => s.locationId))
        );

        // Import services for user and location data
        const [{ CachedUserService }, { CachedSchoolService }] =
          await Promise.all([
            import("@/lib/services/cachedUserService"),
            import("@/lib/services/cachedSchoolService"),
          ]);

        // Fetch user and location data in parallel
        const [users, locations] = await Promise.all([
          Promise.all(
            userIds.map((uid) =>
              CachedUserService.getUserById(uid).catch(() => null)
            )
          ),
          Promise.all(
            locationIds.map((lid) =>
              CachedSchoolService.getSchoolById(lid).catch(() => null)
            )
          ),
        ]);

        // Create maps for quick lookup
        const userMap = new Map<string, any>();
        users.forEach((u) => {
          if (u) userMap.set(u.uid || (u as any).id, u);
        });

        const locMap = new Map<string, any>();
        locations.forEach((l) => {
          if (l) locMap.set(l.id, l);
        });

        // Format elapsed time
        const formatElapsedTime = (startTime: any) => {
          const startDate =
            startTime instanceof Date ? startTime : startTime.toDate();
          const now = new Date();
          const diffMs = now.getTime() - startDate.getTime();
          const diffMin = Math.floor(diffMs / 60000);

          if (diffMin < 1) return "Just now";
          if (diffMin < 60) return `${diffMin}m ago`;
          if (diffMin < 1440)
            return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m ago`;
          return `${Math.floor(diffMin / 1440)}d ${Math.floor(
            (diffMin % 1440) / 60
          )}h ago`;
        };

        // Enrich sessions with user/location data and elapsed time
        const enrichedSessions = sessions.map((session) => ({
          id: session.id,
          userId: session.userId,
          locationId: session.locationId,
          startTime: session.startTime,
          status: session.status,
          providerName:
            userMap.get(session.userId)?.displayName ||
            userMap.get(session.userId)?.email ||
            session.userId,
          schoolName:
            locMap.get(session.locationId)?.name || session.locationId,
          elapsedTime: formatElapsedTime(session.startTime),
        }));

        if (!cancelled) {
          setActiveSessions(enrichedSessions);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load active sessions");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadActiveSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  return { activeSessions, loading, error };
}
