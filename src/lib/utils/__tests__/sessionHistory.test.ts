import { Timestamp } from "firebase/firestore";
import {
  aggregateHoursByLocation,
  buildDurationHistogram,
  getDurationMinutes,
} from "../sessionHistory";
import { Session } from "@/lib/firebase/types";

const makeTimestamp = (date: Date) => Timestamp.fromDate(date);

const buildSession = (overrides: Partial<Session>): Session => ({
  id: "s1",
  userId: "u1",
  locationId: "loc1",
  startTime: makeTimestamp(new Date("2024-01-01T08:00:00Z")),
  endTime: makeTimestamp(new Date("2024-01-01T09:00:00Z")),
  status: "completed",
  checkInMethod: "geo",
  distanceFromCenterAtCheckIn: 5,
  dayKey: "2024-01-01",
  createdAt: makeTimestamp(new Date("2024-01-01T08:00:00Z")),
  updatedAt: makeTimestamp(new Date("2024-01-01T09:00:00Z")),
  ...overrides,
});

describe("sessionHistory utils", () => {
  it("falls back to start/end when durationMinutes missing", () => {
    const session = buildSession({
      durationMinutes: undefined,
      startTime: makeTimestamp(new Date("2024-01-01T08:00:00Z")),
      endTime: makeTimestamp(new Date("2024-01-01T08:45:00Z")),
    });

    expect(getDurationMinutes(session)).toBe(45);
  });

  it("aggregates hours by location and buckets extra into Other", () => {
    const sessions: Session[] = [
      buildSession({ id: "1", locationId: "a", durationMinutes: 60 }),
      buildSession({ id: "2", locationId: "b", durationMinutes: 30 }),
      buildSession({ id: "3", locationId: "c", durationMinutes: 15 }),
      buildSession({ id: "4", locationId: "d", durationMinutes: 15 }),
      buildSession({ id: "5", locationId: "e", durationMinutes: 10 }),
      buildSession({ id: "6", locationId: "f", durationMinutes: 10 }),
    ];

    const result = aggregateHoursByLocation(
      sessions,
      {
        a: "Alpha",
        b: "Bravo",
        c: "Charlie",
        d: "Delta",
        e: "Echo",
        f: "Foxtrot",
      },
      4
    );

    expect(result).toEqual([
      { locationName: "Alpha", hours: 1 },
      { locationName: "Bravo", hours: 0.5 },
      { locationName: "Charlie", hours: 0.25 },
      { locationName: "Other", hours: 0.59 },
    ]);
  });

  it("builds duration histogram across bins", () => {
    const sessions: Session[] = [
      buildSession({ id: "1", durationMinutes: 10 }),
      buildSession({ id: "2", durationMinutes: 20 }),
      buildSession({ id: "3", durationMinutes: 35 }),
      buildSession({ id: "4", durationMinutes: 50 }),
      buildSession({ id: "5", durationMinutes: 70 }),
      buildSession({ id: "6", durationMinutes: 120 }),
    ];

    const histogram = buildDurationHistogram(sessions);
    expect(histogram).toEqual([
      { binLabel: "0–15m", sessionCount: 1 },
      { binLabel: "15–30m", sessionCount: 1 },
      { binLabel: "30–45m", sessionCount: 1 },
      { binLabel: "45–60m", sessionCount: 1 },
      { binLabel: "60–90m", sessionCount: 1 },
      { binLabel: "90m+", sessionCount: 1 },
    ]);
  });
});
