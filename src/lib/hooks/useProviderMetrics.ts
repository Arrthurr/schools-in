"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../firebase.config";
import { COLLECTIONS } from "@/lib/firebase/firestore";
import { Session } from "@/lib/firebase/types";
import { getCurrentWeekWindow } from "@/lib/utils/dateTime";
import { useCachedSession } from "@/lib/hooks/useCachedSession";

export interface ProviderWeeklyStats {
  completedCount: number;
  totalHours: number; // rounded to 1 decimal
}

export function useProviderMetrics(userId?: string) {
  const { activeSession } = useCachedSession(userId);
  const [weekly, setWeekly] = useState<ProviderWeeklyStats>({
    completedCount: 0,
    totalHours: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadWeekly() {
      setLoading(true);
      setError(null);
      try {
        const { start, end } = getCurrentWeekWindow();

        const qRef = query(
          collection(db, COLLECTIONS.SESSIONS),
          where("userId", "==", userId),
          where("status", "==", "completed"),
          where("endTime", ">=", start),
          where("endTime", "<", end),
          orderBy("endTime", "desc")
        );

        const snap = await getDocs(qRef);
        let completedCount = 0;
        let totalMinutes = 0;

        snap.docs.forEach((d) => {
          const s = { id: d.id, ...(d.data() as any) } as Session & any;
          completedCount += 1;
          const duration =
            typeof s.durationMinutes === "number"
              ? s.durationMinutes
              : s.duration ?? // legacy minutes
                computeDurationMinutes(s);
          totalMinutes += duration || 0;
        });

        const hours = Math.round((totalMinutes / 60) * 10) / 10; // 1 decimal
        if (!cancelled) setWeekly({ completedCount, totalHours: hours });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load weekly stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWeekly();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    activeSession,
    weekly,
    loading,
    error,
  };
}

function computeDurationMinutes(s: any): number | undefined {
  const start = s.startTime || s.checkInTime;
  const end = s.endTime || s.checkOutTime;
  if (!start || !end) return undefined;
  const startDate = start instanceof Date ? start : start.toDate?.() ?? new Date(start);
  const endDate = end instanceof Date ? end : end.toDate?.() ?? new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}
