---
title: "feat: Late provider admin alerts via scheduled Cloud Function"
type: feat
status: completed
date: 2026-03-24
origin: docs/brainstorms/2026-03-24-late-provider-admin-alerts-brainstorm.md
---

# feat: Late Provider Admin Alerts

## Overview

Add a `checkLateProviders` Cloud Function that runs every 30 minutes and notifies all admins when a scheduled provider has not checked in within 15 minutes of their scheduled start time. Follows the established `cleanupStaleSessions` pattern exactly.

## Problem Statement

Admins have no proactive visibility when a scheduled provider fails to show up. They only discover no-shows reactively (e.g., a school calls to complain, or an admin happens to look at the dashboard). This feature closes the loop: if a provider's schedule says they should be there and they aren't, admins are alerted promptly.

## Proposed Solution

A new scheduled Cloud Function `checkLateProviders` runs every 30 minutes, mirroring `cleanupStaleSessions`. It queries all active schedules for the current day (Chicago timezone), filters to slots whose grace window has elapsed, checks whether an active/paused session exists for that provider+location, and sends a batched push notification to all admins for any late providers found.

Deduplication prevents re-alerting within the same calendar day. A TTL field on dedup documents enables automatic Firestore cleanup after 7 days.

## Technical Approach

### Architecture

The function fits entirely within `functions/src/` and requires no client-side changes. It adds:

1. **`functions/src/lateProviderLogic.ts`** — pure helper functions (testable in isolation, same pattern as `cleanupLogic.ts`)
2. **New `onSchedule` entry in `functions/src/index.ts`** — `checkLateProviders`, every 30 minutes
3. **New Firestore collection `latenessAlerts/`** — deduplication docs with TTL
4. **New composite index in `firestore.indexes.json`** — for the schedules query

### Key Technical Decisions

**(see brainstorm: docs/brainstorms/2026-03-24-late-provider-admin-alerts-brainstorm.md)**

| Decision | Choice | Rationale |
|---|---|---|
| Trigger | `onSchedule` every 30 min | Mirrors `cleanupStaleSessions`; no new infrastructure |
| Grace period | 15 minutes (hardcoded constant `LATE_PROVIDER_GRACE_MINUTES = 15`) | Sufficient buffer; configurable later if needed |
| Notification recipients | All admins (`role == "admin"`) via push | Consistent with existing admin alert pattern |
| Alert per slot | Each `(scheduleId, startTime)` checked independently | A 9am and 1pm slot are separate obligations |
| Batching | One batched push per run (not per late provider) | Matches `cleanupStaleSessions`; prevents push spam to OS |
| Session status check | `status in ["active", "paused"]` | Paused providers checked in — suppressing alert is correct |
| Dedup write ordering | Write dedup doc BEFORE sending push | Idempotent on retry; preferred over risk of duplicate push |
| VAPID not configured | Skip push + skip dedup write | Allows push to fire on next run once VAPID is restored |
| Resolution notification | None | One alert per slot per day is sufficient; dashboard provides status |
| Disabled providers | Filter out `isActive === false` or `disabled === true` | They cannot check in — would generate daily false positives |
| Inactive locations | Filter out schedules where `Location.active === false` | Prevents alerts for deactivated locations |
| Provider assignment | Check `Location.assignedProviders.includes(providerId)` | RBAC single source of truth; unassigned = cannot check in |

### Timezone Handling

**Critical:** All time comparisons must use `America/Chicago` local time, consistent with the pattern at `functions/src/index.ts:450-466` (`startSession`). Use `Intl.DateTimeFormat` with `timeZone: "America/Chicago"` to derive:

- `todayDayOfWeek` — for filtering schedules
- `nowMinutes` — current minutes since midnight in Chicago time (for comparing against `startTime`)
- `todayDateKey` — `YYYY-MM-DD` in Chicago time (for dedup key)

Never use `new Date().getDay()` or `new Date().getHours()` — these return UTC values, which disagree with Chicago time for a 5–6 hour window every night, and for the full day during DST transitions.

### Dedup Document Schema

Collection: `latenessAlerts`
Document ID: `{scheduleId}-{startTimeHHMM}-{YYYY-MM-DD}` (Chicago local date)

```ts
{
  scheduleId: string;
  providerId: string;
  locationId: string;
  startTime: string;       // "HH:MM"
  alertedAt: Timestamp;
  adminCount: number;      // how many admins were notified
  expireAt: Timestamp;     // alertedAt + 7 days (Firestore TTL field)
}
```

Enable Firestore TTL on `expireAt` field in `firestore.indexes.json` — this prevents unbounded collection growth without requiring a cleanup job.

### Notification Payload

```ts
{
  title: "Provider not checked in",
  body: `${count} provider(s) are late: ${providerNames} at ${locationNames}`,  // batched
  data: {
    type: "provider-late",
    url: "/admin"
  }
}
```

For a single late provider:
```
body: "Alex Smith has not checked in at Lincoln Elementary (scheduled 9:00 AM)"
```

For multiple late providers in the same run:
```
body: "2 providers have not checked in: Alex Smith (Lincoln, 9:00 AM), Jordan Lee (Washington, 8:30 AM)"
```

The `data.type: "provider-late"` field enables service worker routing to `/admin` on notification tap.

### Core Algorithm (`lateProviderLogic.ts`)

```ts
// functions/src/lateProviderLogic.ts

export function getChicagoTimeContext(): {
  dayOfWeek: number;
  nowMinutes: number;  // minutes since midnight in Chicago
  todayDateKey: string; // YYYY-MM-DD in Chicago
}

export function isScheduleLate(
  schedule: Schedule,
  nowMinutes: number,
  graceMinutes: number  // LATE_PROVIDER_GRACE_MINUTES
): boolean  // true when nowMinutes > startTimeMinutes + graceMinutes

export function buildDedupId(
  scheduleId: string,
  startTime: string,
  dateKey: string
): string  // "{scheduleId}-{startTimeHHMM}-{YYYY-MM-DD}"

export function buildLatenessNotificationBody(
  lateProviders: Array<{ providerName: string; locationName: string; startTime: string }>
): string
```

### Main Function Flow (`functions/src/index.ts`)

```
checkLateProviders (onSchedule: "every 30 minutes")
  │
  ├── initializeWebPush() → false? log warning + return early (no dedup write)
  │
  ├── getChicagoTimeContext() → { dayOfWeek, nowMinutes, todayDateKey }
  │
  ├── Query: schedules WHERE dayOfWeek == today AND isActive == true
  │
  ├── Parallel eligibility checks (Promise.all, NOT sequential):
  │   For each schedule where isScheduleLate(...):
  │   ├── Fetch dedup doc → exists? skip
  │   ├── Fetch Location → active == false? skip
  │   ├── Check Location.assignedProviders.includes(providerId) → false? skip
  │   ├── Fetch provider User → isActive == false || disabled == true? skip
  │   └── Query sessions WHERE userId == providerId
  │                        AND locationId == schedule.locationId
  │                        AND status in ["active", "paused"]
  │                        AND dayKey == todayDateKey
  │       → session found? skip
  │
  ├── lateProviders = schedules that passed all checks above
  │
  ├── If lateProviders.length == 0 → return (nothing to alert)
  │
  ├── Write dedup docs for ALL lateProviders (writeBatch, ≤500 per batch)
  │   Each doc: { scheduleId, providerId, locationId, startTime, alertedAt,
  │               adminCount: 0, expireAt: now + 7 days }
  │
  ├── Query: users WHERE role == "admin"
  │
  ├── Build notification payload (batched body listing all late providers)
  │
  ├── Promise.all: for each admin, fetch pushSubscriptions/adminAlerts
  │               → send push notification
  │               → delete stale subscriptions on 410/404 (existing pattern)
  │
  └── Update dedup docs with adminCount (writeBatch)
```

### Composite Index Required

Add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "schedules",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "dayOfWeek", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" }
  ]
}
```

And TTL policy:
```json
{
  "collectionGroup": "latenessAlerts",
  "fieldPath": "expireAt",
  "ttlPolicy": { "state": "ACTIVE" }
}
```

## Alternative Approaches Considered

**Cloud Tasks (per-schedule precision triggers):** Fires at the exact `startTime + graceMinutes` rather than polling. Rejected because it requires significant new infrastructure (no existing pattern in the codebase) and the 30-minute scheduler provides adequate operational SLAs. *(see brainstorm)*

**In-dashboard check only (no push):** Admin opens the app and sees late providers. Rejected because it requires admins to be actively watching the dashboard — passive rather than proactive alerting. *(see brainstorm)*

## System-Wide Impact

### Interaction Graph

```
onSchedule (30 min)
  → Firestore read: schedules collection
  → Firestore read: latenessAlerts (dedup check)
  → Firestore read: Location docs (active + assignedProviders)
  → Firestore read: users (provider User docs)
  → Firestore query: sessions (active/paused for provider+location+day)
  → Firestore write: latenessAlerts (dedup docs via writeBatch)
  → Firestore read: users WHERE role=="admin"
  → Firestore read: users/{uid}/pushSubscriptions/adminAlerts
  → web-push: VAPID push to each admin subscription endpoint
  → Firestore delete: stale push subscriptions (410/404 responses)
  → Firestore write: latenessAlerts (adminCount update)
```

No interaction with the client-side session lifecycle or the offline queue.

### Error & Failure Propagation

- **Firestore query failure:** Function throws, Firebase Scheduler retries. Dedup docs not yet written → retry is safe (idempotent).
- **Partial dedup write failure:** writeBatch is atomic; either all succeed or none do. Retry will re-evaluate and re-write the batch.
- **Push delivery failure (non-410/404):** Push send is best-effort; logged but does not throw. Dedup doc is already written, so push will not retry next run. Acceptable — same behavior as `cleanupStaleSessions`.
- **VAPID not configured:** `initializeWebPush()` returns `false`; function returns early before writing any dedup doc, allowing push to fire on next run once configured.

### State Lifecycle Risks

- **Dedup doc written, push not sent:** Possible if push throws after dedup write. Alert is silently dropped for that day. Acceptable per brainstorm decision (push-only, no in-app fallback). Mitigated by logging which providers were alerted.
- **Provider checks in between dedup write and push send:** No issue — dedup doc is already written for that slot and the batched notification will still name them. Minor UX imprecision on the rare edge; acceptable given the 30-min polling window.
- **`latenessAlerts` unbounded growth:** Fully mitigated by Firestore TTL on `expireAt` field (7-day retention).

### API Surface Parity

No new client-facing APIs or hooks. Admin push subscription path (`users/{uid}/pushSubscriptions/adminAlerts`) is the same as used by `cleanupStaleSessions`. No changes to `src/`.

### Known Latency Characteristic

Maximum detection latency = 15 min (grace) + up to 29 min (cron window) = **up to 44 minutes** after the scheduled start time. Example: a 9:29 AM schedule with a 9:30 AM cron run fires at 10:00 AM (9:44 AM threshold not yet passed at 9:30 AM). This is operational behavior to document — alerts are not real-time.

### Integration Test Scenarios

1. **Provider checks in before grace window:** Schedule at 9:00, check-in at 9:10, function runs at 9:30 → `status: active` session found → no alert.
2. **Provider genuinely absent:** Schedule at 9:00, no check-in, function runs at 9:30 → grace window passed, no session → alert fires, dedup doc written.
3. **Function re-runs same 30-min window:** Dedup doc from first run found on second run → no duplicate alert.
4. **Provider pauses their session:** `status: paused` session found → alert suppressed (correct; provider physically present).
5. **Disabled provider with active schedule:** `User.isActive == false` → filtered out before session check → no alert.
6. **Inactive location:** `Location.active == false` → filtered out → no alert.
7. **Two slots on same day, both missed:** Two separate dedup docs written, one batched push naming both providers.
8. **Midnight DST transition:** Chicago date derived via `Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago" })` — dayOfWeek and dateKey match the local Chicago calendar date, not UTC.

## Acceptance Criteria

### Functional

- [x] `checkLateProviders` Cloud Function runs on `every 30 minutes` schedule
- [x] Only schedules with `isActive: true` AND `dayOfWeek == todayChicago` are evaluated
- [x] Grace period of 15 minutes: alert only fires when `nowChicago > startTime + 15 min`
- [x] Providers with `User.isActive === false` or `User.disabled === true` are excluded
- [x] Schedules for locations with `Location.active === false` are excluded
- [x] Schedules for unassigned providers (`!Location.assignedProviders.includes(providerId)`) are excluded
- [x] Sessions with `status in ["active", "paused"]` suppress the alert for that slot
- [x] Dedup document written before push send; dedup check prevents same slot re-alerting on same Chicago calendar day
- [x] Multiple late providers in one run produce a single batched push notification (not N individual pushes)
- [x] Dedup documents include `expireAt` Firestore TTL field (now + 7 days)
- [x] `data.type: "provider-late"` included in push payload for service worker routing
- [x] All admins (`role == "admin"`) receive the push; stale subscriptions (410/404) are deleted
- [x] When VAPID is not configured, function returns early without writing dedup docs
- [x] Composite index for `schedules` collection added to `firestore.indexes.json`
- [x] Firestore TTL policy for `latenessAlerts.expireAt` added to `firestore.indexes.json`

### Non-Functional

- [x] Fan-out reads to admin push subscriptions use `Promise.all` (not sequential `await`)
- [x] All Firestore batch writes chunked to ≤ 500 operations
- [x] All time comparisons use `America/Chicago` timezone via `Intl.DateTimeFormat`
- [x] No changes to `src/` (client) — backend only

### Testing

- [x] Unit tests for all `lateProviderLogic.ts` helpers (≥ 90% coverage), including:
  - `getChicagoTimeContext()` correctness for standard time and DST
  - `isScheduleLate()` boundary conditions (exact 15 min, 14:59, 15:01)
  - `buildDedupId()` format
  - `buildLatenessNotificationBody()` for 1 and N providers
- [ ] Unit tests for the main function logic (provider filtering, dedup, batching)
- [ ] Integration test scenarios 1–8 above covered by test suite

## Dependencies & Prerequisites

- No new npm packages required (`web-push` already present)
- Composite index deployment required before function goes live (`firebase deploy --only firestore:indexes`)
- VAPID secrets already configured in production

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| UTC vs Chicago timezone mismatch | High (easy to get wrong) | High (incorrect alerts nightly) | Explicit `Intl.DateTimeFormat` in helper; unit tests for DST boundaries |
| Disabled providers generating daily alerts | Medium | Medium (alert fatigue) | `User.isActive/disabled` filter explicitly specified |
| Push spam to OS (individual per provider) | Medium | Medium (subscription revocation) | Batch into single notification per run (confirmed approach) |
| Missing composite index blocks deployment | Low | High (runtime Firestore error) | Index added to `firestore.indexes.json` and deployed first |
| Dedup collection growth | Low (with TTL) | Low | Firestore TTL field eliminates need for cleanup job |

## Documentation Plan

- Add `checkLateProviders` to the Cloud Functions table in `docs/agents/architecture.md`
- Add `latenessAlerts` collection to the Firestore schema section
- Note the 44-minute maximum latency characteristic in the architecture doc

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-24-late-provider-admin-alerts-brainstorm.md](../brainstorms/2026-03-24-late-provider-admin-alerts-brainstorm.md)
  - Key decisions carried forward: scheduled Cloud Function approach, 15-minute grace period, all-admins push, per-slot independent alerts, push-only (no in-app flag)

### Internal References

- Pattern reference (scheduled function + admin push): `functions/src/index.ts` — `cleanupStaleSessions` (~line 699)
- Pure helper pattern: `functions/src/cleanupLogic.ts` + `functions/src/__tests__/cleanupLogic.test.ts`
- Timezone pattern (Chicago time): `functions/src/index.ts:450-466` (`validateScheduleGating`)
- Push notification utility: `functions/src/utils.ts` — `initializeWebPush`, `sendPushNotification`
- Schedule type + collection: `src/lib/firebase/types.ts` (~line 88) + `src/lib/firebase/firestore.ts`
- Fan-out parallelism guidance: `docs/solutions/database-issues/firestore-query-patterns-for-admin-list-views.md`

### Related Work

- Schedule gating (uses same `Schedule.startTime` comparison): `functions/src/sessionLifecycle.ts` — `validateScheduleGating`
