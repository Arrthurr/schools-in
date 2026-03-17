import { Timestamp } from "firebase/firestore";

// Primary timezone for the application
export const APP_TIMEZONE = "America/Chicago";

/**
 * Gets the current date and time in the application timezone
 */
export function getCurrentDateInTimezone(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: APP_TIMEZONE })
  );
}

/**
 * Converts a Firestore Timestamp to a Date in the application timezone
 */
export function timestampToDateInTimezone(timestamp: Timestamp): Date {
  return new Date(
    timestamp.toDate().toLocaleString("en-US", { timeZone: APP_TIMEZONE })
  );
}

/**
 * Converts a Date to the application timezone and returns a new Date object
 */
export function convertToTimezone(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
}

/**
 * Generates a day key (YYYY-MM-DD) for a given timestamp in America/Chicago timezone
 * This is used for grouping sessions by day
 */
export function getDayKey(timestamp: Timestamp): string {
  const date = timestampToDateInTimezone(timestamp);
  return date.toISOString().split("T")[0];
}

/**
 * Generates a day key (YYYY-MM-DD) for a given Date in America/Chicago timezone
 */
export function getDayKeyFromDate(date: Date): string {
  const timezoneDate = convertToTimezone(date);
  return timezoneDate.toISOString().split("T")[0];
}

/**
 * Gets the day key for today in America/Chicago timezone
 */
export function getTodayKey(): string {
  return getDayKeyFromDate(new Date());
}

/**
 * Gets the day key for yesterday in America/Chicago timezone
 */
export function getYesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDayKeyFromDate(yesterday);
}

/**
 * Gets the start and end of the current week (Sunday to Saturday) in America/Chicago timezone
 * Returns timestamps that can be used for Firestore queries
 */
export function getCurrentWeekRange(): { start: Timestamp; end: Timestamp } {
  const now = getCurrentDateInTimezone();

  // Get Sunday of current week (start of week)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Get Saturday of current week (end of week)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(startOfWeek),
    end: Timestamp.fromDate(endOfWeek),
  };
}

/**
 * Gets the start and end of a specific week containing the given date
 * Returns timestamps that can be used for Firestore queries
 */
export function getWeekRange(date: Date): { start: Timestamp; end: Timestamp } {
  const timezoneDate = convertToTimezone(date);

  // Get Sunday of the week containing the given date
  const startOfWeek = new Date(timezoneDate);
  startOfWeek.setDate(timezoneDate.getDate() - timezoneDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Get Saturday of the same week
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(startOfWeek),
    end: Timestamp.fromDate(endOfWeek),
  };
}

/**
 * Gets the start and end of today in America/Chicago timezone
 * Returns timestamps that can be used for Firestore queries
 */
export function getTodayRange(): { start: Timestamp; end: Timestamp } {
  const today = getCurrentDateInTimezone();

  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(startOfDay),
    end: Timestamp.fromDate(endOfDay),
  };
}

/**
 * Gets the start and end of yesterday in America/Chicago timezone
 * Returns timestamps that can be used for Firestore queries
 */
export function getYesterdayRange(): { start: Timestamp; end: Timestamp } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return getTodayRangeForDate(yesterday);
}

/**
 * Gets the start and end of a specific date in America/Chicago timezone
 * Returns timestamps that can be used for Firestore queries
 */
export function getTodayRangeForDate(date: Date): {
  start: Timestamp;
  end: Timestamp;
} {
  const timezoneDate = convertToTimezone(date);

  const startOfDay = new Date(timezoneDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(timezoneDate);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(startOfDay),
    end: Timestamp.fromDate(endOfDay),
  };
}

/**
 * Gets the date range for the last N days in America/Chicago timezone
 * Returns timestamps that can be used for Firestore queries
 */
export function getLastNDaysRange(days: number): {
  start: Timestamp;
  end: Timestamp;
} {
  const today = getCurrentDateInTimezone();

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  return {
    start: Timestamp.fromDate(startDate),
    end: Timestamp.fromDate(endDate),
  };
}

/**
 * Formats a timestamp for display in the application timezone
 */
export function formatTimestampForDisplay(
  timestamp: Timestamp,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  return timestamp
    .toDate()
    .toLocaleString("en-US", { ...defaultOptions, ...options });
}

/**
 * Formats a date for display in the application timezone
 */
export function formatDateForDisplay(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  return date.toLocaleString("en-US", { ...defaultOptions, ...options });
}

/**
 * Calculates the duration between two timestamps in minutes
 * Excludes any paused intervals if provided
 */
export function calculateDurationMinutes(
  startTime: Timestamp,
  endTime: Timestamp,
  pausedIntervals?: Array<{ start: Timestamp; end: Timestamp }>
): number {
  let totalMinutes = (endTime.toMillis() - startTime.toMillis()) / (1000 * 60);

  // Subtract paused time if provided
  if (pausedIntervals) {
    for (const interval of pausedIntervals) {
      const pausedMinutes =
        (interval.end.toMillis() - interval.start.toMillis()) / (1000 * 60);
      totalMinutes -= pausedMinutes;
    }
  }

  return Math.max(0, totalMinutes);
}

/**
 * Formats an HH:MM time string to 12-hour display format (e.g. "9:00 AM")
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Converts minutes to hours with one decimal place
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * Formats duration in minutes to a human-readable string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}

/**
 * Checks if a given date is today in the application timezone
 */
export function isToday(date: Date): boolean {
  const today = getCurrentDateInTimezone();
  const checkDate = convertToTimezone(date);

  return (
    today.getFullYear() === checkDate.getFullYear() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getDate() === checkDate.getDate()
  );
}

/**
 * Checks if a given date is within the current week in the application timezone
 */
export function isThisWeek(date: Date): boolean {
  const { start, end } = getCurrentWeekRange();
  const timestamp = Timestamp.fromDate(date);

  return (
    timestamp.toMillis() >= start.toMillis() &&
    timestamp.toMillis() <= end.toMillis()
  );
}
