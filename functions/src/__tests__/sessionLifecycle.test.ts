/**
 * Unit tests for session lifecycle validation functions
 */

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

import {
  validateStartSessionInput,
  validateCheckInMethod,
  validateUserForSession,
  validateProviderAssignment,
  validateLocationActive,
  validateGeofence,
  validateEndSessionInput,
  validateSessionOwnership,
  validateSessionStatus,
  calculateDurationMinutes,
  isWithinDuplicateWindow,
  validateScheduleGating,
} from "../sessionLifecycle";

// ============================================================================
// validateStartSessionInput
// ============================================================================

describe("validateStartSessionInput", () => {
  test("passes with all required fields", () => {
    expect(() =>
      validateStartSessionInput({
        locationId: "loc-1",
        startTime: "2025-01-01T08:00:00Z",
        checkInMethod: "geo",
        dayKey: "2025-01-01",
      })
    ).not.toThrow();
  });

  test("throws when data is null", () => {
    expect(() => validateStartSessionInput(null)).toThrow(
      "Missing required session data"
    );
  });

  test("throws when data is undefined", () => {
    expect(() => validateStartSessionInput(undefined)).toThrow(
      "Missing required session data"
    );
  });

  test("throws when locationId is missing", () => {
    expect(() =>
      validateStartSessionInput({
        startTime: "2025-01-01T08:00:00Z",
        checkInMethod: "geo",
        dayKey: "2025-01-01",
      })
    ).toThrow("Missing required session data");
  });

  test("throws when startTime is missing", () => {
    expect(() =>
      validateStartSessionInput({
        locationId: "loc-1",
        checkInMethod: "geo",
        dayKey: "2025-01-01",
      })
    ).toThrow("Missing required session data");
  });

  test("throws when checkInMethod is missing", () => {
    expect(() =>
      validateStartSessionInput({
        locationId: "loc-1",
        startTime: "2025-01-01T08:00:00Z",
        dayKey: "2025-01-01",
      })
    ).toThrow("Missing required session data");
  });

  test("throws when dayKey is missing", () => {
    expect(() =>
      validateStartSessionInput({
        locationId: "loc-1",
        startTime: "2025-01-01T08:00:00Z",
        checkInMethod: "geo",
      })
    ).toThrow("Missing required session data");
  });

  test("throws when data is empty object", () => {
    expect(() => validateStartSessionInput({})).toThrow(
      "Missing required session data"
    );
  });
});

// ============================================================================
// validateCheckInMethod
// ============================================================================

describe("validateCheckInMethod", () => {
  test("provider with geo is valid", () => {
    expect(() => validateCheckInMethod("provider", "geo")).not.toThrow();
  });

  test("provider with manual is valid", () => {
    expect(() => validateCheckInMethod("provider", "manual")).not.toThrow();
  });

  test("provider with offline-sync is valid", () => {
    expect(() => validateCheckInMethod("provider", "offline-sync")).not.toThrow();
  });

  test("admin with manual is valid", () => {
    expect(() => validateCheckInMethod("admin", "manual")).not.toThrow();
  });

  test("admin with geo throws", () => {
    expect(() => validateCheckInMethod("admin", "geo")).toThrow(
      "Admins must use manual check-in method."
    );
  });

  test("admin with offline-sync throws", () => {
    expect(() => validateCheckInMethod("admin", "offline-sync")).toThrow(
      "Admins must use manual check-in method."
    );
  });

  test("completely invalid method throws for provider", () => {
    expect(() => validateCheckInMethod("provider", "teleport")).toThrow(
      "Invalid checkInMethod: teleport"
    );
  });

  test("completely invalid method throws for admin", () => {
    expect(() => validateCheckInMethod("admin", "teleport")).toThrow(
      "Invalid checkInMethod: teleport"
    );
  });

  test("empty string method throws", () => {
    expect(() => validateCheckInMethod("provider", "")).toThrow(
      "Invalid checkInMethod:"
    );
  });
});

// ============================================================================
// validateUserForSession
// ============================================================================

describe("validateUserForSession", () => {
  test("active provider passes", () => {
    expect(() => validateUserForSession({ role: "provider" })).not.toThrow();
  });

  test("active admin passes", () => {
    expect(() => validateUserForSession({ role: "admin" })).not.toThrow();
  });

  test("user with isActive=true passes", () => {
    expect(() =>
      validateUserForSession({ role: "provider", isActive: true })
    ).not.toThrow();
  });

  test("user with isActive=false throws", () => {
    expect(() =>
      validateUserForSession({ role: "provider", isActive: false })
    ).toThrow("User account is not active");
  });

  test("user with disabled=true throws", () => {
    expect(() =>
      validateUserForSession({ role: "provider", disabled: true })
    ).toThrow("User account is not active");
  });

  test("user with invalid role throws", () => {
    expect(() =>
      validateUserForSession({ role: "student" as any })
    ).toThrow("Invalid user role for session creation");
  });

  test("user with no role throws", () => {
    expect(() =>
      validateUserForSession({ role: undefined as any })
    ).toThrow("Invalid user role for session creation");
  });

  test("user with empty string role throws", () => {
    expect(() =>
      validateUserForSession({ role: "" as any })
    ).toThrow("Invalid user role for session creation");
  });
});

// ============================================================================
// validateProviderAssignment
// ============================================================================

describe("validateProviderAssignment", () => {
  test("provider assigned to location passes", () => {
    expect(() =>
      validateProviderAssignment("provider", "user-1", {
        assignedProviders: ["user-1", "user-2"],
      })
    ).not.toThrow();
  });

  test("provider not assigned throws", () => {
    expect(() =>
      validateProviderAssignment("provider", "user-1", {
        assignedProviders: ["user-2", "user-3"],
      })
    ).toThrow("Provider is not assigned to this location");
  });

  test("provider with empty assignedProviders throws", () => {
    expect(() =>
      validateProviderAssignment("provider", "user-1", {
        assignedProviders: [],
      })
    ).toThrow("Provider is not assigned to this location");
  });

  test("provider with undefined assignedProviders throws", () => {
    expect(() =>
      validateProviderAssignment("provider", "user-1", {})
    ).toThrow("Provider is not assigned to this location");
  });

  test("admin always passes regardless of assignment", () => {
    expect(() =>
      validateProviderAssignment("admin", "admin-1", {
        assignedProviders: [],
      })
    ).not.toThrow();
  });

  test("admin passes even with no assignedProviders field", () => {
    expect(() =>
      validateProviderAssignment("admin", "admin-1", {})
    ).not.toThrow();
  });
});

// ============================================================================
// validateLocationActive
// ============================================================================

describe("validateLocationActive", () => {
  test("active location passes", () => {
    expect(() => validateLocationActive({ active: true })).not.toThrow();
  });

  test("location without active field passes (default)", () => {
    expect(() => validateLocationActive({})).not.toThrow();
  });

  test("inactive location throws", () => {
    expect(() => validateLocationActive({ active: false })).toThrow(
      "Location is not active"
    );
  });
});

// ============================================================================
// validateGeofence
// ============================================================================

describe("validateGeofence", () => {
  const schoolGeo = { latitude: 41.7815, longitude: -87.5951 };

  test("within radius passes and returns calculated distance", () => {
    // ~50m north of school
    const nearby = { latitude: 41.78195, longitude: -87.5951 };
    const distance = validateGeofence("geo", nearby, schoolGeo, 300);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(300);
  });

  test("outside radius throws with distance info", () => {
    // ~2km north
    const farAway = { latitude: 41.80, longitude: -87.5951 };
    expect(() => validateGeofence("geo", farAway, schoolGeo, 300)).toThrow(
      /must be within 300m/
    );
  });

  test("error message includes current distance", () => {
    const farAway = { latitude: 41.80, longitude: -87.5951 };
    expect(() => validateGeofence("geo", farAway, schoolGeo, 300)).toThrow(
      /Current distance: \d+m/
    );
  });

  test("manual without checkInLocation throws", () => {
    expect(() =>
      validateGeofence("manual", undefined, schoolGeo, 300)
    ).toThrow("Manual check-in requires checkInLocation");
  });

  test("geo with no location provided uses client distance", () => {
    const distance = validateGeofence("geo", undefined, undefined, 300, 150);
    expect(distance).toBe(150);
  });

  test("returns 0 when no location and no client distance", () => {
    const distance = validateGeofence("geo", undefined, undefined, 300);
    expect(distance).toBe(0);
  });

  test("custom radius (500m) enforces correctly", () => {
    // ~400m north, within 500m but outside 300m
    const midRange = { latitude: 41.7851, longitude: -87.5951 };
    const distance = validateGeofence("geo", midRange, schoolGeo, 500);
    expect(distance).toBeLessThan(500);
    expect(distance).toBeGreaterThan(300);
  });

  test("custom radius (500m) rejects beyond radius", () => {
    const farAway = { latitude: 41.80, longitude: -87.5951 };
    expect(() => validateGeofence("geo", farAway, schoolGeo, 500)).toThrow(
      /must be within 500m/
    );
  });

  test("offline-sync with no location returns client distance", () => {
    const distance = validateGeofence(
      "offline-sync",
      undefined,
      schoolGeo,
      300,
      42
    );
    expect(distance).toBe(42);
  });

  test("checkInLocation with non-numeric latitude uses client distance", () => {
    const badLocation = { latitude: "bad" as any, longitude: -87.5951 };
    const distance = validateGeofence("geo", badLocation, schoolGeo, 300, 10);
    expect(distance).toBe(10);
  });
});

// ============================================================================
// validateEndSessionInput
// ============================================================================

describe("validateEndSessionInput", () => {
  test("passes with sessionId and checkOutTime", () => {
    expect(() =>
      validateEndSessionInput({
        sessionId: "sess-1",
        checkOutTime: "2025-01-01T17:00:00Z",
      })
    ).not.toThrow();
  });

  test("throws when sessionId is missing", () => {
    expect(() =>
      validateEndSessionInput({ checkOutTime: "2025-01-01T17:00:00Z" })
    ).toThrow("Missing required session data: sessionId, checkOutTime");
  });

  test("throws when checkOutTime is missing", () => {
    expect(() =>
      validateEndSessionInput({ sessionId: "sess-1" })
    ).toThrow("Missing required session data: sessionId, checkOutTime");
  });

  test("throws when data is null", () => {
    expect(() => validateEndSessionInput(null)).toThrow(
      "Missing required session data"
    );
  });

  test("throws when data is undefined", () => {
    expect(() => validateEndSessionInput(undefined)).toThrow(
      "Missing required session data"
    );
  });
});

// ============================================================================
// validateSessionOwnership
// ============================================================================

describe("validateSessionOwnership", () => {
  test("matching user passes", () => {
    expect(() =>
      validateSessionOwnership("user-123", "user-123")
    ).not.toThrow();
  });

  test("non-matching user throws", () => {
    expect(() =>
      validateSessionOwnership("user-123", "user-456")
    ).toThrow("You are not authorized to end this session.");
  });
});

// ============================================================================
// validateSessionStatus
// ============================================================================

describe("validateSessionStatus", () => {
  test("active status passes", () => {
    expect(() => validateSessionStatus("active")).not.toThrow();
  });

  test("paused status passes", () => {
    expect(() => validateSessionStatus("paused")).not.toThrow();
  });

  test("completed status throws", () => {
    expect(() => validateSessionStatus("completed")).toThrow(
      "Session is not active."
    );
  });

  test("error status throws", () => {
    expect(() => validateSessionStatus("error")).toThrow(
      "Session is not active."
    );
  });

  test("cancelled status throws", () => {
    expect(() => validateSessionStatus("cancelled")).toThrow(
      "Session is not active."
    );
  });

  test("empty string throws", () => {
    expect(() => validateSessionStatus("")).toThrow("Session is not active.");
  });
});

// ============================================================================
// calculateDurationMinutes
// ============================================================================

describe("calculateDurationMinutes", () => {
  test("calculates correct duration for 1 hour", () => {
    const start = new Date("2025-01-01T08:00:00Z").getTime();
    const end = new Date("2025-01-01T09:00:00Z").getTime();
    expect(calculateDurationMinutes(start, end)).toBe(60);
  });

  test("calculates correct duration for 8 hours 30 minutes", () => {
    const start = new Date("2025-01-01T08:00:00Z").getTime();
    const end = new Date("2025-01-01T16:30:00Z").getTime();
    expect(calculateDurationMinutes(start, end)).toBe(510);
  });

  test("returns 0 for same start and end time", () => {
    const t = new Date("2025-01-01T08:00:00Z").getTime();
    expect(calculateDurationMinutes(t, t)).toBe(0);
  });

  test("returns 0 when end is before start (negative duration)", () => {
    const start = new Date("2025-01-01T09:00:00Z").getTime();
    const end = new Date("2025-01-01T08:00:00Z").getTime();
    expect(calculateDurationMinutes(start, end)).toBe(0);
  });

  test("floors partial minutes", () => {
    const start = new Date("2025-01-01T08:00:00Z").getTime();
    const end = new Date("2025-01-01T08:01:45Z").getTime(); // 1 min 45 sec
    expect(calculateDurationMinutes(start, end)).toBe(1);
  });

  test("handles very short duration (< 1 min)", () => {
    const start = new Date("2025-01-01T08:00:00Z").getTime();
    const end = new Date("2025-01-01T08:00:30Z").getTime(); // 30 sec
    expect(calculateDurationMinutes(start, end)).toBe(0);
  });
});

// ============================================================================
// isWithinDuplicateWindow
// ============================================================================

describe("isWithinDuplicateWindow", () => {
  test("within 5-minute window returns true", () => {
    const proposed = "2025-01-01T08:00:00Z";
    const existing = new Date("2025-01-01T08:03:00Z").getTime(); // 3 min apart
    expect(isWithinDuplicateWindow(proposed, existing)).toBe(true);
  });

  test("exactly at 5-minute boundary returns true", () => {
    const proposed = "2025-01-01T08:00:00Z";
    const existing = new Date("2025-01-01T08:05:00Z").getTime();
    expect(isWithinDuplicateWindow(proposed, existing)).toBe(true);
  });

  test("outside 5-minute window returns false", () => {
    const proposed = "2025-01-01T08:00:00Z";
    const existing = new Date("2025-01-01T08:06:00Z").getTime(); // 6 min apart
    expect(isWithinDuplicateWindow(proposed, existing)).toBe(false);
  });

  test("existing before proposed within window returns true", () => {
    const proposed = "2025-01-01T08:05:00Z";
    const existing = new Date("2025-01-01T08:02:00Z").getTime(); // 3 min before
    expect(isWithinDuplicateWindow(proposed, existing)).toBe(true);
  });

  test("same time returns true", () => {
    const proposed = "2025-01-01T08:00:00Z";
    const existing = new Date("2025-01-01T08:00:00Z").getTime();
    expect(isWithinDuplicateWindow(proposed, existing)).toBe(true);
  });

  test("just outside window (5 min + 1 sec) returns false", () => {
    const proposed = "2025-01-01T08:00:00Z";
    const existing = new Date("2025-01-01T08:05:01Z").getTime();
    expect(isWithinDuplicateWindow(proposed, existing)).toBe(false);
  });
});

// ============================================================================
// validateScheduleGating
// ============================================================================

describe("validateScheduleGating", () => {
  test("empty schedules always passes", () => {
    expect(() => validateScheduleGating(0, [])).not.toThrow();
    expect(() => validateScheduleGating(1439, [])).not.toThrow();
  });

  test("before earliest schedule minus 15 min throws", () => {
    // Schedule at 09:00 (540 min), earliest check-in at 08:45 (525 min)
    // Current time 08:00 (480 min) → too early
    expect(() => validateScheduleGating(480, ["09:00"])).toThrow(
      "Check-in opens at"
    );
  });

  test("error message includes correct time and schedule info", () => {
    expect(() => validateScheduleGating(480, ["09:00"])).toThrow(
      "Check-in opens at 8:45 AM. Your first session starts at 09:00."
    );
  });

  test("within 15-min window passes", () => {
    // Schedule at 09:00, earliest check-in at 08:45 (525 min)
    // Current time 08:50 (530 min) → allowed
    expect(() => validateScheduleGating(530, ["09:00"])).not.toThrow();
  });

  test("exactly at 15-min-before boundary passes", () => {
    // Schedule at 09:00, earliest check-in at 08:45 (525 min)
    expect(() => validateScheduleGating(525, ["09:00"])).not.toThrow();
  });

  test("after schedule start passes", () => {
    // Schedule at 09:00 (540 min), current time 09:30 (570 min)
    expect(() => validateScheduleGating(570, ["09:00"])).not.toThrow();
  });

  test("uses earliest schedule when multiple exist", () => {
    // Schedules at 09:00 and 14:00 (sorted), earliest check-in at 08:45
    // Current time 08:30 (510 min) → too early for 09:00 but would be OK for 14:00
    expect(() => validateScheduleGating(510, ["09:00", "14:00"])).toThrow(
      "Check-in opens at"
    );
  });

  test("PM schedule formats correctly", () => {
    // Schedule at 14:00 (2 PM), earliest check-in at 13:45
    // Current time 12:00 → too early
    expect(() => validateScheduleGating(720, ["14:00"])).toThrow(
      "Check-in opens at 1:45 PM. Your first session starts at 14:00."
    );
  });

  test("noon boundary formats correctly", () => {
    // Schedule at 12:15, earliest check-in at 12:00
    // Current time 11:30 (690 min) → too early
    expect(() => validateScheduleGating(690, ["12:15"])).toThrow(
      "Check-in opens at 12:00 PM"
    );
  });

  test("midnight/early-morning schedule works", () => {
    // Schedule at 00:30, earliest check-in at 00:15
    // Current time 00:00 (0 min) → too early
    expect(() => validateScheduleGating(0, ["00:30"])).toThrow(
      "Check-in opens at 12:15 AM"
    );
  });
});
