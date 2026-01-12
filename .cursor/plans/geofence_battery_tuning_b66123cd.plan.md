---
name: Geofence Battery Tuning
overview: Reduce iOS Safari PWA battery usage while keeping geofence accuracy reasonable by making polling and geolocation options adaptive (distance-aware), and by changing the accuracy gate from a hard pause to a decision gate.
todos:
  - id: adaptive-poll-interval
    content: Implement distance-aware adaptive polling interval in `useAutoGeofenceCheck` (iOS balanced defaults).
    status: completed
  - id: adaptive-high-accuracy
    content: Add call-site options to `locationService.getCurrentLocation` and request high accuracy only when near boundary / countdown / state transition.
    status: completed
  - id: accuracy-decision-gate
    content: Refactor poor-accuracy handling so it gates decisions (streaks/countdowns) rather than short-circuiting the poll entirely.
    status: completed
  - id: tuning-config-and-telemetry
    content: Centralize tuning knobs and add targeted logging to validate battery/UX impact on iOS Safari.
    status: completed
---

# Geofence battery tuning plan (iOS Safari, balanced)

## Goals

- **Lower battery drain** during provider auto-geofence by reducing expensive GPS usage when it doesn’t materially improve decisions.
- **Preserve correctness** by keeping strict validation for actual check-in/out triggering (countdown + call).
- **Keep behavior predictable** on iOS Safari PWA (no true background geolocation).

## Where we’ll change behavior

- **Polling cadence**: currently fixed per strategy (`visibility-wakelock` uses 30s) via `getStrategyConfig()`.
- **High accuracy usage**: currently always-on (`enableHighAccuracy: true`) in `locationService.getCurrentLocation()`.
- **Accuracy threshold handling**: currently early-returns when `accuracy > 50m` (effectively “paused for decisions”).

Key files:

- [`/Users/arthurturnbull/Developer/schools-in/src/lib/hooks/useAutoGeofenceCheck.ts`](/Users/arthurturnbull/Developer/schools-in/src/lib/hooks/useAutoGeofenceCheck.ts)
- [`/Users/arthurturnbull/Developer/schools-in/src/lib/utils/location.ts`](/Users/arthurturnbull/Developer/schools-in/src/lib/utils/location.ts)
- [`/Users/arthurturnbull/Developer/schools-in/src/lib/pwa/capabilities.ts`](/Users/arthurturnbull/Developer/schools-in/src/lib/pwa/capabilities.ts)
- (Optional) [`/Users/arthurturnbull/Developer/schools-in/src/lib/utils/geo.ts`](/Users/arthurturnbull/Developer/schools-in/src/lib/utils/geo.ts)

## Proposed design (adaptive, but simple)

### 1) Distance-aware polling interval (primary battery win)

- Keep existing strategy baseline, but **adapt interval based on context** in `useAutoGeofenceCheck`:
  - **Active countdown** (check-in/out about to happen): 10–15s
  - **Near geofence edge** (e.g., within 2× radius or lastDistanceMeters < ~250m): 30s
  - **Far away** (e.g., > 500m): 90–120s
  - **App not visible**: already skips work; keep as-is.
- Ensure interval changes are **debounced** (don’t reset timers every poll).

### 2) Adaptive `enableHighAccuracy`

- Change `locationService.getCurrentLocation()` to accept call-site options.
- In `useAutoGeofenceCheck`, request:
  - **High accuracy ON** only when it matters:
    - active countdown, or
    - currently “entering/exiting”, or
    - very close to boundary.
  - **High accuracy OFF** for far-away polling (coarse location is good enough to know “not close”).
- Also tune `maximumAge`/`timeout` for iOS:
  - When far: higher `maximumAge` (reuse recent fix), shorter timeout.
  - When near: lower `maximumAge`, reasonable timeout.

### 3) Replace “hard pause” with “decision gate” for poor accuracy

- Keep `ACCURACY_THRESHOLD_METERS` (50m) as the **threshold for triggering countdown / changing state**.
- But do **not fully short-circuit the poll** when accuracy is poor. Instead:
  - Record `lastAccuracyMeters`, show the existing paused messaging if needed.
  - Continue polling, but treat location as **non-actionable**: don’t increment inside/outside streaks and don’t start countdown.
- This prevents “flapping” logic and avoids repeated high-accuracy requests when the device can’t deliver good accuracy.

### 4) Make thresholds configurable (balanced defaults)

- Centralize tuning knobs in one place (likely `useAutoGeofenceCheck.ts`):
  - `ACCURACY_THRESHOLD_METERS` (keep 50m default)
  - distance buckets for interval changes
  - high-accuracy conditions
- Optionally support env overrides (e.g., `NEXT_PUBLIC_GEOFENCE_*`) for fast iteration on staging.

## Verification / rollout

- Add lightweight logging/metrics (already uses `appLogger`) for:
  - chosen poll interval
  - whether high accuracy was requested
  - accuracy value + whether it was actionable
  - time-to-checkin from first “near” to countdown
- Validate on iOS Safari:
  - standing still in-range
  - walking/driving near boundary
  - poor GPS environment (indoors)

## Mermaid: simplified decision flow

```mermaid
flowchart TD
  Poll[PollTick] --> GetLoc[GetLocation(enableHighAccuracy?)]
  GetLoc --> AccOK{accuracy<=Threshold?}
  AccOK -->|No| RecordOnly[UpdateUIAndStatsOnly]
  AccOK -->|Yes| Distance[ComputeDistance]
  Distance --> Decide[UpdateStreaksAndMaybeCountdown]
```