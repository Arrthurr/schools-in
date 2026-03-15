/**
 * Unit tests for CachedSessionService
 *
 * Tests the core session lifecycle:
 * - startSession: creates session via callable function
 * - endSession: ends active/paused session, calculates duration
 * - pauseSession: pauses active session
 * - resumeSession: resumes paused session
 * - getActiveSession: queries active/paused sessions
 * - validateSessionGeofence: validates user is within radius
 * - deleteSession: removes session document
 * - clearSessionCaches: invalidates cache keys
 */

import { getDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { CachedSessionService } from "../cachedSessionService";

// Mock Firebase modules (supplement global mocks from jest.setup.js)
jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

jest.mock("@/lib/cache/FirebaseCache", () => ({
  FirebaseCache: {
    cacheSessionData: jest.fn(
      async (_key: string, fetcher: () => Promise<any>) => fetcher()
    ),
    cacheStats: jest.fn(
      async (_key: string, fetcher: () => Promise<any>) => fetcher()
    ),
    generateQueryKey: jest.fn(
      (prefix: string, _filters: any, _order: string, _limit: number) => prefix
    ),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
  },
  CacheTracker: {
    recordHit: jest.fn(),
    recordMiss: jest.fn(),
  },
}));

jest.mock("@/lib/utils/time", () => ({
  getCurrentWeekRange: jest.fn(() => ({
    start: { toDate: () => new Date("2026-02-02") },
    end: { toDate: () => new Date("2026-02-08") },
  })),
  getTodayRange: jest.fn(() => ({
    start: { toMillis: () => Date.now() },
    end: { toMillis: () => Date.now() + 86400000 },
  })),
  getLastNDaysRange: jest.fn(() => ({
    start: { toMillis: () => Date.now() - 30 * 86400000 },
    end: { toMillis: () => Date.now() },
  })),
  minutesToHours: jest.fn((min: number) => min / 60),
}));

jest.mock("@/lib/utils/geo", () => ({
  validateGeofence: jest.fn(),
}));

const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;
const mockDeleteDoc = deleteDoc as jest.MockedFunction<typeof deleteDoc>;
const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockHttpsCallable = httpsCallable as jest.Mock;

const { validateGeofence: mockValidateGeofence } =
  require("@/lib/utils/geo") as { validateGeofence: jest.Mock };
const { FirebaseCache } =
  require("@/lib/cache/FirebaseCache") as { FirebaseCache: { invalidateCache: jest.Mock } };

describe("CachedSessionService", () => {
  let mockStartSessionFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStartSessionFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockStartSessionFn);
  });

  // ---------------------------------------------------------------------------
  // startSession
  // ---------------------------------------------------------------------------

  describe("startSession", () => {
    const sessionData = {
      locationId: "loc-1",
      startTime: new Date("2026-02-08T10:00:00Z"),
      checkInMethod: "geo" as const,
      distanceFromCenterAtCheckIn: 50,
      dayKey: "2026-02-08",
      checkInLocation: {
        latitude: 34.0522,
        longitude: -118.2437,
        accuracy: 10,
      },
    };

    it("creates a session via the callable function", async () => {
      const mockSession = {
        id: "session-1",
        userId: "user-1",
        locationId: "loc-1",
        status: "active",
      };

      mockStartSessionFn.mockResolvedValue({
        data: { success: true, session: mockSession },
      });

      const result = await CachedSessionService.startSession(sessionData);

      expect(mockHttpsCallable).toHaveBeenCalled();
      expect(mockStartSessionFn).toHaveBeenCalledWith(sessionData);
      expect(result).toEqual(mockSession);
    });

    it("throws when callable returns unsuccessful", async () => {
      mockStartSessionFn.mockResolvedValue({
        data: { success: false, error: "Already has active session" },
      });

      await expect(
        CachedSessionService.startSession(sessionData)
      ).rejects.toThrow("Already has active session");
    });

    it("throws on network error", async () => {
      mockStartSessionFn.mockRejectedValue(new Error("Network error"));

      await expect(
        CachedSessionService.startSession(sessionData)
      ).rejects.toThrow("Network error");
    });
  });

  // ---------------------------------------------------------------------------
  // endSession
  // ---------------------------------------------------------------------------

  describe("endSession", () => {
    const endData = {
      endTime: new Date("2026-02-08T12:00:00Z"),
      notes: "Completed",
    };

    it("ends a session via the endSession callable", async () => {
      const mockCallable = jest.fn().mockResolvedValue({
        data: {
          success: true,
          sessionId: "session-1",
          sessionUpdates: {
            status: "completed",
            active: false,
            durationMinutes: 120,
            userId: "user-1",
            locationId: "loc-1",
          },
        },
      });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      const result = await CachedSessionService.endSession("session-1", endData);

      expect(httpsCallable).toHaveBeenCalledWith(undefined, "endSession");
      expect(mockCallable).toHaveBeenCalledWith({
        sessionId: "session-1",
        checkOutTime: endData.endTime.toISOString(),
        notes: "Completed",
      });
      expect(result.status).toBe("completed");
      expect(result.id).toBe("session-1");
    });

    it("throws when callable returns failure", async () => {
      const mockCallable = jest.fn().mockResolvedValue({
        data: { success: false, error: "Session not found" },
      });
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(
        CachedSessionService.endSession("missing-session", endData)
      ).rejects.toThrow("Session not found");
    });

    it("throws when callable rejects", async () => {
      const mockCallable = jest.fn().mockRejectedValue(new Error("Session is not active."));
      (httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      await expect(
        CachedSessionService.endSession("completed-session", endData)
      ).rejects.toThrow("Session is not active.");
    });
  });

  // ---------------------------------------------------------------------------
  // pauseSession
  // ---------------------------------------------------------------------------

  describe("pauseSession", () => {
    it("pauses an active session", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "user-1",
          locationId: "loc-1",
          status: "active",
        }),
      } as any);

      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await CachedSessionService.pauseSession("session-1");

      expect(mockUpdateDoc).toHaveBeenCalled();
      expect(result.status).toBe("paused");
      expect((result as any).active).toBe(true); // Still counts as "active" for listeners
    });

    it("throws when session is not active", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "user-1",
          locationId: "loc-1",
          status: "completed",
        }),
      } as any);

      await expect(
        CachedSessionService.pauseSession("session-1")
      ).rejects.toThrow("Only active sessions can be paused");
    });

    it("throws when session not found", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await expect(
        CachedSessionService.pauseSession("missing")
      ).rejects.toThrow("Session not found");
    });
  });

  // ---------------------------------------------------------------------------
  // resumeSession
  // ---------------------------------------------------------------------------

  describe("resumeSession", () => {
    it("resumes a paused session", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "user-1",
          locationId: "loc-1",
          status: "paused",
        }),
      } as any);

      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await CachedSessionService.resumeSession("session-1");

      expect(result.status).toBe("active");
      expect((result as any).active).toBe(true);
    });

    it("throws when session is not paused", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "user-1",
          locationId: "loc-1",
          status: "active",
        }),
      } as any);

      await expect(
        CachedSessionService.resumeSession("session-1")
      ).rejects.toThrow("Only paused sessions can be resumed");
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveSession
  // ---------------------------------------------------------------------------

  describe("getActiveSession", () => {
    it("returns active session for user", async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: "active-1",
            data: () => ({ userId: "user-1", status: "active" }),
          },
        ],
      } as any);

      const result = await CachedSessionService.getActiveSession("user-1");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("active-1");
    });

    it("returns null when no active session", async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      } as any);

      const result = await CachedSessionService.getActiveSession("user-1");
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // validateSessionGeofence
  // ---------------------------------------------------------------------------

  describe("validateSessionGeofence", () => {
    it("returns valid when user is within radius", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          geo: { latitude: 34.0522, longitude: -118.2437 },
          radiusMeters: 300,
        }),
      } as any);

      mockValidateGeofence.mockReturnValue({
        isWithinGeofence: true,
        distance: 50,
      });

      const result = await CachedSessionService.validateSessionGeofence(
        "loc-1",
        34.0525,
        -118.2440
      );

      expect(result.isValid).toBe(true);
      expect(result.distance).toBe(50);
      expect(result.radiusMeters).toBe(300);
    });

    it("returns invalid when user is outside radius", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          geo: { latitude: 34.0522, longitude: -118.2437 },
          radiusMeters: 300,
        }),
      } as any);

      mockValidateGeofence.mockReturnValue({
        isWithinGeofence: false,
        distance: 500,
      });

      const result = await CachedSessionService.validateSessionGeofence(
        "loc-1",
        34.06,
        -118.25
      );

      expect(result.isValid).toBe(false);
      expect(result.distance).toBe(500);
    });

    it("throws when location not found", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await expect(
        CachedSessionService.validateSessionGeofence("missing", 0, 0)
      ).rejects.toThrow("Location not found");
    });

    it("throws when location has no GPS coordinates", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          geo: null,
          radiusMeters: 300,
        }),
      } as any);

      await expect(
        CachedSessionService.validateSessionGeofence("loc-1", 34.05, -118.24)
      ).rejects.toThrow("Location has no GPS coordinates");
    });

    it("uses default radius when radiusMeters not set", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          geo: { latitude: 34.0522, longitude: -118.2437 },
          // radiusMeters not set
        }),
      } as any);

      mockValidateGeofence.mockReturnValue({
        isWithinGeofence: true,
        distance: 100,
      });

      const result = await CachedSessionService.validateSessionGeofence(
        "loc-1",
        34.0525,
        -118.244
      );

      // Default radius is 300m when location.radiusMeters is missing
      expect(result.radiusMeters).toBe(300);
      expect(mockValidateGeofence).toHaveBeenCalledWith(
        34.0525,
        -118.244,
        { latitude: 34.0522, longitude: -118.2437 },
        300
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSession
  // ---------------------------------------------------------------------------

  describe("deleteSession", () => {
    it("deletes an existing session", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          userId: "user-1",
          locationId: "loc-1",
        }),
      } as any);

      mockDeleteDoc.mockResolvedValue(undefined);

      await CachedSessionService.deleteSession("session-1");
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it("throws when session not found", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      } as any);

      await expect(
        CachedSessionService.deleteSession("missing")
      ).rejects.toThrow("Session not found");
    });
  });

  // ---------------------------------------------------------------------------
  // clearSessionCaches
  // ---------------------------------------------------------------------------

  describe("clearSessionCaches", () => {
    it("invalidates general session cache keys", async () => {
      await CachedSessionService.clearSessionCaches();

      expect(FirebaseCache.invalidateCache).toHaveBeenCalledWith(
        expect.arrayContaining([
          "sessions_",
          "active_sessions_",
          "recent_activity_",
          "avg_duration_",
          "today_sessions_",
        ])
      );
    });

    it("includes user-specific keys when userId provided", async () => {
      await CachedSessionService.clearSessionCaches("user-1");

      expect(FirebaseCache.invalidateCache).toHaveBeenCalledWith(
        expect.arrayContaining([
          "active_session_user-1",
          "user_sessions_user-1",
        ])
      );
    });

    it("includes location-specific keys when locationId provided", async () => {
      await CachedSessionService.clearSessionCaches(undefined, "loc-1");

      expect(FirebaseCache.invalidateCache).toHaveBeenCalledWith(
        expect.arrayContaining(["location_sessions_loc-1"])
      );
    });
  });
});
