/**
 * Tests for useScheduleGate hook
 * Verifies schedule-based time gating with 15-minute grace period
 */
import { renderHook, waitFor } from "@testing-library/react";
import { useScheduleGate } from "./useScheduleGate";
import * as scheduleService from "@/lib/services/scheduleService";
import { Timestamp } from "firebase/firestore";

jest.mock("@/lib/services/scheduleService");
jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));
jest.mock("../../../firebase.config", () => ({
  db: {},
}));

const mockGetSchedulesByProviderAndLocation =
  scheduleService.getSchedulesByProviderAndLocation as jest.Mock;

/** Get current day-of-week and time in America/Chicago (matches hook logic) */
function getChicagoNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = weekdayMap[get("weekday")] ?? now.getDay();
  const hours = Number(get("hour").replace(/^24$/, "00"));
  const minutes = Number(get("minute"));
  return { dayOfWeek, hours, minutes };
}

const baseSchedule = {
  id: "sched-1",
  providerId: "provider-1",
  locationId: "location-1",
  serviceId: "service-1",
  dayOfWeek: getChicagoNow().dayOfWeek,
  startTime: "09:00",
  endTime: "10:00",
  isActive: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: "admin-1",
};

describe("useScheduleGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("returns canCheckIn=true when no providerId or locationId", async () => {
    const { result } = renderHook(() =>
      useScheduleGate(undefined, undefined)
    );

    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it("returns canCheckIn=true with no message when no schedule exists today", async () => {
    mockGetSchedulesByProviderAndLocation.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.message).toBeNull();
    expect(result.current.earliestCheckInTime).toBeNull();
  });

  it("blocks check-in when current time is before the grace window", async () => {
    // Force the schedule start time to be 3 hours from now — well outside the 15-min window
    const chicago = getChicagoNow();
    const futureHour = (chicago.hours + 3) % 24;
    const startTime = `${String(futureHour).padStart(2, "0")}:${String(chicago.minutes).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: chicago.dayOfWeek, startTime },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCheckIn).toBe(false);
    expect(result.current.message).toMatch(/Check-in opens at/);
    expect(result.current.earliestCheckInTime).not.toBeNull();
  });

  it("allows check-in when current time is within the 15-minute grace window", async () => {
    // Schedule starts 10 minutes from now — within the 15-min grace window
    const chicago = getChicagoNow();
    const totalMin = chicago.hours * 60 + chicago.minutes + 10;
    const startHour = Math.floor(totalMin / 60) % 24;
    const startMin = totalMin % 60;
    const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: chicago.dayOfWeek, startTime },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.message).toBeNull();
  });

  it("allows check-in when current time is past the schedule start", async () => {
    // Schedule started 1 hour ago
    const chicago = getChicagoNow();
    const totalMin = Math.max(0, chicago.hours * 60 + chicago.minutes - 60);
    const startHour = Math.floor(totalMin / 60);
    const startMin = totalMin % 60;
    const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: chicago.dayOfWeek, startTime },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.message).toBeNull();
  });

  it("ignores inactive schedules", async () => {
    // Inactive schedule far in the future — should not block
    const chicago = getChicagoNow();
    const futureHour = (chicago.hours + 5) % 24;
    const startTime = `${String(futureHour).padStart(2, "0")}:00`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      {
        ...baseSchedule,
        dayOfWeek: chicago.dayOfWeek,
        startTime,
        isActive: false,
      },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.message).toBeNull();
  });

  it("picks the earliest schedule when multiple exist today", async () => {
    const chicago = getChicagoNow();
    const nowMin = chicago.hours * 60 + chicago.minutes;
    const endOfDay = 23 * 60 + 59; // 23:59
    const remaining = endOfDay - nowMin;
    // Need two future times both >15 min from now and before midnight
    const nearOffset = Math.min(120, Math.floor(remaining * 0.5));
    const farOffset = Math.min(240, Math.max(nearOffset + 15, Math.floor(remaining * 0.85)));
    const nearTotalMin = nowMin + nearOffset;
    const farTotalMin = nowMin + farOffset;
    const nearStart = `${String(Math.floor(nearTotalMin / 60)).padStart(2, "0")}:${String(nearTotalMin % 60).padStart(2, "0")}`;
    const farStart = `${String(Math.floor(farTotalMin / 60)).padStart(2, "0")}:${String(farTotalMin % 60).padStart(2, "0")}`;

    // Schedule with nearStart should be the earliest — gate opens 15 min before it
    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, id: "s2", dayOfWeek: chicago.dayOfWeek, startTime: farStart },
      { ...baseSchedule, id: "s1", dayOfWeek: chicago.dayOfWeek, startTime: nearStart },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Both schedules are in the future, so check-in is blocked
    expect(result.current.canCheckIn).toBe(false);
    // The gate message should be non-null, referencing the earliest schedule
    expect(result.current.message).not.toBeNull();
  });

  it("fails open (canCheckIn=true) when the service call fails", async () => {
    mockGetSchedulesByProviderAndLocation.mockRejectedValue(
      new Error("Firestore error")
    );

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Server will enforce; fail open on the client
    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it("automatically re-checks when the gate is blocked (tick timer)", async () => {
    jest.useFakeTimers();

    const chicago = getChicagoNow();
    const futureHour = (chicago.hours + 3) % 24;
    const startTime = `${String(futureHour).padStart(2, "0")}:${String(chicago.minutes).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: chicago.dayOfWeek, startTime },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCheckIn).toBe(false);

    // The hook should have scheduled a setTimeout; verify the service is called again after advancing
    mockGetSchedulesByProviderAndLocation.mockClear();

    jest.advanceTimersByTime(60_000);
    await waitFor(() =>
      expect(mockGetSchedulesByProviderAndLocation).toHaveBeenCalled()
    );

    jest.useRealTimers();
  });

  it("clears tick timer on unmount", async () => {
    jest.useFakeTimers();

    const chicago = getChicagoNow();
    const futureHour = (chicago.hours + 3) % 24;
    const startTime = `${String(futureHour).padStart(2, "0")}:${String(chicago.minutes).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: chicago.dayOfWeek, startTime },
    ]);

    const { result, unmount } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canCheckIn).toBe(false);

    unmount();
    mockGetSchedulesByProviderAndLocation.mockClear();

    // Timer should be cancelled — no new call after advancing
    jest.advanceTimersByTime(120_000);
    expect(mockGetSchedulesByProviderAndLocation).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("filters schedules by dayOfWeek to only include today", async () => {
    const chicago = getChicagoNow();
    const today = chicago.dayOfWeek;
    const tomorrow = (today + 1) % 7;

    // Only a schedule for tomorrow — should not affect today
    const futureStart = `${String((chicago.hours + 3) % 24).padStart(2, "0")}:00`;
    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      {
        ...baseSchedule,
        dayOfWeek: tomorrow,
        startTime: futureStart,
      },
    ]);

    const { result } = renderHook(() =>
      useScheduleGate("provider-1", "location-1")
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCheckIn).toBe(true);
    expect(result.current.message).toBeNull();
  });
});
