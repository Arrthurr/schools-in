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

const baseSchedule = {
  id: "sched-1",
  providerId: "provider-1",
  locationId: "location-1",
  serviceId: "service-1",
  dayOfWeek: new Date().getDay(),
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
    const now = new Date();
    const futureHour = (now.getHours() + 3) % 24;
    const startTime = `${String(futureHour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: now.getDay(), startTime },
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
    const now = new Date();
    const tenMinutesAhead = new Date(now.getTime() + 10 * 60 * 1000);
    const startTime = `${String(tenMinutesAhead.getHours()).padStart(2, "0")}:${String(tenMinutesAhead.getMinutes()).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: now.getDay(), startTime },
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
    const now = new Date();
    const pastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const startTime = `${String(pastHour.getHours()).padStart(2, "0")}:${String(pastHour.getMinutes()).padStart(2, "0")}`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, dayOfWeek: now.getDay(), startTime },
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
    const now = new Date();
    const futureHour = (now.getHours() + 5) % 24;
    const startTime = `${String(futureHour).padStart(2, "0")}:00`;

    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      {
        ...baseSchedule,
        dayOfWeek: now.getDay(),
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
    const now = new Date();
    const farFutureHour = (now.getHours() + 4) % 24;
    const nearFutureHour = (now.getHours() + 2) % 24;
    const farStart = `${String(farFutureHour).padStart(2, "0")}:00`;
    const nearStart = `${String(nearFutureHour).padStart(2, "0")}:00`;

    // Schedule with nearStart should be the earliest — gate opens 15 min before it
    mockGetSchedulesByProviderAndLocation.mockResolvedValue([
      { ...baseSchedule, id: "s2", dayOfWeek: now.getDay(), startTime: farStart },
      { ...baseSchedule, id: "s1", dayOfWeek: now.getDay(), startTime: nearStart },
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

  it("filters schedules by dayOfWeek to only include today", async () => {
    const now = new Date();
    const today = now.getDay();
    const tomorrow = (today + 1) % 7;

    // Only a schedule for tomorrow — should not affect today
    const futureStart = `${String((now.getHours() + 3) % 24).padStart(2, "0")}:00`;
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
