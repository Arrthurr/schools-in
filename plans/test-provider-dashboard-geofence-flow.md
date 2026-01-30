# Fix Countdown Loop Bug

## Problem

The auto check-in countdown toast loops 2-3 times (restarting from 15s) before check-in completes.

## Root Cause

When the main polling effect re-runs (due to dependency changes), `runPoll()` is called again while a countdown is already active. The existing guard `activeCountdownRef.current` should prevent this, but the timing allows a race condition.

**File**: `src/lib/hooks/useAutoGeofenceCheck.ts`

The guard check at line 878 (`!activeCountdownRef.current`) can pass on two rapid polls before either sets the ref, because:
1. `activeCountdownRef.current` is set at line 881 (AFTER the guard check passes)
2. `setActiveCountdown()` state update is async

## Fix

### Option A: Move ref assignment before guard check (Simplest)

```typescript
// Around line 876-888, change the order:

// BEFORE: Check then set
if (insideStreak.current >= DEBOUNCE_POLLS && !activeCountdownRef.current) {
  const countdownKey = `checkin-${firstInside.id}`;
  activeCountdownRef.current = { type: "checkin", locationId: firstInside.id };
  // ...
}

// AFTER: Set atomically with check using a compare-and-swap pattern
if (insideStreak.current >= DEBOUNCE_POLLS) {
  const countdownKey = `checkin-${firstInside.id}`;

  // Atomic check-and-set
  if (activeCountdownRef.current) {
    appLogger.debug("Countdown already active, skipping", { countdownKey });
    setIsPolling(false);
    pollInFlightRef.current = false;
    return;
  }
  activeCountdownRef.current = { type: "checkin", locationId: firstInside.id };

  // Now safe to proceed with countdown
  setActiveCountdown({ type: "checkin", locationId: firstInside.id });
  // ...
}
```

### Option B: Add guard inside startCountdownToast (Belt and suspenders)

The `startCountdownToast` function already has a guard at line 501:
```typescript
if (countdownCleanup.current[id]) {
  return;
}
```

Add a secondary guard for `activeCountdownRef`:
```typescript
if (countdownCleanup.current[id] || activeCountdownRef.current) {
  appLogger.debug("Countdown blocked", { id, hasCleanup: !!countdownCleanup.current[id], hasActiveRef: !!activeCountdownRef.current });
  return;
}
```

## Test

Add one focused test to `src/lib/hooks/__tests__/useAutoGeofenceCheck.test.tsx`:

```typescript
it('should not start duplicate countdown when polls overlap', async () => {
  (useAutoGeofencePreference as jest.Mock).mockReturnValue({ enabled: true });
  (validateGeofence as jest.Mock).mockReturnValue({ distance: 50, isWithinGeofence: true });

  renderHook(() => useAutoGeofenceCheck());

  // Wait for countdown to start
  await act(async () => {
    await flushPromises();
    jest.advanceTimersByTime(60000); // Second poll triggers countdown
    await flushPromises();
  });

  // Count "Auto check-in" toast calls
  const checkInToasts = (toast as jest.Mock).mock.calls.filter(
    call => call[0]?.title === "Auto check-in"
  );

  expect(checkInToasts.length).toBe(1);
});
```

## Verify

1. Run existing tests: `npm test -- --testPathPattern="useAutoGeofenceCheck"`
2. Manual smoke test on staging

## Files Changed

- `src/lib/hooks/useAutoGeofenceCheck.ts` - Add guard (~5 lines)
- `src/lib/hooks/__tests__/useAutoGeofenceCheck.test.tsx` - Add test (~15 lines)

---

**Generated with Claude Code on 2025-01-22**
