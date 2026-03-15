"use client";

import { useState, useEffect } from "react";
import { getSchedulesByProviderAndLocation } from "@/lib/services/scheduleService";

export interface ScheduleGateState {
  /** Whether the provider is currently allowed to check in */
  canCheckIn: boolean;
  /**
   * The earliest time check-in becomes available (HH:MM 24-hour, null if no schedule today).
   * Formatted for display as "H:MM AM/PM".
   */
  earliestCheckInTime: string | null;
  /** Human-readable message shown when check-in is blocked */
  message: string | null;
  loading: boolean;
  error: string | null;
}

const GRACE_MINUTES = 15;
const APP_TIMEZONE = "America/Chicago";

/** Get the current day-of-week (0=Sun) and "HH:MM" in America/Chicago */
function getNowInChicago(): { dayOfWeek: number; hhmm: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[get("weekday")] ?? now.getDay();
  const hour = get("hour").replace(/^24$/, "00"); // Intl may return "24" for midnight
  const minute = get("minute");
  return { dayOfWeek, hhmm: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}` };
}

/** Format "HH:MM" 24-hour string to "H:MM AM/PM" */
function formatTime(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

/** Subtract grace minutes from an "HH:MM" string, returning a new "HH:MM" string */
function subtractMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m - mins;
  const clipped = Math.max(0, total);
  const rh = Math.floor(clipped / 60);
  const rm = clipped % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

/**
 * Determines whether a provider may check in at a given school right now,
 * based on their schedule for today.
 *
 * Rules:
 * - No schedule today → check-in always allowed.
 * - Schedule exists → check-in allowed from (earliestStartTime − 15 min) onwards.
 *
 * @param providerId The provider's user ID.
 * @param locationId The school/location ID.
 */
export function useScheduleGate(
  providerId: string | undefined,
  locationId: string | undefined
): ScheduleGateState {
  const [state, setState] = useState<ScheduleGateState>({
    canCheckIn: true,
    earliestCheckInTime: null,
    message: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!providerId || !locationId) {
      setState({
        canCheckIn: true,
        earliestCheckInTime: null,
        message: null,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    let tickTimer: ReturnType<typeof setTimeout> | null = null;

    /** Compute ms from now until a Chicago "HH:MM" time today (0 if already past). */
    function msUntilGate(gateHhmm: string): number {
      const [gh, gm] = gateHhmm.split(":").map(Number);
      const { hhmm: nowHhmm } = getNowInChicago();
      const [nh, nm] = nowHhmm.split(":").map(Number);
      const diffMin = (gh * 60 + gm) - (nh * 60 + nm);
      // Add 1 s buffer so the next tick is just past the gate
      return diffMin > 0 ? diffMin * 60_000 + 1_000 : 0;
    }

    async function check() {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        // Use America/Chicago timezone for consistent day-of-week and time
        const { dayOfWeek: today, hhmm: currentHhmm } = getNowInChicago();

        // Fetch all active schedules for this provider at this location, filter to today
        const allSchedules = await getSchedulesByProviderAndLocation(
          providerId!,
          locationId!
        );
        const todaySchedules = allSchedules.filter(
          (s) => s.dayOfWeek === today && s.isActive !== false
        );
        const schedule =
          todaySchedules.sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          )[0] ?? null;

        if (cancelled) return;

        if (!schedule) {
          // No schedule today — always allowed
          setState({
            canCheckIn: true,
            earliestCheckInTime: null,
            message: null,
            loading: false,
            error: null,
          });
          return;
        }

        const gateTime = subtractMinutes(schedule.startTime, GRACE_MINUTES);

        const canCheckIn = currentHhmm >= gateTime;

        setState({
          canCheckIn,
          earliestCheckInTime: gateTime,
          message: canCheckIn
            ? null
            : `Check-in opens at ${formatTime(gateTime)} (15 min before your ${formatTime(schedule.startTime)} session).`,
          loading: false,
          error: null,
        });

        // If still blocked, schedule a re-check when the gate opens
        if (!canCheckIn && !cancelled) {
          const delay = msUntilGate(gateTime);
          // Use the computed delay, but cap the fallback at 60 s so we never sleep too long
          tickTimer = setTimeout(() => {
            if (!cancelled) check();
          }, Math.min(delay || 60_000, 60_000));
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          canCheckIn: true, // fail open — server will enforce
          earliestCheckInTime: null,
          message: null,
          loading: false,
          error:
            err instanceof Error ? err.message : "Failed to check schedule",
        });
      }
    }

    check();
    return () => {
      cancelled = true;
      if (tickTimer) clearTimeout(tickTimer);
    };
  }, [providerId, locationId]);

  return state;
}
