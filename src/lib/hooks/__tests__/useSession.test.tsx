/**
 * Unit tests for useSession hook
 *
 * Tests the core check-in/out flow:
 * - Initial state and auth-gated behavior
 * - Check-in via Firebase callable function
 * - Check-out via Firebase callable function
 * - Offline queue fallback on errors
 * - Session loading and state management
 * - Real-time Firestore subscription
 * - Error handling and clearError
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useSession } from "../useSession";
import { useAuth } from "../useAuth";
import { httpsCallable } from "firebase/functions";
import { onSnapshot } from "firebase/firestore";
import { getSessionsByUser } from "../../firebase/firestore";
import { queueManager } from "../../offline/queueManager";

// Mock dependencies
jest.mock("../useAuth");
jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));
jest.mock("../../firebase/firestore", () => ({
  getSessionsByUser: jest.fn(),
  COLLECTIONS: { SESSIONS: "sessions" },
}));
jest.mock("../../offline/queueManager", () => ({
  queueManager: {
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    updateNote: jest.fn(),
  },
}));
jest.mock("../../../../firebase.config", () => ({
  db: {},
  functions: {},
}));
jest.mock("../../utils/time", () => ({
  getDayKey: jest.fn(() => "2026-02-08"),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockHttpsCallable = httpsCallable as jest.Mock;
const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;
const mockGetSessionsByUser = getSessionsByUser as jest.MockedFunction<
  typeof getSessionsByUser
>;
const mockQueueManager = queueManager as jest.Mocked<typeof queueManager>;

describe("useSession", () => {
  const mockUser = {
    uid: "user-123",
    email: "test@example.com",
    role: "provider" as const,
  };

  const mockLocation = {
    latitude: 34.0522,
    longitude: -118.2437,
    accuracy: 10,
  };

  let mockStartSessionFn: jest.Mock;
  let mockEndSessionFn: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStartSessionFn = jest.fn();
    mockEndSessionFn = jest.fn();

    mockHttpsCallable.mockImplementation((_functions, name) => {
      if (name === "startSession") return mockStartSessionFn;
      if (name === "endSession") return mockEndSessionFn;
      return jest.fn();
    });

    // Default: no user
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);

    // Default: no sessions
    mockGetSessionsByUser.mockResolvedValue({
      sessions: [],
      total: 0,
      hasMore: false,
    });

    // Default: onSnapshot returns unsubscribe
    mockOnSnapshot.mockReturnValue(jest.fn());
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  it("initializes with default state when no user", () => {
    const { result } = renderHook(() => useSession());

    expect(result.current.currentSession).toBeNull();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.totalSessions).toBe(0);
    expect(result.current.hasMore).toBe(false);
  });

  it("loads sessions when user is present", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockGetSessionsByUser.mockResolvedValue({
      sessions: [
        { id: "s1", status: "completed", userId: "user-123" },
      ] as any,
      total: 1,
      hasMore: false,
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.totalSessions).toBe(1);
    });
  });

  it("sets active session when found in loaded sessions", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockGetSessionsByUser.mockResolvedValue({
      sessions: [
        { id: "active-1", status: "active", userId: "user-123" },
        { id: "completed-1", status: "completed", userId: "user-123" },
      ] as any,
      total: 2,
      hasMore: false,
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.currentSession?.id).toBe("active-1");
    });
  });

  // ---------------------------------------------------------------------------
  // Check-in
  // ---------------------------------------------------------------------------

  it("performs check-in successfully", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    mockStartSessionFn.mockResolvedValue({
      data: { success: true, sessionId: "new-session-1" },
    });

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkIn("school-1", mockLocation);
    });

    expect(mockStartSessionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: "school-1",
        checkInMethod: "geo",
        checkInLocation: {
          latitude: 34.0522,
          longitude: -118.2437,
          accuracy: 10,
        },
      })
    );
    expect(result.current.currentSession).not.toBeNull();
    expect(result.current.currentSession?.id).toBe("new-session-1");
    expect(result.current.error).toBeNull();
  });

  it("passes distance from center to check-in", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    mockStartSessionFn.mockResolvedValue({
      data: { success: true, sessionId: "new-session-2" },
    });

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkIn("school-1", mockLocation, 150);
    });

    expect(mockStartSessionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceFromCenterAtCheckIn: 150,
      })
    );
  });

  it("sets error when check-in attempted without user", async () => {
    // No user
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkIn("school-1", mockLocation);
    });

    expect(result.current.error).toBe(
      "User must be authenticated to check in"
    );
    expect(mockStartSessionFn).not.toHaveBeenCalled();
  });

  it("prevents check-in when session already active", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    // Pre-load an active session
    mockGetSessionsByUser.mockResolvedValue({
      sessions: [
        { id: "existing-session", status: "active", userId: "user-123" },
      ] as any,
      total: 1,
      hasMore: false,
    });

    const { result } = renderHook(() => useSession());

    // Wait for sessions to load and active session to be set
    await waitFor(() => {
      expect(result.current.currentSession?.id).toBe("existing-session");
    });

    await act(async () => {
      await result.current.checkIn("school-1", mockLocation);
    });

    expect(result.current.error).toBe(
      "You already have an active session. Please check out first."
    );
    expect(mockStartSessionFn).not.toHaveBeenCalled();
  });

  it("falls back to offline queue on check-in failure", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    mockStartSessionFn.mockRejectedValue(new Error("Network error"));
    mockQueueManager.checkIn.mockResolvedValue({
      offline: true,
      success: true,
    } as any);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkIn("school-1", mockLocation);
    });

    expect(mockQueueManager.checkIn).toHaveBeenCalledWith(
      "school-1",
      "user-123",
      { latitude: 34.0522, longitude: -118.2437, accuracy: 10 },
      undefined
    );
    expect(result.current.error).toBe("Offline: check-in queued for sync");
  });

  // ---------------------------------------------------------------------------
  // Check-out
  // ---------------------------------------------------------------------------

  it("performs check-out successfully", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    mockEndSessionFn.mockResolvedValue({
      data: { success: true, sessionId: "session-1" },
    });

    // Pre-load a session in the list
    mockGetSessionsByUser.mockResolvedValue({
      sessions: [
        { id: "session-1", status: "active", userId: "user-123" },
      ] as any,
      total: 1,
      hasMore: false,
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.currentSession?.id).toBe("session-1");
    });

    await act(async () => {
      await result.current.checkOut("session-1", mockLocation);
    });

    expect(mockEndSessionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        checkOutLocation: {
          latitude: 34.0522,
          longitude: -118.2437,
          accuracy: 10,
        },
      })
    );
    expect(result.current.currentSession).toBeNull();
  });

  it("marks session as completed after check-out", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    mockEndSessionFn.mockResolvedValue({
      data: { success: true, sessionId: "session-1" },
    });

    mockGetSessionsByUser.mockResolvedValue({
      sessions: [
        { id: "session-1", status: "active", userId: "user-123" },
      ] as any,
      total: 1,
      hasMore: false,
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    await act(async () => {
      await result.current.checkOut("session-1", mockLocation);
    });

    expect(result.current.sessions[0].status).toBe("completed");
  });

  it("falls back to offline queue on check-out failure", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    mockEndSessionFn.mockRejectedValue(new Error("Network error"));
    mockQueueManager.checkOut.mockResolvedValue({
      offline: true,
      success: true,
    } as any);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkOut("session-1", mockLocation);
    });

    expect(mockQueueManager.checkOut).toHaveBeenCalledWith(
      "session-1",
      "user-123",
      { latitude: 34.0522, longitude: -118.2437, accuracy: 10 },
      undefined
    );
    expect(result.current.error).toBe("Offline: check-out queued for sync");
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it("clears error with clearError", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);

    const { result } = renderHook(() => useSession());

    // Trigger an error
    await act(async () => {
      await result.current.checkIn("school-1", mockLocation);
    });
    expect(result.current.error).not.toBeNull();

    // Clear it
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("handles loadSessions error gracefully", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockGetSessionsByUser.mockRejectedValue(new Error("Firestore error"));

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.error).toBe("Firestore error");
    });
  });

  it("sets error when loadSessions called without user ID", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.error).toBe(
      "No user ID provided for loading sessions"
    );
  });

  // ---------------------------------------------------------------------------
  // Loading states
  // ---------------------------------------------------------------------------

  it("sets loading during check-in", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);

    let resolveCheckIn: (value: any) => void;
    mockStartSessionFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckIn = resolve;
        })
    );

    const { result } = renderHook(() => useSession());

    let checkInPromise: Promise<void>;
    act(() => {
      checkInPromise = result.current.checkIn("school-1", mockLocation);
    });

    // Should be loading while the callable is pending
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveCheckIn!({
        data: { success: true, sessionId: "new-session" },
      });
      await checkInPromise!;
    });

    expect(result.current.loading).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Real-time subscription
  // ---------------------------------------------------------------------------

  it("subscribes to active sessions via onSnapshot when user present", () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    const mockUnsubscribe = jest.fn();
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useSession());

    expect(mockOnSnapshot).toHaveBeenCalled();

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("clears current session when user logs out", async () => {
    // Start with user
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockGetSessionsByUser.mockResolvedValue({
      sessions: [
        { id: "s1", status: "active", userId: "user-123" },
      ] as any,
      total: 1,
      hasMore: false,
    });

    const { result, rerender } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.currentSession?.id).toBe("s1");
    });

    // User logs out
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);
    rerender();

    await waitFor(() => {
      expect(result.current.currentSession).toBeNull();
      expect(result.current.sessions).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // updateNote
  // ---------------------------------------------------------------------------

  it("calls queueManager.updateNote and returns true on success", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockQueueManager.updateNote.mockResolvedValue({
      success: true,
      offline: false,
    });

    const { result } = renderHook(() => useSession());

    let success: boolean;
    await act(async () => {
      success = await result.current.updateNote("sess-1", "My note");
    });

    expect(success!).toBe(true);
    expect(mockQueueManager.updateNote).toHaveBeenCalledWith(
      "sess-1",
      "user-123",
      "My note"
    );
    expect(result.current.error).toBeNull();
  });

  it("returns false and sets error when user is missing", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as any);

    const { result } = renderHook(() => useSession());

    let success: boolean;
    await act(async () => {
      success = await result.current.updateNote("sess-1", "No user");
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe(
      "User must be authenticated to update notes"
    );
    expect(mockQueueManager.updateNote).not.toHaveBeenCalled();
  });

  it("sets offline message when updateNote returns offline result", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockQueueManager.updateNote.mockResolvedValue({
      success: true,
      offline: true,
    });

    const { result } = renderHook(() => useSession());

    let success: boolean;
    await act(async () => {
      success = await result.current.updateNote("sess-1", "Offline note");
    });

    expect(success!).toBe(true);
    expect(result.current.error).toBe(
      "Offline: note will sync when connected"
    );
  });

  it("returns false and sets error when queueManager throws", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockQueueManager.updateNote.mockRejectedValue(
      new Error("Queue exploded")
    );

    const { result } = renderHook(() => useSession());

    let success: boolean;
    await act(async () => {
      success = await result.current.updateNote("sess-1", "Will fail");
    });

    expect(success!).toBe(false);
    expect(result.current.error).toBe("Queue exploded");
  });

  // ---------------------------------------------------------------------------
  // checkOut with notes
  // ---------------------------------------------------------------------------

  it("passes notes to endSession callable when provided", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockEndSessionFn.mockResolvedValue({
      data: { success: true },
    });

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkOut("sess-1", mockLocation, "Checkout note");
    });

    expect(mockEndSessionFn).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Checkout note" })
    );
  });

  it("omits notes from endSession when undefined", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockEndSessionFn.mockResolvedValue({
      data: { success: true },
    });

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkOut("sess-1", mockLocation);
    });

    const callArgs = mockEndSessionFn.mock.calls[0][0];
    expect(callArgs.notes).toBeUndefined();
  });

  it("passes notes to queueManager.checkOut on offline fallback", async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false } as any);
    mockEndSessionFn.mockRejectedValue(new Error("Network error"));
    mockQueueManager.checkOut.mockResolvedValue({
      offline: true,
      success: true,
    } as any);

    const { result } = renderHook(() => useSession());

    await act(async () => {
      await result.current.checkOut("sess-1", mockLocation, "Offline note");
    });

    expect(mockQueueManager.checkOut).toHaveBeenCalledWith(
      "sess-1",
      "user-123",
      { latitude: 34.0522, longitude: -118.2437, accuracy: 10 },
      "Offline note"
    );
  });
});
