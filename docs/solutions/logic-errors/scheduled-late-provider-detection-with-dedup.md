---
title: "checkLateProviders: Scheduled Cloud Function for Late Provider Admin Alerts"
category: "logic-errors"
date: "2026-03-25"
tags:
  - cloud-functions
  - admin-notifications
  - scheduling
  - push-notifications
  - firestore
  - timezone-handling
  - deduplication
  - backend
related_components:
  - functions/src/lateProviderLogic.ts
  - functions/src/__tests__/lateProviderLogic.test.ts
  - functions/src/index.ts
  - firestore.indexes.json
  - firestore.rules
---

## Problem

Admins had no proactive visibility into provider no-shows. Discovery was reactive: school complaints or manual dashboard checks. There was no mechanism to alert admins when a scheduled provider failed to check in within their expected window.

## Root Cause

No scheduled job existed to monitor provider check-in status against scheduled arrival times. The existing `cleanupStaleSessions` function handled the other direction (auto-closing after 9 hours), but nothing monitored the start-of-day case.

## Solution

A `checkLateProviders` Cloud Function running on `onSchedule("every 30 minutes")`. For each active schedule where the current Chicago time exceeds the scheduled start by more than 15 minutes, it checks provider eligibility (dedup, location active, RBAC, provider active, no existing session) and sends a single batched push notification to all admins.

### Key implementation files

- `functions/src/lateProviderLogic.ts` — Pure helpers: timezone context, grace window, dedup ID, notification body
- `functions/src/index.ts` lines 1136–1399 — Orchestration: query, eligibility fan-out, dedup write, push fan-out
- `functions/src/__tests__/lateProviderLogic.test.ts` — 29 unit tests

### Core algorithm

```
1. Check VAPID configured → early return if not (no dedup written)
2. Get Chicago time context (dayOfWeek, nowMinutes, todayDateKey)
3. Query schedules: dayOfWeek == today AND isActive == true
4. Filter to schedules past grace window (validate startTime before parsing)
5. Fetch admin users BEFORE any dedup writes
6. Parallel eligibility checks per late schedule:
   a. Dedup hit? Skip
   b. Location active? Skip if not
   c. Provider assigned to location (assignedProviders[])? Skip if not
   d. Provider active/enabled? Skip if not
   e. Active/paused session today? Skip if yes
7. Write dedup docs in batches (≤500) with 7-day TTL
8. Build single batched notification body
9. Fan-out push to all admins in parallel
```

### Grace window check

```typescript
export function isScheduleLate(
  startTime: string,
  nowMinutes: number,
  graceMinutes: number = LATE_PROVIDER_GRACE_MINUTES
): boolean {
  const startMinutes = parseStartTimeMinutes(startTime);
  return nowMinutes > startMinutes + graceMinutes;  // Strict > (exactly at boundary is NOT late)
}
```

### Dedup write-before-send pattern

```typescript
// Write dedup docs BEFORE sending push (idempotent on retry).
// Admins confirmed to exist above, so the slot will be consumed by a real send.
const chunkSize = PRODUCTION_CONFIG.maxBatchSize; // 500
for (let i = 0; i < lateProviders.length; i += chunkSize) {
  const chunk = lateProviders.slice(i, i + chunkSize);
  const dedupBatch = db.batch();
  for (const lp of chunk) {
    dedupBatch.set(db.collection("latenessAlerts").doc(lp.dedupId), {
      scheduleId: lp.scheduleId,
      providerId: lp.providerId,
      locationId: lp.locationId,
      startTime: lp.startTime,
      alertedAt: now,
      adminCount: 0,
      expireAt,  // now + 7 days (Firestore TTL)
    });
  }
  await dedupBatch.commit();
}
// Then send push...
```

### Push result discrimination

```typescript
// Return "sent" | "expired" | "failed" — not boolean.
// Only delete subscriptions confirmed expired (410/404); preserve on transient errors.
if (pushResult === "expired") {
  await subscriptionDoc.ref.delete();
}
// "failed" (429, 503, timeout) → preserve subscription for next run
```

---

## P1 Review Findings Addressed (commit 328d97b6)

Eight high-severity bugs were found in code review and fixed before merging:

| # | Finding | Fix |
|---|---------|-----|
| 1 | **Missing composite index** — sessions query `(userId + locationId + status + dayKey)` throws `FAILED_PRECONDITION` in production | Added to `firestore.indexes.json` |
| 2 | **Dedup written before admin fetch** — if no admins exist, dedup slot is permanently consumed | Fetch admins BEFORE writing any dedup docs |
| 3 | **`sendPushNotification` returned `boolean`** — code deleted subscriptions on ANY failure, including 429s and timeouts | Changed return type to `"sent" \| "expired" \| "failed"`; only delete on `"expired"` |
| 4 | **No Firestore security rule for `latenessAlerts`** — clients could read/write PII-containing dedup docs | Added `allow read, write: if false;` rule |
| 5 | **Timezone fallback vulnerability** — `weekdayMap[key] ?? now.getDay()` silently fell back to system locale on unexpected Intl output | Changed to throw on unexpected Intl output |
| 6 | **No validation of Firestore schedule docs** — malformed docs would crash the function | Skip with warning if `providerId`/`locationId`/`startTime` aren't strings |
| 7 | **`parseStartTimeMinutes` returned 0 on malformed input** — treated malformed schedules as starting at midnight | Throw on missing colon, non-numeric values, wrong format |
| 8 | **`\|\|` instead of `??` for displayName/locationName** — empty string `""` fell through to IDs | Changed to nullish coalesce `??` |

---

## Prevention Strategies

### 1. Validate prerequisites before consuming idempotent state

Check VAPID config and admin existence before writing dedup documents. If a prerequisite fails, the dedup slot is not wasted — future retries can still fire.

```typescript
if (!pushEnabled) { return; }  // No dedup written
if (adminsSnapshot.empty) { return; }  // No dedup written
// Now safe to write dedup docs
```

### 2. Always add composite indexes before queries go to production

Firestore emulator doesn't enforce composite index requirements. A query that works locally against the emulator will throw `FAILED_PRECONDITION` in production without the index deployed.

**Checklist before deploying any new Firestore query:**
- Does it use multiple `where()` filters or `orderBy`?
- Is a composite index declared in `firestore.indexes.json`?
- Has `firebase deploy --only firestore:indexes` been run?

### 3. Distinguish permanent vs. transient push errors

`sendPushNotification` must return an enum, not a boolean:
- HTTP 410/404 → `"expired"` → safe to delete subscription
- Everything else (429, 503, timeout, network error) → `"failed"` → preserve subscription

Deleting subscriptions on transient errors creates "notification black holes" that require users to re-subscribe.

### 4. Use `Intl.DateTimeFormat` with explicit timezone; never `Date.getDay()`

```typescript
// Wrong — uses system locale, breaks around DST
const dayOfWeek = new Date().getDay();

// Correct — explicit Chicago timezone, handles DST via Intl API
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  weekday: "short",
  // ...
});
```

Test explicitly for DST boundaries: spring-forward (Mar 9) and fall-back (Nov 2). The Intl API handles DST; your code should not.

### 5. Throw on malformed input; don't silently default

`parseStartTimeMinutes("")` → throw, not 0. Returning 0 silently treats malformed data as "midnight", producing valid-looking but wrong behaviour that only manifests as incorrect alerts.

### 6. Use `??` not `||` for nullable string defaults

```typescript
// Wrong — empty string "" falls through to ID
providerName: provider.displayName || providerId

// Correct — only null/undefined falls through
providerName: (provider.displayName as string | undefined) ?? providerId
```

### 7. Deny client access to admin-only collections explicitly

Any collection that stores operational state, audit logs, or admin-only data should have an explicit deny rule even if it's only written by Cloud Functions:

```firestore
match /latenessAlerts/{alertId} {
  allow read, write: if false;
}
```

---

## Test Coverage

29 unit tests in `lateProviderLogic.test.ts` covering:

| Area | Cases |
|------|-------|
| `getChicagoTimeContext` | Standard time (CST), summer (CDT), DST spring-forward, DST fall-back, midnight UTC boundary |
| `isScheduleLate` | Exactly at grace boundary (not late), one minute past (late), custom grace period |
| `buildDedupId` | Format validation, uniqueness across time/date/schedule |
| `buildLatenessNotificationBody` | Empty, single provider, multiple providers, time edge cases (midnight, noon, PM) |
| `parseStartTimeMinutes` | Valid input, empty string, missing colon, non-numeric, ISO format |

---

## Architecture Decisions

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| Trigger | `onSchedule("every 30 minutes")` | Mirrors `cleanupStaleSessions`; no new infrastructure |
| Grace period | 15 min (constant) | Sufficient for minor delays; configurable later via TODO #023 |
| Recipients | All admin-role users | Consistent with existing admin alert pattern |
| Notification strategy | One batched push per run | Prevents OS notification spam; reduces push quota usage |
| Dedup key | `{scheduleId}-{HHMM}-{YYYY-MM-DD}` | Natural key; per-slot-per-day idempotency |
| Dedup TTL | 7 days | Bounded collection size; dedup window far exceeds retry window |
| Timezone | `Intl.DateTimeFormat("America/Chicago")` | Isolated from system locale; handles DST correctly |

**Max alert latency:** up to 44 minutes (15-min grace + up to 29-min polling window).

---

## Related Documentation

- [`docs/plans/2026-03-24-001-feat-late-provider-admin-alerts-plan.md`](../plans/2026-03-24-001-feat-late-provider-admin-alerts-plan.md) — Full design spec with acceptance criteria
- [`docs/brainstorms/2026-03-24-late-provider-admin-alerts-brainstorm.md`](../brainstorms/2026-03-24-late-provider-admin-alerts-brainstorm.md) — Approach exploration (Scheduled CF chosen over Cloud Tasks)
- [`docs/solutions/database-issues/firestore-query-patterns-for-admin-list-views.md`](../database-issues/firestore-query-patterns-for-admin-list-views.md) — Parallel fan-out reads, batch write chunking

## Pending Work

- `todos/018` (P2) — Race condition: concurrent invocations may produce duplicate pushes; fix with `create()` precondition semantics
- `todos/019` (P2) — Extract orchestration logic to `lateProviderOrchestration.ts` (mirrors `cleanupLogic.ts` pattern)
- `todos/020` (P2) — Add `LatenessAlert` type to `src/lib/firebase/types.ts`
- `todos/021` (P2) — Add `manageAdminAlertSubscription` callable for agent-native push management
- `todos/022` (P3) — Simplifications: remove `adminCount` update batch, unexport `parseStartTimeMinutes`, remove optional `graceMinutes`, replace `formatTime` with `Intl.DateTimeFormat`
- `todos/023` (P3) — Move `LATE_PROVIDER_GRACE_MINUTES` to Firestore config document
