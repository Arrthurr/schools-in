export const LATE_PROVIDER_GRACE_MINUTES = 15;

export interface ChicagoTimeContext {
  dayOfWeek: number; // 0=Sun … 6=Sat
  nowMinutes: number; // minutes since midnight in Chicago
  todayDateKey: string; // YYYY-MM-DD in Chicago
}

/**
 * Derive the current time in America/Chicago without relying on system locale.
 * Uses Intl.DateTimeFormat so DST transitions are handled correctly.
 */
export function getChicagoTimeContext(now: Date = new Date()): ChicagoTimeContext {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = fmt.formatToParts(now);
  const partVal = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const dayOfWeek = weekdayMap[partVal("weekday")] ?? now.getDay();
  const hour = Number(partVal("hour").replace(/^24$/, "0"));
  const minute = Number(partVal("minute"));
  const nowMinutes = hour * 60 + minute;

  const year = partVal("year");
  const month = partVal("month");
  const day = partVal("day");
  const todayDateKey = `${year}-${month}-${day}`;

  return { dayOfWeek, nowMinutes, todayDateKey };
}

/**
 * Parse a startTime string ("HH:MM") into minutes since midnight.
 */
export function parseStartTimeMinutes(startTime: string): number {
  const [h, m] = startTime.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Returns true when the schedule's grace window has elapsed:
 * nowMinutes > startTimeMinutes + graceMinutes
 */
export function isScheduleLate(
  startTime: string,
  nowMinutes: number,
  graceMinutes: number = LATE_PROVIDER_GRACE_MINUTES
): boolean {
  const startMinutes = parseStartTimeMinutes(startTime);
  return nowMinutes > startMinutes + graceMinutes;
}

/**
 * Build the dedup document ID for a given (scheduleId, startTime, dateKey).
 * Format: "{scheduleId}-{HHMM}-{YYYY-MM-DD}"
 */
export function buildDedupId(
  scheduleId: string,
  startTime: string, // "HH:MM"
  dateKey: string // "YYYY-MM-DD"
): string {
  const hhmm = startTime.replace(":", "");
  return `${scheduleId}-${hhmm}-${dateKey}`;
}

export interface LateProviderInfo {
  providerName: string;
  locationName: string;
  startTime: string; // "HH:MM"
}

/**
 * Build the push notification body for one or more late providers.
 *
 * Single: "Alex Smith has not checked in at Lincoln Elementary (scheduled 9:00 AM)"
 * Multiple: "2 providers have not checked in: Alex Smith (Lincoln, 9:00 AM), ..."
 */
export function buildLatenessNotificationBody(lateProviders: LateProviderInfo[]): string {
  if (lateProviders.length === 0) return "";

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = String(m).padStart(2, "0");
    return `${displayH}:${displayM} ${period}`;
  };

  if (lateProviders.length === 1) {
    const { providerName, locationName, startTime } = lateProviders[0];
    return `${providerName} has not checked in at ${locationName} (scheduled ${formatTime(startTime)})`;
  }

  const list = lateProviders
    .map(({ providerName, locationName, startTime }) =>
      `${providerName} (${locationName}, ${formatTime(startTime)})`
    )
    .join(", ");
  return `${lateProviders.length} providers have not checked in: ${list}`;
}
