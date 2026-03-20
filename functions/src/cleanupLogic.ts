import { RECENTLY_CREATED_GRACE_MS, SESSION_LIMIT_MS } from "./utils";

export interface StaleSessionData {
  id: string;
  status: string;
  active?: boolean;
  startTime?: { toMillis: () => number };
  checkInTime?: { toMillis: () => number };
  createdAt?: { toMillis: () => number };
  updatedAt?: { toMillis: () => number };
  warningNotificationSent?: boolean;
}

export interface CleanupResult {
  sessionId: string;
  actualDurationMinutes: number;
}

/**
 * Determine if a session should be skipped because it was recently created
 * (offline-sync grace period)
 */
export function isRecentlyCreated(session: StaleSessionData, nowMs: number): boolean {
  const createdAt = session.createdAt?.toMillis?.() || session.updatedAt?.toMillis?.() || 0;
  const sessionAge = nowMs - createdAt;
  return sessionAge < RECENTLY_CREATED_GRACE_MS;
}

/**
 * Calculate actual duration of a stale session in minutes
 */
export function calculateStaleDuration(
  session: StaleSessionData,
  nowMs: number,
  fallbackDurationMinutes: number
): number {
  const sessionStart = session.startTime?.toMillis?.() || session.checkInTime?.toMillis?.() || 0;
  if (sessionStart > 0) {
    return Math.floor((nowMs - sessionStart) / 60000);
  }
  return fallbackDurationMinutes;
}

/**
 * Filter sessions for cleanup: skip recently created, return those eligible for termination
 */
export function filterSessionsForCleanup(
  sessions: StaleSessionData[],
  nowMs: number
): { toCleanup: CleanupResult[]; skippedCount: number } {
  const durationMinutes = Math.floor(SESSION_LIMIT_MS / 60000);
  const toCleanup: CleanupResult[] = [];
  let skippedCount = 0;

  for (const session of sessions) {
    if (isRecentlyCreated(session, nowMs)) {
      skippedCount++;
      continue;
    }

    const actualDurationMinutes = calculateStaleDuration(session, nowMs, durationMinutes);
    toCleanup.push({
      sessionId: session.id,
      actualDurationMinutes,
    });
  }

  return { toCleanup, skippedCount };
}

/**
 * Determine if a session is approaching timeout (510-540 min window)
 * and hasn't already been warned
 */
export function needsTimeoutWarning(session: StaleSessionData, nowMs: number): boolean {
  if (session.warningNotificationSent) return false;

  const sessionStart = session.startTime?.toMillis?.() || session.checkInTime?.toMillis?.() || 0;
  if (sessionStart === 0) return false;

  const elapsedMs = nowMs - sessionStart;
  const elapsedMinutes = elapsedMs / 60000;

  // Warning window: 510-540 minutes (8h 30m - 9h)
  return elapsedMinutes >= 510 && elapsedMinutes < 540;
}
