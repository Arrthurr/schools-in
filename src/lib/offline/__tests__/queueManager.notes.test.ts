/**
 * Tests for QueueManager.updateNote() and checkOut-with-notes behavior.
 *
 * Covers online success, offline fallback, online→offline fallback,
 * and queue failure paths.
 */

import QueueManager from "@/lib/offline/queueManager";

jest.mock("@/lib/offline/actionQueue", () => ({
  initActionQueue: jest.fn(),
  queueCheckIn: jest.fn(),
  queueCheckOut: jest.fn(),
  queueUpdateNote: jest.fn(),
  processQueue: jest.fn(),
  getPendingActions: jest.fn(),
  getQueueStats: jest.fn(),
  removeCompletedActions: jest.fn(),
  QUEUE_CONFIG: {
    SYNC_INTERVAL: 30000,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000,
  },
}));

const actionQueueMocks = jest.requireMock("@/lib/offline/actionQueue") as jest.Mocked<
  typeof import("@/lib/offline/actionQueue")
>;

jest.mock("@/lib/offline/syncManager", () => ({
  syncManager: {
    sync: jest.fn(),
    getSyncRecommendations: jest.fn().mockReturnValue({ shouldSync: true, reason: "test" }),
  },
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  Timestamp: { fromDate: jest.fn(), now: jest.fn() },
}));

jest.mock("../../../../firebase.config", () => ({
  functions: {},
}));

jest.mock("@/lib/utils/time", () => ({
  getDayKey: jest.fn(() => "2026-03-24"),
}));

const { httpsCallable } = jest.requireMock("firebase/functions");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const setNavigatorOnline = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
};

const createManager = (): QueueManager => {
  const manager = new QueueManager({
    enableAutoSync: false,
    enableBackgroundSync: false,
    enableIntelligentSync: false,
  });
  (manager as unknown as { isInitialized: boolean }).isInitialized = true;
  return manager;
};

const mockLocation = { latitude: 40.7128, longitude: -74.006, accuracy: 10 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("QueueManager.updateNote()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNavigatorOnline(true);
    actionQueueMocks.queueUpdateNote.mockResolvedValue("note-action-123");
  });

  it("calls Cloud Function and returns success when online", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
    httpsCallable.mockReturnValue(mockCallable);

    const manager = createManager();
    const result = await manager.updateNote("sess-1", "user-1", "My note");

    expect(result).toEqual({ success: true, offline: false });
    expect(mockCallable).toHaveBeenCalledWith({ sessionId: "sess-1", notes: "My note" });
    expect(actionQueueMocks.queueUpdateNote).not.toHaveBeenCalled();
  });

  it("queues note when offline", async () => {
    setNavigatorOnline(false);

    const manager = createManager();
    const result = await manager.updateNote("sess-1", "user-1", "Offline note");

    expect(result).toEqual({ success: true, actionId: "note-action-123", offline: true });
    expect(actionQueueMocks.queueUpdateNote).toHaveBeenCalledWith("sess-1", "user-1", "Offline note");
  });

  it("falls back to queue when Cloud Function fails", async () => {
    const mockCallable = jest.fn().mockRejectedValue(new Error("Firebase error"));
    httpsCallable.mockReturnValue(mockCallable);

    const manager = createManager();
    const result = await manager.updateNote("sess-1", "user-1", "Fallback note");

    expect(result).toEqual({ success: true, actionId: "note-action-123", offline: true });
    expect(actionQueueMocks.queueUpdateNote).toHaveBeenCalled();
  });

  it("falls back to queue when Cloud Function returns failure", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: false } });
    httpsCallable.mockReturnValue(mockCallable);

    const manager = createManager();
    const result = await manager.updateNote("sess-1", "user-1", "Failed note");

    expect(result).toEqual({ success: true, actionId: "note-action-123", offline: true });
    expect(actionQueueMocks.queueUpdateNote).toHaveBeenCalled();
  });

  it("returns failure when queueing fails", async () => {
    setNavigatorOnline(false);
    actionQueueMocks.queueUpdateNote.mockRejectedValue(new Error("Queue error"));

    const manager = createManager();
    const result = await manager.updateNote("sess-1", "user-1", "Will fail");

    expect(result).toEqual({ success: false });
  });

  it("throws when manager is not initialized", async () => {
    const manager = new QueueManager({
      enableAutoSync: false,
      enableBackgroundSync: false,
      enableIntelligentSync: false,
    });
    // Do NOT set isInitialized

    await expect(manager.updateNote("sess-1", "user-1", "Not init"))
      .rejects.toThrow("QueueManager not initialized");
  });
});

describe("QueueManager.checkOut() — notes propagation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNavigatorOnline(true);
    actionQueueMocks.queueCheckOut.mockResolvedValue("checkout-action-123");
  });

  it("passes notes to endSession Cloud Function when online", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
    httpsCallable.mockReturnValue(mockCallable);

    const manager = createManager();
    await manager.checkOut("sess-1", "user-1", mockLocation, "Checkout note");

    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Checkout note" })
    );
  });

  it("omits notes from endSession payload when undefined", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
    httpsCallable.mockReturnValue(mockCallable);

    const manager = createManager();
    await manager.checkOut("sess-1", "user-1", mockLocation);

    const callArgs = mockCallable.mock.calls[0][0];
    expect(callArgs.notes).toBeUndefined();
  });

  it("passes notes to queueCheckOut when offline", async () => {
    setNavigatorOnline(false);

    const manager = createManager();
    await manager.checkOut("sess-1", "user-1", mockLocation, "Offline checkout note");

    expect(actionQueueMocks.queueCheckOut).toHaveBeenCalledWith(
      "sess-1",
      "user-1",
      mockLocation,
      "Offline checkout note"
    );
  });

  it("passes notes to queueCheckOut on online failure fallback", async () => {
    const mockCallable = jest.fn().mockRejectedValue(new Error("Network error"));
    httpsCallable.mockReturnValue(mockCallable);

    const manager = createManager();
    await manager.checkOut("sess-1", "user-1", mockLocation, "Fallback checkout note");

    expect(actionQueueMocks.queueCheckOut).toHaveBeenCalledWith(
      "sess-1",
      "user-1",
      mockLocation,
      "Fallback checkout note"
    );
  });
});
