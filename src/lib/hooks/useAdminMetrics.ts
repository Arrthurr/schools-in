"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Session, User, Location } from "@/lib/firebase/types";
import { getTodayWindow, getYesterdayWindow } from "@/lib/utils/dateTime";

type ActivityType = "check-in" | "check-out";

export interface AdminStats {
  activeProviders: number;
  activeSessions: number;
  todayCheckIns: number;
  yesterdayCheckIns: number;
  percentChange: number; // vs yesterday
  totalSessions: number; // over last 30 days (for context)
  avgSessionDurationHours: number; // last 30 days
}

export interface AdminActivityItem {
  id: string;
  type: ActivityType;
  timestamp: Date;
  userId: string;
  locationId: string;
  providerName?: string;
  locationName?: string;
}

export function useAdminMetrics() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Active sessions
        const activeQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "active"),
          orderBy("startTime", "desc")
        );
        const activeSnap = await getDocs(activeQ);
        const activeSessions = activeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Session & any));
        const activeSessionsCount = activeSessions.length;
        const activeProviders = new Set(activeSessions.map((s) => s.userId)).size;

        // Today vs yesterday check-ins
        const { start: todayStart, end: todayEnd } = getTodayWindow();
        const { start: yStart, end: yEnd } = getYesterdayWindow();

        const todayQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("startTime", ">=", todayStart),
          where("startTime", "<", todayEnd)
        );
        const yQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("startTime", ">=", yStart),
          where("startTime", "<", yEnd)
        );
        const [todaySnap, ySnap] = await Promise.all([getDocs(todayQ), getDocs(yQ)]);
        const todayCount = todaySnap.size;
        const yCount = ySnap.size;
        const percentChange = yCount === 0 ? 100 : Math.round(((todayCount - yCount) / yCount) * 100);

        // Avg session duration over last 30 days (completed)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const completedQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "completed"),
          where("endTime", ">=", thirtyDaysAgo),
          orderBy("endTime", "desc")
        );
        const completedSnap = await getDocs(completedQ);
        let totalMinutes = 0;
        let count = 0;
        completedSnap.docs.forEach((d) => {
          const s = d.data() as any;
          const dur = typeof s.durationMinutes === "number" ? s.durationMinutes : computeDurationMinutes(s);
          if (typeof dur === "number") {
            totalMinutes += dur;
            count += 1;
          }
        });
        const avgHours = count ? Math.round(((totalMinutes / count) / 60) * 10) / 10 : 0;

        // For context: total completed in window
        const totalSessions = count;

        if (!cancelled) {
          setStats({
            activeProviders,
            activeSessions: activeSessionsCount,
            todayCheckIns: todayCount,
            yesterdayCheckIns: yCount,
            percentChange,
            totalSessions,
            avgSessionDurationHours: avgHours,
          });
        }

        // Recent activity: combine latest check-ins (startTime) and check-outs (endTime)
        const recentCheckInsQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          orderBy("startTime", "desc")
        );
        const recentCheckOutsQ = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("status", "==", "completed"),
          orderBy("endTime", "desc")
        );
        const [rcInSnap, rcOutSnap] = await Promise.all([
          getDocs(recentCheckInsQ),
          getDocs(recentCheckOutsQ),
        ]);

        // Map first 10 of each then merge
        const inEvents = rcInSnap.docs.slice(0, 10).map((d) => ({
          id: d.id + "_in",
          type: "check-in" as ActivityType,
          timestamp: toDate((d.data() as any).startTime),
          userId: (d.data() as any).userId,
          locationId: (d.data() as any).locationId,
        }));
        const outEvents = rcOutSnap.docs.slice(0, 10).map((d) => ({
          id: d.id + "_out",
          type: "check-out" as ActivityType,
          timestamp: toDate((d.data() as any).endTime),
          userId: (d.data() as any).userId,
          locationId: (d.data() as any).locationId,
        }));
        const merged = [...inEvents, ...outEvents]
          .filter((e) => e.timestamp)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 5);

        // Enrich with names
        const userIds = Array.from(new Set(merged.map((e) => e.userId)));
        const locationIds = Array.from(new Set(merged.map((e) => e.locationId)));
        const [{ CachedUserService }, { CachedSchoolService }] = await Promise.all([
          import("@/lib/services/cachedUserService"),
          import("@/lib/services/cachedSchoolService"),
        ]);

        const users = await Promise.all(
          userIds.map((uid) => CachedUserService.getUserById(uid).catch(() => null))
        );
        const locations = await Promise.all(
          locationIds.map((lid) => CachedSchoolService.getSchoolById(lid).catch(() => null))
        );
        const userMap = new Map<string, any>();
        users.forEach((u) => {
          if (u) userMap.set(u.uid || (u as any).id, u);
        });
        const locMap = new Map<string, any>();
        locations.forEach((l) => {
          if (l) locMap.set(l.id, l);
        });

        const enriched = merged.map((e) => ({
          ...e,
          providerName: userMap.get(e.userId)?.displayName || userMap.get(e.userId)?.email || e.userId,
          locationName: locMap.get(e.locationId)?.name || e.locationId,
        }));

        if (!cancelled) setRecent(enriched);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load admin metrics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, recent, loading, error };
}

function toDate(ts: any): Date {
  if (!ts) return undefined as any;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

function computeDurationMinutes(s: any): number | undefined {
  const start = s.startTime || s.checkInTime;
  const end = s.endTime || s.checkOutTime;
  if (!start || !end) return undefined;
  const startDate = toDate(start);
  const endDate = toDate(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}
