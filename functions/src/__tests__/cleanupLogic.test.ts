/**
 * Unit tests for cleanup logic functions
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
  isRecentlyCreated,
  calculateStaleDuration,
  filterSessionsForCleanup,
  needsTimeoutWarning,
  type StaleSessionData,
} from "../cleanupLogic";
import { RECENTLY_CREATED_GRACE_MS, SESSION_LIMIT_MS } from "../utils";

const minutesToMs = (min: number) => min * 60 * 1000;

function makeTimestamp(ms: number): { toMillis: () => number } {
  return { toMillis: () => ms };
}

// ============================================================================
// isRecentlyCreated
// ============================================================================

describe("isRecentlyCreated", () => {
  test("session created 5 minutes ago is recently created", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      createdAt: makeTimestamp(now - minutesToMs(5)),
    };
    expect(isRecentlyCreated(session, now)).toBe(true);
  });

  test("session created 20 minutes ago is not recently created", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      createdAt: makeTimestamp(now - minutesToMs(20)),
    };
    expect(isRecentlyCreated(session, now)).toBe(false);
  });

  test("session at exact grace boundary is not recently created", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      createdAt: makeTimestamp(now - RECENTLY_CREATED_GRACE_MS),
    };
    expect(isRecentlyCreated(session, now)).toBe(false);
  });

  test("session 1ms before grace boundary is recently created", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      createdAt: makeTimestamp(now - RECENTLY_CREATED_GRACE_MS + 1),
    };
    expect(isRecentlyCreated(session, now)).toBe(true);
  });

  test("uses updatedAt when createdAt is missing", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      updatedAt: makeTimestamp(now - minutesToMs(5)),
    };
    expect(isRecentlyCreated(session, now)).toBe(true);
  });

  test("uses updatedAt when createdAt is missing and session is old", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      updatedAt: makeTimestamp(now - minutesToMs(20)),
    };
    expect(isRecentlyCreated(session, now)).toBe(false);
  });

  test("session with no timestamps is not recently created", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
    };
    // createdAt=0, age = now - 0 = very large, not recently created
    expect(isRecentlyCreated(session, now)).toBe(false);
  });
});

// ============================================================================
// calculateStaleDuration
// ============================================================================

describe("calculateStaleDuration", () => {
  test("calculates duration from startTime", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(120)),
    };
    expect(calculateStaleDuration(session, now, 540)).toBe(120);
  });

  test("calculates duration from checkInTime when no startTime", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      checkInTime: makeTimestamp(now - minutesToMs(60)),
    };
    expect(calculateStaleDuration(session, now, 540)).toBe(60);
  });

  test("prefers startTime over checkInTime", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(120)),
      checkInTime: makeTimestamp(now - minutesToMs(60)),
    };
    expect(calculateStaleDuration(session, now, 540)).toBe(120);
  });

  test("uses fallback when no start time", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
    };
    expect(calculateStaleDuration(session, now, 540)).toBe(540);
  });

  test("floors partial minutes", () => {
    const now = Date.now();
    // 90.5 minutes ago
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(90) - 30000),
    };
    expect(calculateStaleDuration(session, now, 540)).toBe(90);
  });
});

// ============================================================================
// filterSessionsForCleanup
// ============================================================================

describe("filterSessionsForCleanup", () => {
  test("mix of recent and old sessions", () => {
    const now = Date.now();
    const sessions: StaleSessionData[] = [
      {
        id: "recent-1",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(5)),
        startTime: makeTimestamp(now - minutesToMs(600)),
      },
      {
        id: "old-1",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(600)),
        startTime: makeTimestamp(now - minutesToMs(600)),
      },
      {
        id: "old-2",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(700)),
        startTime: makeTimestamp(now - minutesToMs(700)),
      },
    ];

    const result = filterSessionsForCleanup(sessions, now);
    expect(result.toCleanup).toHaveLength(2);
    expect(result.skippedCount).toBe(1);
    expect(result.toCleanup[0].sessionId).toBe("old-1");
    expect(result.toCleanup[1].sessionId).toBe("old-2");
  });

  test("all recently created returns empty cleanup list", () => {
    const now = Date.now();
    const sessions: StaleSessionData[] = [
      {
        id: "recent-1",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(3)),
      },
      {
        id: "recent-2",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(10)),
      },
    ];

    const result = filterSessionsForCleanup(sessions, now);
    expect(result.toCleanup).toHaveLength(0);
    expect(result.skippedCount).toBe(2);
  });

  test("all stale sessions go to cleanup list", () => {
    const now = Date.now();
    const sessions: StaleSessionData[] = [
      {
        id: "stale-1",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(600)),
        startTime: makeTimestamp(now - minutesToMs(600)),
      },
      {
        id: "stale-2",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(700)),
        startTime: makeTimestamp(now - minutesToMs(700)),
      },
    ];

    const result = filterSessionsForCleanup(sessions, now);
    expect(result.toCleanup).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
  });

  test("cleanup results include correct duration", () => {
    const now = Date.now();
    const sessions: StaleSessionData[] = [
      {
        id: "stale-1",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(600)),
        startTime: makeTimestamp(now - minutesToMs(600)),
      },
    ];

    const result = filterSessionsForCleanup(sessions, now);
    expect(result.toCleanup[0].actualDurationMinutes).toBe(600);
  });

  test("empty sessions array returns empty results", () => {
    const result = filterSessionsForCleanup([], Date.now());
    expect(result.toCleanup).toHaveLength(0);
    expect(result.skippedCount).toBe(0);
  });

  test("sessions without start time use fallback duration", () => {
    const now = Date.now();
    const sessions: StaleSessionData[] = [
      {
        id: "no-start",
        status: "active",
        createdAt: makeTimestamp(now - minutesToMs(600)),
      },
    ];

    const result = filterSessionsForCleanup(sessions, now);
    const expectedFallback = Math.floor(SESSION_LIMIT_MS / 60000);
    expect(result.toCleanup[0].actualDurationMinutes).toBe(expectedFallback);
  });
});

// ============================================================================
// needsTimeoutWarning
// ============================================================================

describe("needsTimeoutWarning", () => {
  test("session at 510 minutes returns true", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(510)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(true);
  });

  test("session at 530 minutes returns true", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(530)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(true);
  });

  test("session at 500 minutes returns false (too early)", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(500)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(false);
  });

  test("session at 545 minutes returns false (past window)", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(545)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(false);
  });

  test("already warned session returns false", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(520)),
      warningNotificationSent: true,
    };
    expect(needsTimeoutWarning(session, now)).toBe(false);
  });

  test("session with no start time returns false", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
    };
    expect(needsTimeoutWarning(session, now)).toBe(false);
  });

  test("uses checkInTime when startTime is missing", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      checkInTime: makeTimestamp(now - minutesToMs(515)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(true);
  });

  test("session at exactly 540 minutes returns false (boundary)", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(540)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(false);
  });

  test("session at exactly 510 minutes returns true (boundary)", () => {
    const now = Date.now();
    const session: StaleSessionData = {
      id: "sess-1",
      status: "active",
      startTime: makeTimestamp(now - minutesToMs(510)),
    };
    expect(needsTimeoutWarning(session, now)).toBe(true);
  });
});
