import { Timestamp } from "firebase/firestore";
import {
  calculateDurationMinutes,
  convertToTimezone,
  formatDateForDisplay,
  formatDuration,
  formatTimestampForDisplay,
  getCurrentWeekRange,
  getDayKey,
  getDayKeyFromDate,
  getLastNDaysRange,
  getTodayKey,
  getTodayRange,
  getTodayRangeForDate,
  getWeekRange,
  getYesterdayKey,
  getYesterdayRange,
  isThisWeek,
  isToday,
  minutesToHours,
  timestampToDateInTimezone,
} from "../time";

describe("time utilities", () => {
  const fixedDate = new Date("2024-05-15T15:30:00.000Z"); // Wednesday
  const fixedTimestamp = Timestamp.fromDate(fixedDate);

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(fixedDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("converts timestamps and dates to the app timezone", () => {
    const convertedFromTimestamp = timestampToDateInTimezone(fixedTimestamp);
    const convertedFromDate = convertToTimezone(fixedDate);

    expect(convertedFromTimestamp.toISOString().split("T")[0]).toBe(
      "2024-05-15"
    );
    expect(convertedFromDate.toISOString().split("T")[0]).toBe("2024-05-15");
  });

  it("generates day keys for dates and timestamps", () => {
    expect(getDayKey(fixedTimestamp)).toBe("2024-05-15");
    expect(getDayKeyFromDate(fixedDate)).toBe("2024-05-15");
    expect(getTodayKey()).toBe("2024-05-15");
    expect(getYesterdayKey()).toBe("2024-05-14");
  });

  it("builds correct current and arbitrary week ranges", () => {
    const { start, end } = getCurrentWeekRange();
    const diff = end.toMillis() - start.toMillis();
    expect(Math.round(diff)).toBe(7 * 24 * 60 * 60 * 1000 - 1); // one week minus 1ms

    expect(start.toMillis()).toBeLessThan(end.toMillis());

    const customWeek = getWeekRange(new Date("2024-05-01T12:00:00Z"));
    expect(customWeek.start.toMillis()).toBeLessThan(customWeek.end.toMillis());
  });

  it("returns accurate daily ranges and last-n-days ranges", () => {
    const todayRange = getTodayRange();
    const yesterdayRange = getYesterdayRange();
    const lastThreeDays = getLastNDaysRange(3);

    expect(todayRange.end.toMillis()).toBeGreaterThan(todayRange.start.toMillis());
    expect(yesterdayRange.end.toMillis()).toBeGreaterThan(
      yesterdayRange.start.toMillis()
    );
    expect(lastThreeDays.end.toMillis()).toBeGreaterThan(
      lastThreeDays.start.toMillis()
    );

    const specificRange = getTodayRangeForDate(new Date("2024-05-10T10:00:00Z"));
    expect(specificRange.end.toMillis()).toBeGreaterThan(
      specificRange.start.toMillis()
    );
  });

  it("formats timestamps and dates for display", () => {
    const formattedTimestamp = formatTimestampForDisplay(fixedTimestamp, {
      hour12: false,
    });
    const formattedDate = formatDateForDisplay(fixedDate, { hour12: false });

    expect(formattedTimestamp).toContain("/");
    expect(formattedDate).toContain(":");
  });

  it("calculates durations with and without pauses", () => {
    const start = Timestamp.fromDate(new Date("2024-05-15T10:00:00Z"));
    const end = Timestamp.fromDate(new Date("2024-05-15T12:00:00Z"));

    expect(calculateDurationMinutes(start, end)).toBe(120);

    const withPause = calculateDurationMinutes(start, end, [
      {
        start: Timestamp.fromDate(new Date("2024-05-15T10:30:00Z")),
        end: Timestamp.fromDate(new Date("2024-05-15T10:45:00Z")),
      },
    ]);

    expect(withPause).toBe(105);
    expect(minutesToHours(withPause)).toBe(1.8);
    expect(formatDuration(withPause)).toBe("1h 45m");
    expect(formatDuration(30)).toBe("30m");
  });

  it("detects today and this week boundaries", () => {
    expect(isToday(new Date("2024-05-15T01:00:00-05:00"))).toBe(true);
    expect(isToday(new Date("2024-05-14T23:59:00-05:00"))).toBe(false);

    expect(isThisWeek(new Date("2024-05-16T12:00:00Z"))).toBe(true);
    expect(isThisWeek(new Date("2024-04-01T12:00:00Z"))).toBe(false);
  });
});
