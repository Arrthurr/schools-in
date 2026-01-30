---
name: Fix Session Bugs
overview: "Fix three session lifecycle bugs: (1) auto check-out triggering immediately after check-in due to GPS fluctuations, (2) sessions not being auto-checked-out when users leave (relying on 2-hour timeout), and (3) offline-synced sessions with backdated timestamps being immediately terminated by cleanup."
todos:
  - id: fix-grace-period
    content: Add post-check-in grace period to useAutoGeofenceCheck.ts to prevent immediate auto-checkout
    status: completed
  - id: fix-cleanup-offline-grace
    content: Add grace period in cleanupStaleSessions for recently-synced offline sessions (check createdAt/updatedAt)
    status: completed
  - id: fix-cleanup-queries
    content: Update cleanupStaleSessions to handle sessions with startTime fallback and legacy active:true sessions
    status: completed
  - id: add-index
    content: Add composite index for status + startTime to firestore.indexes.json
    status: completed
isProject: false
---

# Fix Session Lifecycle Bugs

## Evidence from Firebase Data

Analysis of user `1nyKuEpE3UWfjJvObTMmpgiaiOJ3` sessions revealed:

| Session   | Check-in        | End Time                | Duration        | Status        | Issue                                              |
| --------- | --------------- | ----------------------- | --------------- | ------------- | -------------------------------------------------- |
| Example 1 | Jan 21 7:36 AM  | Jan 21 12:50 PM         | 314 min         | completed     | Normal - worked correctly                          |
| Example 2 | Jan 26 7:38 AM  | Jan 26 7:41 AM (cutoff) | 120 (hardcoded) | error/timeout | Ran 2 hours without checkout, cleanup terminated   |
| Example 3 | Jan 27 12:13 PM | Jan 28 5:41 AM (cutoff) | 120 (hardcoded) | error/timeout | Offline-sync session immediately killed after sync |

## Bug Analysis

### Bug 1: Auto Check-out After Check-in (Before Leaving)

**Root Cause:** When a check-in completes, the polling effect re-runs immediately and can trigger checkout due to:

1. **Missing state reset**: The `outsideStreak` ref is not reset when check-in succeeds
2. **No grace period**: There's no protection window after check-in to account for GPS accuracy fluctuations
3. **Immediate polling**: The effect re-runs when `activeSession` changes, calling `runPoll()` immediately

**Code flow:**

1. User inside geofence, `insideStreak` builds to 2
2. Check-in countdown completes, `onConfirm` runs
3. `activeSession` state updates (via Firestore listener)
4. Effect re-runs, `runPoll()` called immediately
5. If GPS shows outside (accuracy issue), `outsideStreak` increments
6. Two consecutive "outside" readings trigger checkout

**Evidence in code:**

```949:965:src/lib/hooks/useAutoGeofenceCheck.ts
onConfirm: async () => {
  try {
    await checkIn(firstInside!.id, {
      // ...
    });
  } finally {
    clearCountdown(countdownKey);
    setActiveCountdown(null);
    activeCountdownRef.current = null;
    // NOTE: outsideStreak is NOT reset here
  }
},
```

### Bug 2: Auto Check-out Not Triggering When Users Leave

**Evidence:** Examples 2 and 3 both show sessions that ran until the 2-hour cleanup timeout instead of being auto-checked-out when the user left the geofence.

**Likely causes:**

- App backgrounded/closed (iOS aggressively kills background location)
- GPS accuracy issues preventing geofence exit detection
- User inside building where GPS is unreliable

**Impact:** Users rely on the 2-hour timeout cleanup instead of proper checkout, resulting in inaccurate session durations.

### Bug 3: Offline-Synced Sessions Immediately Terminated

**Root Cause:** When a user is offline for an extended period, their check-in is queued locally with the original timestamp. When they come back online:

1. Offline queue syncs, creating session with **backdated** `checkInTime`
2. Cleanup runs (every 15 minutes) and finds the session as "stale"
3. Session is immediately terminated with `errorCode: "timeout_auto_close"`

**Evidence:** Example 3 shows:

- `checkInTime`: Jan 27 12:13 PM (when user went offline)
- `checkInMethod`: "offline-sync"
- Session was terminated by cleanup, not by user checkout

**Impact:** Users who work offline for extended periods have their sessions immediately killed when they reconnect.

### Bug 4: Query Limitations in cleanupStaleSessions

**Root Cause:** The cleanup query only uses `checkInTime`:

```795:798:functions/src/index.ts
const staleSessionsQuery = sessionsRef
  .where("status", "in", ["active", "paused"])
  .where("checkInTime", "<", cutoff)
```

Sessions missing `checkInTime` are never found. This can happen if:

- Sessions created via `useCachedSession.createSession()` (which doesn't set `checkInTime`)
- Legacy sessions with only `startTime` or `active: true`

## Solution

### Fix 1: Add Post-Check-in Grace Period (Client-side)

Add a new ref `lastCheckInTime` and constant `CHECK_IN_GRACE_PERIOD_MS` (60 seconds) to suppress auto-checkout immediately after check-in.

**Changes to `src/lib/hooks/useAutoGeofenceCheck.ts`:**

1. Add constant:

```typescript
const CHECK_IN_GRACE_PERIOD_MS = 60_000; // 60 seconds
```

1. Add ref to track last check-in time:

```typescript
const lastCheckInTimeRef = useRef<number>(0);
```

1. In `onConfirm` for check-in, record the time and reset `outsideStreak`:

```typescript
onConfirm: async () => {
  try {
    await checkIn(firstInside!.id, { ... });
    lastCheckInTimeRef.current = Date.now();
    outsideStreak.current = 0; // Reset to prevent immediate checkout
  } finally {
    // existing cleanup
  }
},
```

1. In the checkout logic (around line 767), add grace period check:

```typescript
if (outsideStreak.current >= DEBOUNCE_POLLS) {
  // Skip checkout if within grace period after check-in
  const withinGracePeriod =
    Date.now() - lastCheckInTimeRef.current < CHECK_IN_GRACE_PERIOD_MS;

  if (withinGracePeriod) {
    appLogger.debug(
      "Skipping auto checkout - within grace period after check-in",
    );
    setIsPolling(false);
    pollInFlightRef.current = false;
    return;
  }
  // ... existing checkout logic
}
```

### Fix 2: Add Grace Period for Recently-Synced Sessions (Server-side)

Prevent cleanup from terminating sessions that were recently created (even if their `checkInTime` is old due to offline sync).

**Changes to `functions/src/index.ts`:**

Add a check for `createdAt` or `updatedAt` timestamp before terminating a session:

```typescript
const RECENTLY_CREATED_GRACE_MS = 15 * 60 * 1000; // 15 minutes

staleSessionsSnapshot.forEach((doc: any) => {
  const data = doc.data();

  // Skip sessions that were recently created/synced (offline sync grace period)
  const createdAt =
    data.createdAt?.toMillis?.() || data.updatedAt?.toMillis?.() || 0;
  const sessionAge = now.toMillis() - createdAt;

  if (sessionAge < RECENTLY_CREATED_GRACE_MS) {
    logger.info(
      `Skipping recently-synced session: ${doc.id} (age: ${Math.round(sessionAge / 1000)}s)`,
    );
    return; // Skip this session - give it time to be properly checked out
  }

  // ... existing cleanup logic
});
```

This allows offline-synced sessions a 15-minute window after sync to be properly checked out before cleanup considers them.

### Fix 3: Update cleanupStaleSessions Query

**Changes to `functions/src/index.ts`:**

1. Run multiple queries to catch all stale sessions:

```typescript
// Primary query using checkInTime
const staleByCheckInTime = sessionsRef
  .where("status", "in", ["active", "paused"])
  .where("checkInTime", "<", cutoff)
  .limit(_PRODUCTION_CONFIG.maxBatchSize);

// Fallback query for sessions with only startTime
const staleByStartTime = sessionsRef
  .where("status", "in", ["active", "paused"])
  .where("startTime", "<", cutoff)
  .limit(_PRODUCTION_CONFIG.maxBatchSize);

// Legacy query for active: true sessions
const legacyStale = sessionsRef
  .where("active", "==", true)
  .where("startTime", "<", cutoff)
  .limit(100);
```

1. Deduplicate results by session ID and process all found sessions

### Fix 4: Add Index for startTime Cleanup Query

Add to `firestore.indexes.json`:

```json
{
  "collectionGroup": "sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "startTime", "order": "ASCENDING" }
  ]
}
```

## Files to Modify

1. **[src/lib/hooks/useAutoGeofenceCheck.ts](src/lib/hooks/useAutoGeofenceCheck.ts)**

- Add `CHECK_IN_GRACE_PERIOD_MS` constant (60 seconds)
- Add `lastCheckInTimeRef` ref
- Reset `outsideStreak` on check-in success
- Add grace period check before triggering checkout

1. **[functions/src/index.ts](functions/src/index.ts)**

- Add `RECENTLY_CREATED_GRACE_MS` constant (15 minutes)
- Add check for recently-created sessions before terminating
- Update `cleanupStaleSessions` to query by both `checkInTime` and `startTime`
- Add legacy `active: true` query
- Deduplicate and process all found sessions

1. **[firestore.indexes.json](firestore.indexes.json)**

- Add composite index for `status` + `startTime`

## Testing

After implementation:

1. **Test client-side grace period:**

- Check in at a location, verify no immediate checkout
- Wait 60+ seconds, verify checkout still works when leaving

1. **Test offline sync grace period:**

- Simulate offline check-in with backdated timestamp
- Verify cleanup skips session within 15-minute grace window
- Verify cleanup processes session after grace period expires

1. **Test expanded cleanup queries:**

- Create session with only `startTime` field, verify cleanup finds it
- Create legacy session with `active: true`, verify cleanup finds it

1. **Regression testing:**

- Verify normal check-in/check-out flow still works
- Verify cleanup still terminates genuinely stale sessions
