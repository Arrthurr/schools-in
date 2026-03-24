/**
 * Tests for useNotifications hook
 *
 * Covers snapshot subscription, unread count, markAsRead, markAllAsRead,
 * batching, error handling, and cleanup.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import {
  onSnapshot,
  updateDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { useCachedAuth } from "../useCachedAuth";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../../../../firebase.config", () => ({ db: {} }));

jest.mock("../useCachedAuth", () => ({
  useCachedAuth: jest.fn(),
}));

const mockDocRef = { id: "mock-doc-ref" };

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  doc: jest.fn(() => mockDocRef),
  updateDoc: jest.fn(),
  getDocs: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: { now: jest.fn() },
}));

const mockUseCachedAuth = useCachedAuth as jest.Mock;
const mockOnSnapshot = onSnapshot as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockWriteBatch = writeBatch as jest.Mock;

// Import AFTER mocks
import { useNotifications } from "../useNotifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = { uid: "admin-1", email: "admin@test.com", role: "admin" as const };

function makeNotification(id: string, read: boolean) {
  return {
    id,
    type: "session_note",
    sessionId: "sess-1",
    providerId: "prov-1",
    providerName: "Jane",
    locationName: "Lincoln",
    notePreview: "Test note",
    read,
    createdAt: { seconds: 1742817600 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useNotifications", () => {
  let snapshotCallback: ((snap: any) => void) | null;
  let snapshotErrorCallback: ((err: any) => void) | null;
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    snapshotCallback = null;
    snapshotErrorCallback = null;

    mockOnSnapshot.mockImplementation((_q: any, onNext: any, onError: any) => {
      snapshotCallback = onNext;
      snapshotErrorCallback = onError;
      return mockUnsubscribe;
    });

    mockUpdateDoc.mockResolvedValue(undefined);
    mockUseCachedAuth.mockReturnValue({ user: mockUser, loading: false });
  });

  // ---------- No user -------------------------------------------------------

  it("returns empty notifications when no user", () => {
    mockUseCachedAuth.mockReturnValue({ user: null, loading: false });

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  // ---------- Snapshot subscription -----------------------------------------

  it("populates notifications from snapshot", async () => {
    const { result } = renderHook(() => useNotifications());

    // Fire the snapshot
    act(() => {
      snapshotCallback!({
        docs: [
          { id: "n1", data: () => makeNotification("n1", false) },
          { id: "n2", data: () => makeNotification("n2", true) },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.loading).toBe(false);
    });
  });

  it("derives unreadCount correctly", async () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      snapshotCallback!({
        docs: [
          { id: "n1", data: () => makeNotification("n1", false) },
          { id: "n2", data: () => makeNotification("n2", false) },
          { id: "n3", data: () => makeNotification("n3", true) },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });
  });

  it("sets loading to false on snapshot error", async () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      snapshotErrorCallback!(new Error("Firestore error"));
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  // ---------- Cleanup -------------------------------------------------------

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useNotifications());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it("re-subscribes when user changes", () => {
    const { rerender } = renderHook(() => useNotifications());

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    // User changes
    mockUseCachedAuth.mockReturnValue({
      user: { ...mockUser, uid: "admin-2" },
      loading: false,
    });
    rerender();

    // Should unsubscribe old and subscribe new
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  // ---------- markAsRead ----------------------------------------------------

  it("calls updateDoc with read: true for markAsRead", async () => {
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAsRead("notif-42");
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { read: true });
  });

  it("does nothing on markAsRead when no user", async () => {
    mockUseCachedAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAsRead("notif-42");
    });

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // ---------- markAllAsRead -------------------------------------------------

  it("does nothing on markAllAsRead when no user", async () => {
    mockUseCachedAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("no-ops on markAllAsRead when there are no unread docs", async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it("updates all unread docs via batch", async () => {
    const mockBatchUpdate = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });

    const unreadDocs = [
      { ref: { id: "n1" } },
      { ref: { id: "n2" } },
      { ref: { id: "n3" } },
    ];
    mockGetDocs.mockResolvedValue({ empty: false, docs: unreadDocs });

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockBatchUpdate).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    unreadDocs.forEach((d) => {
      expect(mockBatchUpdate).toHaveBeenCalledWith(d.ref, { read: true });
    });
  });

  it("batches in groups of 500 when there are many unread", async () => {
    const mockBatchUpdate = jest.fn();
    const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    });

    // 501 docs → should require 2 batch commits
    const unreadDocs = Array.from({ length: 501 }, (_, i) => ({
      ref: { id: `n${i}` },
    }));
    mockGetDocs.mockResolvedValue({ empty: false, docs: unreadDocs });

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockWriteBatch).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(501);
  });
});
