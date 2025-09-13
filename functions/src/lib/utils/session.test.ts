// Unit tests for session utilities

import { Timestamp } from "firebase/firestore";
import {
  calculateSessionDuration,
  formatDuration,
  formatDurationDetailed,
  formatSessionTime,
  getSessionStatusColor,
  getSessionStatusConfig,
  validateSessionData,
  isSessionStillActive,
  createSessionSummary,
  SessionData,
} from "./session";
import { Coordinates } from "./location";

describe("Session Utilities", () => {
  const mockTimestamp = Timestamp.fromDate(new Date("2024-01-01T10:00:00Z"));
  const mockTimestampLater = Timestamp.fromDate(
    new Date("2024-01-01T12:30:00Z")
  );

  describe("calculateSessionDuration", () => {
    it("returns 0 when no checkOutTime provided", () => {
      const result = calculateSessionDuration(mockTimestamp);
      expect(result).toBe(0);
    });

    it("calculates duration in minutes correctly", () => {
      const result = calculateSessionDuration(
        mockTimestamp,
        mockTimestampLater
      );
      expect(result).toBe(150); // 2.5 hours = 150 minutes
    });

    it("rounds to nearest minute", () => {
      const timestamp1 = Timestamp.fromDate(new Date("2024-01-01T10:00:00Z"));
      const timestamp2 = Timestamp.fromDate(new Date("2024-01-01T10:30:25Z")); // 30 minutes 25 seconds
      const result = calculateSessionDuration(timestamp1, timestamp2);
      expect(result).toBe(30); // Should round down (30.416... minutes rounds to 30)
    });
  });

  describe("formatDuration", () => {
    it("formats 0 minutes correctly", () => {
      expect(formatDuration(0)).toBe("0m");
    });

    it("formats minutes under 60 correctly", () => {
      expect(formatDuration(30)).toBe("30m");
      expect(formatDuration(1)).toBe("1m");
    });

    it("formats hours correctly", () => {
      expect(formatDuration(60)).toBe("1h");
      expect(formatDuration(120)).toBe("2h");
    });

    it("formats hours and minutes correctly", () => {
      expect(formatDuration(90)).toBe("1h 30m");
      expect(formatDuration(150)).toBe("2h 30m");
    });
  });

  describe("formatDurationDetailed", () => {
    it("formats 0 minutes correctly", () => {
      expect(formatDurationDetailed(0)).toBe("0 minutes");
    });

    it("formats single minute correctly", () => {
      expect(formatDurationDetailed(1)).toBe("1 minute");
    });

    it("formats multiple minutes correctly", () => {
      expect(formatDurationDetailed(30)).toBe("30 minutes");
    });

    it("formats single hour correctly", () => {
      expect(formatDurationDetailed(60)).toBe("1 hour");
    });

    it("formats multiple hours correctly", () => {
      expect(formatDurationDetailed(120)).toBe("2 hours");
    });

    it("formats hours and minutes correctly", () => {
      expect(formatDurationDetailed(90)).toBe("1 hour 30 minutes");
      expect(formatDurationDetailed(150)).toBe("2 hours 30 minutes");
    });
  });

  describe("formatSessionTime", () => {
    it("formats timestamp to locale string", () => {
      const result = formatSessionTime(mockTimestamp);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getSessionStatusColor", () => {
    it("returns correct color for active status", () => {
      expect(getSessionStatusColor("active")).toBe(
        "bg-green-100 text-green-800 border-green-200"
      );
    });

    it("returns correct color for completed status", () => {
      expect(getSessionStatusColor("completed")).toBe(
        "bg-primary/10 text-primary border-primary/20"
      );
    });

    it("returns correct color for paused status", () => {
      expect(getSessionStatusColor("paused")).toBe(
        "bg-yellow-100 text-yellow-800 border-yellow-200"
      );
    });

    it("returns correct color for error status", () => {
      expect(getSessionStatusColor("error")).toBe(
        "bg-red-100 text-red-800 border-red-200"
      );
    });

    it("returns correct color for cancelled status", () => {
      expect(getSessionStatusColor("cancelled")).toBe(
        "bg-gray-100 text-gray-800 border-gray-200"
      );
    });

    it("returns default color for unknown status", () => {
      expect(getSessionStatusColor("unknown")).toBe(
        "bg-gray-100 text-gray-800 border-gray-200"
      );
    });
  });

  describe("getSessionStatusConfig", () => {
    it("returns correct config for active status", () => {
      const config = getSessionStatusConfig("active");
      expect(config.label).toBe("Active");
      expect(config.icon).toBe("Clock");
      expect(config.description).toBe("Session is currently in progress");
    });

    it("returns correct config for completed status", () => {
      const config = getSessionStatusConfig("completed");
      expect(config.label).toBe("Completed");
      expect(config.icon).toBe("CheckCircle");
    });

    it("returns correct config for unknown status", () => {
      const config = getSessionStatusConfig("unknown");
      expect(config.label).toBe("unknown");
      expect(config.icon).toBe("HelpCircle");
    });
  });

  describe("validateSessionData", () => {
    const validCoordinates: Coordinates = {
      latitude: 40.7128,
      longitude: -74.006,
    };

    it("returns no errors for valid session data", () => {
      const validData: Partial<SessionData> = {
        userId: "user123",
        schoolId: "school123",
        checkInLocation: validCoordinates,
        checkInTime: mockTimestamp,
      };
      expect(validateSessionData(validData)).toEqual([]);
    });

    it("returns errors for missing userId", () => {
      const invalidData: Partial<SessionData> = {
        schoolId: "school123",
        checkInLocation: validCoordinates,
        checkInTime: mockTimestamp,
      };
      expect(validateSessionData(invalidData)).toContain("User ID is required");
    });

    it("returns errors for missing schoolId", () => {
      const invalidData: Partial<SessionData> = {
        userId: "user123",
        checkInLocation: validCoordinates,
        checkInTime: mockTimestamp,
      };
      expect(validateSessionData(invalidData)).toContain(
        "School ID is required"
      );
    });

    it("returns errors for missing checkInLocation", () => {
      const invalidData: Partial<SessionData> = {
        userId: "user123",
        schoolId: "school123",
        checkInTime: mockTimestamp,
      };
      expect(validateSessionData(invalidData)).toContain(
        "Check-in location is required"
      );
    });

    it("returns errors for missing checkInTime", () => {
      const invalidData: Partial<SessionData> = {
        userId: "user123",
        schoolId: "school123",
        checkInLocation: validCoordinates,
      };
      expect(validateSessionData(invalidData)).toContain(
        "Check-in time is required"
      );
    });

    it("returns multiple errors when multiple fields are missing", () => {
      const invalidData: Partial<SessionData> = {};
      const errors = validateSessionData(invalidData);
      expect(errors.length).toBeGreaterThan(1);
    });
  });

  describe("isSessionStillActive", () => {
    it("returns true for recent session within default limit", () => {
      const recentTimestamp = Timestamp.fromDate(
        new Date(Date.now() - 6 * 60 * 60 * 1000)
      ); // 6 hours ago
      expect(isSessionStillActive(recentTimestamp)).toBe(true);
    });

    it("returns false for old session beyond default limit", () => {
      const oldTimestamp = Timestamp.fromDate(
        new Date(Date.now() - 15 * 60 * 60 * 1000)
      ); // 15 hours ago
      expect(isSessionStillActive(oldTimestamp)).toBe(false);
    });

    it("respects custom max hours limit", () => {
      const timestamp = Timestamp.fromDate(
        new Date(Date.now() - 2 * 60 * 60 * 1000)
      ); // 2 hours ago
      expect(isSessionStillActive(timestamp, 1)).toBe(false); // 1 hour limit
      expect(isSessionStillActive(timestamp, 3)).toBe(true); // 3 hour limit
    });
  });

  describe("createSessionSummary", () => {
    const mockSessions: SessionData[] = [
      {
        id: "1",
        userId: "user1",
        schoolId: "school1",
        checkInTime: mockTimestamp,
        checkOutTime: mockTimestampLater,
        checkInLocation: { latitude: 40.7128, longitude: -74.006 },
        status: "completed",
        duration: 150,
      },
      {
        id: "2",
        userId: "user1",
        schoolId: "school2",
        checkInTime: mockTimestamp,
        checkInLocation: { latitude: 40.7128, longitude: -74.006 },
        status: "active",
      },
      {
        id: "3",
        userId: "user2",
        schoolId: "school1",
        checkInTime: mockTimestamp,
        checkOutTime: mockTimestampLater,
        checkInLocation: { latitude: 40.7128, longitude: -74.006 },
        status: "completed",
        duration: 90,
      },
    ];

    it("calculates summary statistics correctly", () => {
      const summary = createSessionSummary(mockSessions);

      expect(summary.totalSessions).toBe(3);
      expect(summary.activeSessions).toBe(1);
      expect(summary.completedSessions).toBe(2);
      expect(summary.totalDuration).toBe(240); // 150 + 90
      expect(summary.averageDuration).toBe(120); // 240 / 2
    });

    it("handles empty session array", () => {
      const summary = createSessionSummary([]);

      expect(summary.totalSessions).toBe(0);
      expect(summary.activeSessions).toBe(0);
      expect(summary.completedSessions).toBe(0);
      expect(summary.totalDuration).toBe(0);
      expect(summary.averageDuration).toBe(0);
    });

    it("handles sessions without duration", () => {
      const sessionsWithoutDuration: SessionData[] = [
        {
          id: "1",
          userId: "user1",
          schoolId: "school1",
          checkInTime: mockTimestamp,
          checkInLocation: { latitude: 40.7128, longitude: -74.006 },
          status: "completed",
        },
      ];

      const summary = createSessionSummary(sessionsWithoutDuration);
      expect(summary.totalDuration).toBe(0);
      expect(summary.averageDuration).toBe(0);
    });
  });
});
