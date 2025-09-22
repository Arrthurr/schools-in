// Timezone constants
export const ORG_TZ = "America/Chicago";

// Helper to create a Date at midnight for a given timestamp in a target timezone
function getMidnightInTZ(date: Date, timeZone: string): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  // Construct date string in local TZ then parse as UTC offset using Date.parse on ISO
  // We'll create a Date in that TZ by formatting to that TZ midnight and then using Date.UTC
  // However, JS Date cannot construct with TZ directly; instead, we compute millis difference
  const midnightStr = `${y.toString().padStart(4, "0")}-${m
    .toString()
    .padStart(2, "0")}-${d.toString().padStart(2, "0")}T00:00:00`;
  // Get the offset at that date in the timezone by formatting that midnight time
  const offsetMinutes = getTimezoneOffsetMinutes(midnightStr, timeZone);
  // Create a UTC date corresponding to midnight in TZ by adding offset
  const utcMillis = Date.parse(midnightStr + "Z") + offsetMinutes * 60 * 1000;
  return new Date(utcMillis);
}

function getTimezoneOffsetMinutes(isoDateLocalMidnight: string, timeZone: string): number {
  // Compute offset by comparing the same nominal time interpreted in TZ vs UTC
  const asUTC = Date.parse(isoDateLocalMidnight + "Z");
  const asTZ = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(isoDateLocalMidnight + "Z"))
  ).getTime();
  return (asTZ - asUTC) / (60 * 1000);
}

export function toDayKey(input: Date | number): string {
  const d = typeof input === "number" ? new Date(input) : input;
  const midnight = getMidnightInTZ(d, ORG_TZ);
  const y = midnight.getUTCFullYear();
  const m = (midnight.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = midnight.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getTodayWindow(): { start: Date; end: Date } {
  const now = new Date();
  const start = getMidnightInTZ(now, ORG_TZ);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function getYesterdayWindow(): { start: Date; end: Date } {
  const { start } = getTodayWindow();
  const yStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  return { start: yStart, end: start };
}

// Week: Sunday–Saturday in America/Chicago
export function getCurrentWeekWindow(): { start: Date; end: Date } {
  const today = getTodayWindow().start;
  const day = today.getUTCDay(); // 0=Sunday
  // Compute Sunday start by subtracting day count
  const sundayStart = new Date(today.getTime() - day * 24 * 60 * 60 * 1000);
  const end = new Date(sundayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start: sundayStart, end };
}

