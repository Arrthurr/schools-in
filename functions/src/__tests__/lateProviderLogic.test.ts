/**
 * Unit tests for lateProviderLogic.ts
 */

import {
  getChicagoTimeContext,
  isScheduleLate,
  buildDedupId,
  buildLatenessNotificationBody,
  parseStartTimeMinutes,
  LATE_PROVIDER_GRACE_MINUTES,
  type LateProviderInfo,
} from "../lateProviderLogic";

// ============================================================================
// getChicagoTimeContext
// ============================================================================

describe("getChicagoTimeContext", () => {
  test("returns correct structure", () => {
    const ctx = getChicagoTimeContext();
    expect(typeof ctx.dayOfWeek).toBe("number");
    expect(ctx.dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(ctx.dayOfWeek).toBeLessThanOrEqual(6);
    expect(typeof ctx.nowMinutes).toBe("number");
    expect(ctx.nowMinutes).toBeGreaterThanOrEqual(0);
    expect(ctx.nowMinutes).toBeLessThan(1440); // < 24 * 60
    expect(/^\d{4}-\d{2}-\d{2}$/.test(ctx.todayDateKey)).toBe(true);
  });

  test("dateKey format is YYYY-MM-DD", () => {
    const ctx = getChicagoTimeContext(new Date("2025-01-15T14:00:00Z"));
    expect(/^\d{4}-\d{2}-\d{2}$/.test(ctx.todayDateKey)).toBe(true);
    const [year, month, day] = ctx.todayDateKey.split("-");
    expect(year).toBe("2025");
    expect(month.length).toBe(2);
    expect(day.length).toBe(2);
  });

  test("standard time: 2025-01-15 14:00 UTC = 8:00 AM Chicago (CST, UTC-6)", () => {
    // CST = UTC-6, so 14:00 UTC = 08:00 CST
    const ctx = getChicagoTimeContext(new Date("2025-01-15T14:00:00Z"));
    expect(ctx.nowMinutes).toBe(8 * 60); // 480
    expect(ctx.todayDateKey).toBe("2025-01-15");
    // Jan 15 2025 is a Wednesday
    expect(ctx.dayOfWeek).toBe(3);
  });

  test("DST: 2025-07-15 14:00 UTC = 9:00 AM Chicago (CDT, UTC-5)", () => {
    // CDT = UTC-5, so 14:00 UTC = 09:00 CDT
    const ctx = getChicagoTimeContext(new Date("2025-07-15T14:00:00Z"));
    expect(ctx.nowMinutes).toBe(9 * 60); // 540
    expect(ctx.todayDateKey).toBe("2025-07-15");
    // July 15 2025 is a Tuesday
    expect(ctx.dayOfWeek).toBe(2);
  });

  test("midnight UTC does not produce previous-day dateKey in Chicago when date changes after midnight UTC", () => {
    // 00:30 UTC on Jan 16 = 18:30 CST on Jan 15 (still Jan 15 Chicago)
    const ctx = getChicagoTimeContext(new Date("2025-01-16T00:30:00Z"));
    expect(ctx.todayDateKey).toBe("2025-01-15");
    expect(ctx.nowMinutes).toBe(18 * 60 + 30); // 1110
    // Jan 15 is Wednesday
    expect(ctx.dayOfWeek).toBe(3);
  });

  test("after Chicago midnight is new day", () => {
    // 06:30 UTC on Jan 16 = 00:30 CST on Jan 16 (new day in Chicago)
    const ctx = getChicagoTimeContext(new Date("2025-01-16T06:30:00Z"));
    expect(ctx.todayDateKey).toBe("2025-01-16");
    expect(ctx.nowMinutes).toBe(30); // 0h 30m
    // Jan 16 is Thursday
    expect(ctx.dayOfWeek).toBe(4);
  });

  test("DST spring-forward: 2025-03-09 just after spring forward (02:00 → 03:00 CDT)", () => {
    // 08:00 UTC on Mar 9 2025 = 03:00 CDT (clocks sprang forward at 2am CST → 3am CDT)
    const ctx = getChicagoTimeContext(new Date("2025-03-09T08:00:00Z"));
    expect(ctx.nowMinutes).toBe(3 * 60); // 180
    expect(ctx.todayDateKey).toBe("2025-03-09");
    // March 9 2025 is Sunday
    expect(ctx.dayOfWeek).toBe(0);
  });

  test("DST fall-back: 2025-11-02 after clocks fell back — 07:30 UTC = 01:30 CST", () => {
    // CDT ended at 02:00 CDT on Nov 2 2025 → clocks fell back to 01:00 CST (UTC-6)
    // 07:30 UTC = 01:30 CST — unambiguous because we're past the fall-back point
    const ctx = getChicagoTimeContext(new Date("2025-11-02T07:30:00Z"));
    expect(ctx.nowMinutes).toBe(1 * 60 + 30); // 90
    expect(ctx.todayDateKey).toBe("2025-11-02");
    // November 2 2025 is Sunday
    expect(ctx.dayOfWeek).toBe(0);
  });
});

// ============================================================================
// parseStartTimeMinutes
// ============================================================================

describe("parseStartTimeMinutes", () => {
  test("parses 09:00 as 540", () => expect(parseStartTimeMinutes("09:00")).toBe(540));
  test("parses 13:30 as 810", () => expect(parseStartTimeMinutes("13:30")).toBe(810));
  test("parses 00:00 as 0", () => expect(parseStartTimeMinutes("00:00")).toBe(0));
  test("parses 23:59 as 1439", () => expect(parseStartTimeMinutes("23:59")).toBe(1439));

  test("throws on empty string", () => {
    expect(() => parseStartTimeMinutes("")).toThrow();
  });
  test("throws on missing colon", () => {
    expect(() => parseStartTimeMinutes("0900")).toThrow();
  });
  test("throws on non-numeric content", () => {
    expect(() => parseStartTimeMinutes("ab:cd")).toThrow();
  });
  test("throws on ISO-extended format", () => {
    expect(() => parseStartTimeMinutes("09:00:00")).toThrow();
  });
});

// ============================================================================
// isScheduleLate
// ============================================================================

describe("isScheduleLate", () => {
  const grace = LATE_PROVIDER_GRACE_MINUTES; // 15

  test("exactly at startTime + grace is NOT late (boundary: strict >)", () => {
    // 9:00 + 15 = 9:15, nowMinutes = 555. Not late.
    expect(isScheduleLate("09:00", 9 * 60 + 15, grace)).toBe(false);
  });

  test("one minute past grace IS late", () => {
    // nowMinutes = 556 = 9:16
    expect(isScheduleLate("09:00", 9 * 60 + 16, grace)).toBe(true);
  });

  test("one minute before grace is NOT late", () => {
    // nowMinutes = 554 = 9:14
    expect(isScheduleLate("09:00", 9 * 60 + 14, grace)).toBe(false);
  });

  test("exactly at startTime is NOT late", () => {
    expect(isScheduleLate("09:00", 9 * 60, grace)).toBe(false);
  });

  test("well before startTime is NOT late", () => {
    expect(isScheduleLate("09:00", 8 * 60, grace)).toBe(false);
  });

  test("well after startTime is late", () => {
    expect(isScheduleLate("09:00", 11 * 60, grace)).toBe(true);
  });

  test("uses custom graceMinutes", () => {
    expect(isScheduleLate("09:00", 9 * 60 + 30, 30)).toBe(false);
    expect(isScheduleLate("09:00", 9 * 60 + 31, 30)).toBe(true);
  });
});

// ============================================================================
// buildDedupId
// ============================================================================

describe("buildDedupId", () => {
  test("formats correctly: scheduleId-HHMM-YYYY-MM-DD", () => {
    expect(buildDedupId("sched-abc", "09:00", "2025-01-15")).toBe(
      "sched-abc-0900-2025-01-15"
    );
  });

  test("removes colon from startTime", () => {
    expect(buildDedupId("sched-xyz", "13:30", "2025-07-01")).toBe(
      "sched-xyz-1330-2025-07-01"
    );
  });

  test("different start times on same day produce distinct IDs", () => {
    const id1 = buildDedupId("s1", "09:00", "2025-01-15");
    const id2 = buildDedupId("s1", "13:00", "2025-01-15");
    expect(id1).not.toBe(id2);
  });

  test("same start time on different days produce distinct IDs", () => {
    const id1 = buildDedupId("s1", "09:00", "2025-01-15");
    const id2 = buildDedupId("s1", "09:00", "2025-01-16");
    expect(id1).not.toBe(id2);
  });
});

// ============================================================================
// buildLatenessNotificationBody
// ============================================================================

describe("buildLatenessNotificationBody", () => {
  test("empty array returns empty string", () => {
    expect(buildLatenessNotificationBody([])).toBe("");
  });

  test("single provider — singular format", () => {
    const providers: LateProviderInfo[] = [
      { providerName: "Alex Smith", locationName: "Lincoln Elementary", startTime: "09:00" },
    ];
    expect(buildLatenessNotificationBody(providers)).toBe(
      "Alex Smith has not checked in at Lincoln Elementary (scheduled 9:00 AM)"
    );
  });

  test("single provider — PM time formats correctly", () => {
    const providers: LateProviderInfo[] = [
      { providerName: "Jordan Lee", locationName: "Washington", startTime: "13:30" },
    ];
    expect(buildLatenessNotificationBody(providers)).toBe(
      "Jordan Lee has not checked in at Washington (scheduled 1:30 PM)"
    );
  });

  test("single provider — noon formats as 12:00 PM", () => {
    const providers: LateProviderInfo[] = [
      { providerName: "Sam", locationName: "Eastside", startTime: "12:00" },
    ];
    expect(buildLatenessNotificationBody(providers)).toContain("12:00 PM");
  });

  test("single provider — midnight formats as 12:00 AM", () => {
    const providers: LateProviderInfo[] = [
      { providerName: "Pat", locationName: "Westside", startTime: "00:00" },
    ];
    expect(buildLatenessNotificationBody(providers)).toContain("12:00 AM");
  });

  test("multiple providers — plural format with count", () => {
    const providers: LateProviderInfo[] = [
      { providerName: "Alex Smith", locationName: "Lincoln", startTime: "09:00" },
      { providerName: "Jordan Lee", locationName: "Washington", startTime: "08:30" },
    ];
    const body = buildLatenessNotificationBody(providers);
    expect(body).toMatch(/^2 providers have not checked in:/);
    expect(body).toContain("Alex Smith (Lincoln, 9:00 AM)");
    expect(body).toContain("Jordan Lee (Washington, 8:30 AM)");
  });

  test("three providers includes all names", () => {
    const providers: LateProviderInfo[] = [
      { providerName: "A", locationName: "Loc1", startTime: "08:00" },
      { providerName: "B", locationName: "Loc2", startTime: "09:00" },
      { providerName: "C", locationName: "Loc3", startTime: "10:00" },
    ];
    const body = buildLatenessNotificationBody(providers);
    expect(body).toMatch(/^3 providers have not checked in:/);
    expect(body).toContain("A (Loc1, 8:00 AM)");
    expect(body).toContain("B (Loc2, 9:00 AM)");
    expect(body).toContain("C (Loc3, 10:00 AM)");
  });
});
