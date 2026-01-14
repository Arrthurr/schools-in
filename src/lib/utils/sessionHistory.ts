import { Session } from "@/lib/firebase/types";

export interface HoursByLocationDatum {
  locationName: string;
  hours: number;
}

export interface DurationHistogramDatum {
  binLabel: string;
  sessionCount: number;
}

const DURATION_BINS = [
  { label: "0–15m", min: 0, max: 15 },
  { label: "15–30m", min: 15, max: 30 },
  { label: "30–45m", min: 30, max: 45 },
  { label: "45–60m", min: 45, max: 60 },
  { label: "60–90m", min: 60, max: 90 },
  { label: "90m+", min: 90, max: Number.POSITIVE_INFINITY },
] as const;

/**
 * Normalize a session's duration to minutes.
 * Falls back to start/end time delta if durationMinutes is missing.
 */
export function getDurationMinutes(session: Session): number {
  if (typeof session.durationMinutes === "number") {
    return Math.max(0, session.durationMinutes);
  }

  if (session.startTime && session.endTime) {
    const deltaMs = session.endTime.toMillis() - session.startTime.toMillis();
    return Math.max(0, Math.floor(deltaMs / (1000 * 60)));
  }

  return 0;
}

/**
 * Aggregate total hours by location.
 * Returns sorted data, optionally bucketed into "Other" past maxItems.
 */
export function aggregateHoursByLocation(
  sessions: Session[],
  locationNames: Record<string, string>,
  maxItems = 6
): HoursByLocationDatum[] {
  const totals = sessions.reduce<Record<string, number>>((acc, session) => {
    const minutes = getDurationMinutes(session);
    if (!minutes) return acc;

    const name = locationNames[session.locationId] || "Unknown location";
    acc[name] = (acc[name] || 0) + minutes;
    return acc;
  }, {});

  const sorted = Object.entries(totals)
    .map(([locationName, minutes]) => ({
      locationName,
      hours: Number((minutes / 60).toFixed(2)),
    }))
    .sort((a, b) => b.hours - a.hours);

  if (sorted.length <= maxItems) return sorted;

  const top = sorted.slice(0, maxItems - 1);
  const otherHours = sorted
    .slice(maxItems - 1)
    .reduce((sum, item) => sum + item.hours, 0);

  return [...top, { locationName: "Other", hours: Number(otherHours.toFixed(2)) }];
}

/**
 * Build histogram-style buckets for session durations.
 */
export function buildDurationHistogram(
  sessions: Session[]
): DurationHistogramDatum[] {
  const binCounts = new Map<string, number>();
  DURATION_BINS.forEach((bin) => binCounts.set(bin.label, 0));

  sessions.forEach((session) => {
    const minutes = getDurationMinutes(session);
    if (minutes <= 0) return;

    const bin = DURATION_BINS.find(
      (b) => minutes >= b.min && minutes < b.max
    );
    const label = bin?.label ?? DURATION_BINS[DURATION_BINS.length - 1].label;
    binCounts.set(label, (binCounts.get(label) || 0) + 1);
  });

  return DURATION_BINS.map((bin) => ({
    binLabel: bin.label,
    sessionCount: binCounts.get(bin.label) || 0,
  }));
}
