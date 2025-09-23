import { renderHook, act } from "@testing-library/react";
import { useProviderMetrics } from "../useProviderMetrics";
import { useCachedAuth } from "../useCachedAuth";
import { CachedSessionService } from "../../services/cachedSessionService";
import { Timestamp } from "firebase/firestore";

// Mock dependencies
jest.mock("../useCachedAuth");
jest.mock("../../services/cachedSessionService");

const mockUseCachedAuth = useCachedAuth as jest.MockedFunction<
  typeof useCachedAuth
>;
const mockCachedSessionService = CachedSessionService as jest.Mocked<
  typeof CachedSessionService
>;

describe("useProviderMetrics", () => {
  const mockUser = {
    uid: "test-user-123",
    email: "test@example.com",
    displayName: "Test User",
  };

  const mockSession = {
    id: "session-123",
    userId: "test-user-123",
    locationId: "location-456",
    status: "active" as const,
    startTime: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")),
    endTime: null,
    durationMinutes: 0,
    checkInMethod: "geo" as const,
    distanceFromCenterAtCheckIn: 25,
    dayKey: "2024-01-15",
    notes: "",
    createdAt: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")),
    updatedAt: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")),
  };

  const mockCompletedSession = {
    ...mockSession,
    id: "session-completed",
    status: "completed" as const,
    endTime: Timestamp.fromDate(new Date("2024-01-15T12:30:00Z")),
    durationMinutes: 150,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default auth mock
    mockUseCachedAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      error: null,
      signOut: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      updateUserProfile: jest.fn(),
      sendPasswordReset: jest.fn(),
      isAuthenticated: true,
    });

    // Default session service mocks
    mockCachedSessionService.getCurrentSession = jest
      .fn()
      .mockResolvedValue(null);
    mockCachedSessionService.getUserWeeklySessions = jest
      .fn()
      .mockResolvedValue([]);
    mockCachedSessionService.startSession = jest
      .fn()
      .mockResolvedValue(mockSession);
    mockCachedSessionService.endSession = jest
      .fn()
      .mockResolvedValue(mockCompletedSession);
    mockCachedSessionService.updateSessionStatus = jest
      .fn()
      .mockResolvedValue(mockSession);
  });

  describe("initialization", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useProviderMetrics());

      expect(result.current.currentSession).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.weeklyMetrics.weeklySessionsCount).toBe(0);
      expect(result.current.weeklyMetrics.weeklyTotalHours).toBe(0);
      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.canStartSession).toBe(true);
      expect(result.current.canEndSession).toBe(false);
    });

    it("should handle auth loading state", () => {
      mockUseCachedAuth.mockReturnValue({
        user: null,
        loading: true,
        error: null,
        signOut: jest.fn(),
        signInWithGoogle: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        updateUserProfile: jest.fn(),
        sendPasswordReset: jest.fn(),
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useProviderMetrics());

      expect(result.current.isLoading).toBe(true);
    });

    it("should handle no authenticated user", () => {
      mockUseCachedAuth.mockReturnValue({
        user: null,
        loading: false,
        error: null,
        signOut: jest.fn(),
        signInWithGoogle: jest.fn(),
        signInWithEmail: jest.fn(),
        signUpWithEmail: jest.fn(),
        updateUserProfile: jest.fn(),
        sendPasswordReset: jest.fn(),
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useProviderMetrics());

      expect(result.current.currentSession).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("weekly metrics calculation", () => {
    it("should calculate metrics for multiple completed sessions", async () => {
      const sessions = [
        {
          ...mockCompletedSession,
          id: "session-1",
          durationMinutes: 120,
          locationId: "loc-1",
        },
        {
          ...mockCompletedSession,
          id: "session-2",
          durationMinutes: 90,
          locationId: "loc-2",
        },
        {
          ...mockCompletedSession,
          id: "session-3",
          durationMinutes: 60,
          locationId: "loc-1",
        },
      ];

      mockCachedSessionService.getUserWeeklySessions.mockResolvedValue(
        sessions
      );

      const { result } = renderHook(() => useProviderMetrics());

      // Wait for async operations to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.weeklyMetrics.weeklySessionsCount).toBe(3);
      expect(result.current.weeklyMetrics.weeklyTotalHours).toBe(4.5); // (120+90+60)/60
      expect(result.current.weeklyMetrics.locationsVisited).toBe(2); // loc-1, loc-2
      expect(result.current.weeklyMetrics.averageSessionDuration).toBe(90); // (120+90+60)/3
      expect(result.current.weeklyMetrics.longestSessionDuration).toBe(120);
      expect(result.current.weeklyMetrics.shortestSessionDuration).toBe(60);
    });

    it("should handle mixed session statuses for completion rate", async () => {
      const sessions = [
        {
          ...mockCompletedSession,
          id: "session-1",
          status: "completed" as const,
        },
        { ...mockSession, id: "session-2", status: "active" as const },
        { ...mockSession, id: "session-3", status: "incomplete" as const },
      ];

      mockCachedSessionService.getUserWeeklySessions.mockResolvedValue(
        sessions
      );

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.weeklyMetrics.completionRate).toBeCloseTo(33.33, 1); // 1/3 = 33.33%
      expect(result.current.weeklyMetrics.totalSessionsThisWeek).toBe(3);
    });

    it("should identify most visited location", async () => {
      const sessions = [
        { ...mockCompletedSession, id: "session-1", locationId: "loc-1" },
        { ...mockCompletedSession, id: "session-2", locationId: "loc-2" },
        { ...mockCompletedSession, id: "session-3", locationId: "loc-1" },
        { ...mockCompletedSession, id: "session-4", locationId: "loc-1" },
      ];

      mockCachedSessionService.getUserWeeklySessions.mockResolvedValue(
        sessions
      );

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.weeklyMetrics.mostVisitedLocation).toBe("loc-1");
    });
  });

  describe("session management", () => {
    it("should start a session successfully", async () => {
      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await result.current.startSession("location-456", "geo", 25);
      });

      expect(mockCachedSessionService.startSession).toHaveBeenCalledWith(
        "test-user-123",
        "location-456",
        "geo",
        25
      );
    });

    it("should end a session successfully", async () => {
      mockCachedSessionService.getCurrentSession.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await result.current.endSession("Session complete");
      });

      expect(mockCachedSessionService.endSession).toHaveBeenCalledWith(
        "session-123",
        "Session complete"
      );
    });

    it("should pause a session successfully", async () => {
      mockCachedSessionService.getCurrentSession.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await result.current.pauseSession();
      });

      expect(mockCachedSessionService.updateSessionStatus).toHaveBeenCalledWith(
        "session-123",
        "paused"
      );
    });

    it("should resume a session successfully", async () => {
      const pausedSession = { ...mockSession, status: "paused" as const };
      mockCachedSessionService.getCurrentSession.mockResolvedValue(
        pausedSession
      );

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await result.current.resumeSession();
      });

      expect(mockCachedSessionService.updateSessionStatus).toHaveBeenCalledWith(
        "session-123",
        "active"
      );
    });
  });

  describe("session state helpers", () => {
    it("should correctly identify active session", async () => {
      mockCachedSessionService.getCurrentSession.mockResolvedValue(mockSession);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isSessionActive).toBe(true);
      expect(result.current.canStartSession).toBe(false);
      expect(result.current.canEndSession).toBe(true);
    });

    it("should correctly identify paused session", async () => {
      const pausedSession = { ...mockSession, status: "paused" as const };
      mockCachedSessionService.getCurrentSession.mockResolvedValue(
        pausedSession
      );

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.canStartSession).toBe(false);
      expect(result.current.canEndSession).toBe(true);
    });

    it("should correctly identify no session state", async () => {
      mockCachedSessionService.getCurrentSession.mockResolvedValue(null);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.canStartSession).toBe(true);
      expect(result.current.canEndSession).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle session service errors", async () => {
      const error = new Error("Session service error");
      mockCachedSessionService.getCurrentSession.mockRejectedValue(error);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.error).toBe("Failed to load session data");
    });

    it("should handle start session errors", async () => {
      const error = new Error("Start session error");
      mockCachedSessionService.startSession.mockRejectedValue(error);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        try {
          await result.current.startSession("location-456");
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe("Failed to start session");
    });

    it("should handle end session errors", async () => {
      mockCachedSessionService.getCurrentSession.mockResolvedValue(mockSession);
      const error = new Error("End session error");
      mockCachedSessionService.endSession.mockRejectedValue(error);

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        try {
          await result.current.endSession();
        } catch (e) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe("Failed to end session");
    });
  });

  describe("refresh functionality", () => {
    it("should refresh data when called", async () => {
      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockCachedSessionService.getCurrentSession).toHaveBeenCalled();
      expect(mockCachedSessionService.getUserWeeklySessions).toHaveBeenCalled();
    });
  });

  describe("session duration tracking", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should track session duration for active sessions", async () => {
      // Start time 30 minutes ago
      const startTime = new Date(Date.now() - 30 * 60 * 1000);
      const activeSession = {
        ...mockSession,
        startTime: Timestamp.fromDate(startTime),
      };

      mockCachedSessionService.getCurrentSession.mockResolvedValue(
        activeSession
      );

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.sessionDuration).toBe(30);

      // Advance time by 1 minute
      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });

      expect(result.current.sessionDuration).toBe(31);
    });

    it("should not track duration for non-active sessions", async () => {
      const pausedSession = { ...mockSession, status: "paused" as const };
      mockCachedSessionService.getCurrentSession.mockResolvedValue(
        pausedSession
      );

      const { result } = renderHook(() => useProviderMetrics());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.sessionDuration).toBe(0);
    });
  });
});
