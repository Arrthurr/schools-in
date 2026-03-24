/**
 * Tests for note-specific action queue behavior:
 * - queueCheckOut stores notes in payload
 * - queueUpdateNote enqueues UPDATE_NOTE and deduplicates
 * - processQueuedAction routes UPDATE_NOTE correctly
 * - syncUpdateNote calls the Cloud Function
 */

// ---------------------------------------------------------------------------
// Mocks — use `var` so jest.mock's hoisted factory can reference them
// ---------------------------------------------------------------------------

/* eslint-disable no-var */
var mockAdd: jest.Mock;
var mockGet: jest.Mock;
var mockPut: jest.Mock;
var mockGetAll: jest.Mock;
var mockDelete: jest.Mock;
/* eslint-enable no-var */

jest.mock("@/lib/offline/cacheStrategy", () => ({
  initCacheDB: jest.fn(() =>
    Promise.resolve({
      add: (...args: unknown[]) => mockAdd(...args),
      get: (...args: unknown[]) => mockGet(...args),
      put: (...args: unknown[]) => mockPut(...args),
      getAll: (...args: unknown[]) => mockGetAll(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      transaction: jest.fn(() => {
        const store = {
          get: jest.fn().mockResolvedValue(undefined),
          put: jest.fn().mockResolvedValue(undefined),
          delete: jest.fn().mockResolvedValue(undefined),
        };
        return {
          objectStore: jest.fn(() => store),
          done: Promise.resolve(),
        };
      }),
    })
  ),
  CACHE_STORES: {
    PENDING_ACTIONS: "pending_actions",
    LOCKS: "locks",
  },
}));

import {
  queueCheckOut,
  queueUpdateNote,
  processQueuedAction,
  QUEUE_ACTIONS,
  QUEUE_STATUS,
  type QueuedAction,
} from "@/lib/offline/actionQueue";
import { httpsCallable } from "firebase/functions";

jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

jest.mock("../../../../firebase.config", () => ({
  functions: {},
}));

jest.mock("firebase/firestore", () => ({
  Timestamp: { fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })) },
}));

jest.mock("@/lib/utils/time", () => ({
  getDayKey: jest.fn(() => "2026-03-24"),
}));

const mockHttpsCallable = httpsCallable as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAction(overrides: Partial<QueuedAction>): QueuedAction {
  return {
    id: "action_1",
    type: QUEUE_ACTIONS.CHECK_IN,
    payload: {},
    timestamp: Date.now(),
    status: QUEUE_STATUS.PENDING,
    retryCount: 0,
    maxRetries: 3,
    userId: "user-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockAdd = jest.fn().mockResolvedValue(undefined);
  mockGet = jest.fn();
  mockPut = jest.fn().mockResolvedValue(undefined);
  mockGetAll = jest.fn().mockResolvedValue([]);
  mockDelete = jest.fn().mockResolvedValue(undefined);
});

describe("queueCheckOut — notes handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  });

  it("stores notes in payload when provided", async () => {
    await queueCheckOut("sess-1", "user-1", { latitude: 0, longitude: 0 }, "My checkout note");

    expect(mockAdd).toHaveBeenCalledTimes(1);
    const queued = mockAdd.mock.calls[0][1] as QueuedAction;
    expect(queued.type).toBe(QUEUE_ACTIONS.CHECK_OUT);
    expect(queued.payload.notes).toBe("My checkout note");
  });

  it("omits notes from payload when not provided", async () => {
    await queueCheckOut("sess-1", "user-1", { latitude: 0, longitude: 0 });

    const queued = mockAdd.mock.calls[0][1] as QueuedAction;
    expect(queued.payload.notes).toBeUndefined();
  });
});

describe("queueUpdateNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mockGetAll.mockResolvedValue([]);
  });

  it("enqueues an UPDATE_NOTE action", async () => {
    const id = await queueUpdateNote("sess-1", "user-1", "Hello");

    expect(id).toBeDefined();
    const queued = mockAdd.mock.calls[0][1] as QueuedAction;
    expect(queued.type).toBe(QUEUE_ACTIONS.UPDATE_NOTE);
    expect(queued.payload.sessionId).toBe("sess-1");
    expect(queued.payload.notes).toBe("Hello");
    expect(queued.sessionId).toBe("sess-1");
  });

  it("cancels prior pending UPDATE_NOTE for the same sessionId", async () => {
    const existingAction = makeAction({
      id: "old-note-action",
      type: QUEUE_ACTIONS.UPDATE_NOTE,
      status: QUEUE_STATUS.PENDING,
      userId: "user-1",
      payload: { sessionId: "sess-1", notes: "Old note" },
    });

    // getPendingActions reads from getAll
    mockGetAll.mockResolvedValue([existingAction]);
    // updateActionStatus reads via get then put
    mockGet.mockResolvedValue({ ...existingAction });

    await queueUpdateNote("sess-1", "user-1", "New note");

    // Should have called put to cancel the old action
    expect(mockPut).toHaveBeenCalledWith(
      "pending_actions",
      expect.objectContaining({ id: "old-note-action", status: QUEUE_STATUS.CANCELLED })
    );
    // And queued the new one
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it("does not cancel note actions for other sessions", async () => {
    const otherAction = makeAction({
      id: "other-note",
      type: QUEUE_ACTIONS.UPDATE_NOTE,
      status: QUEUE_STATUS.PENDING,
      userId: "user-1",
      payload: { sessionId: "sess-OTHER", notes: "Different session" },
    });

    mockGetAll.mockResolvedValue([otherAction]);

    await queueUpdateNote("sess-1", "user-1", "New note");

    // Should NOT cancel the other session's note
    expect(mockPut).not.toHaveBeenCalledWith(
      "pending_actions",
      expect.objectContaining({ id: "other-note" })
    );
  });

  it("still queues even if dedup lookup fails", async () => {
    mockGetAll.mockRejectedValue(new Error("DB error"));

    const id = await queueUpdateNote("sess-1", "user-1", "Note after error");
    expect(id).toBeDefined();
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });
});

describe("processQueuedAction — UPDATE_NOTE routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(undefined);
  });

  it("calls updateSessionNote Cloud Function for UPDATE_NOTE actions", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const action = makeAction({
      type: QUEUE_ACTIONS.UPDATE_NOTE,
      sessionId: "sess-1",
      payload: { sessionId: "sess-1", notes: "Synced note" },
    });

    // processQueuedAction calls updateActionStatus which needs get/put
    mockGet.mockResolvedValue({ ...action });

    const result = await processQueuedAction(action);

    expect(result).toBe(true);
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "updateSessionNote");
    expect(mockCallable).toHaveBeenCalledWith({
      sessionId: "sess-1",
      notes: "Synced note",
    });
  });

  it("returns false when Cloud Function returns failure", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: false } });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const action = makeAction({
      type: QUEUE_ACTIONS.UPDATE_NOTE,
      sessionId: "sess-1",
      payload: { sessionId: "sess-1", notes: "Will fail" },
    });
    mockGet.mockResolvedValue({ ...action });

    const result = await processQueuedAction(action);

    expect(result).toBe(false);
  });

  it("returns false when Cloud Function throws", async () => {
    const mockCallable = jest.fn().mockRejectedValue(new Error("Network error"));
    mockHttpsCallable.mockReturnValue(mockCallable);

    const action = makeAction({
      type: QUEUE_ACTIONS.UPDATE_NOTE,
      sessionId: "sess-1",
      payload: { sessionId: "sess-1", notes: "Will throw" },
    });
    mockGet.mockResolvedValue({ ...action });

    const result = await processQueuedAction(action);

    expect(result).toBe(false);
  });

  it("returns false when sessionId is missing from UPDATE_NOTE action", async () => {
    const mockCallable = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallable);

    const action = makeAction({
      type: QUEUE_ACTIONS.UPDATE_NOTE,
      sessionId: undefined,
      payload: { notes: "No session ID" },
    });
    mockGet.mockResolvedValue({ ...action });

    const result = await processQueuedAction(action);

    expect(result).toBe(false);
    expect(mockCallable).not.toHaveBeenCalled();
  });
});

describe("syncCheckOut — notes propagation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue(undefined);
  });

  it("includes notes in endSession payload when present", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const action = makeAction({
      type: QUEUE_ACTIONS.CHECK_OUT,
      sessionId: "sess-1",
      payload: {
        sessionId: "sess-1",
        notes: "Checkout note",
        location: { latitude: 1, longitude: 2, accuracy: 5, timestamp: 1000 },
      },
    });
    mockGet.mockResolvedValue({ ...action });

    await processQueuedAction(action);

    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Checkout note" })
    );
  });

  it("omits notes from endSession payload when not present", async () => {
    const mockCallable = jest.fn().mockResolvedValue({ data: { success: true } });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const action = makeAction({
      type: QUEUE_ACTIONS.CHECK_OUT,
      sessionId: "sess-1",
      payload: {
        sessionId: "sess-1",
        location: { latitude: 1, longitude: 2, accuracy: 5, timestamp: 1000 },
      },
    });
    mockGet.mockResolvedValue({ ...action });

    await processQueuedAction(action);

    const callArgs = mockCallable.mock.calls[0][0];
    expect(callArgs.notes).toBeUndefined();
  });
});
