---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, architecture, cloud-functions, testing]
---

## Problem Statement

`checkLateProviders` embeds 250+ lines of orchestration logic directly in `functions/src/index.ts`, violating the established pattern where every other scheduled function of equivalent complexity has its logic extracted into a dedicated module:

- `cleanupStaleSessions` → `cleanupLogic.ts`
- `startSession`/`endSession` → `sessionLifecycle.ts`

The eligibility loop, dedup batch write, and admin fan-out cannot be unit-tested without a Firebase Admin SDK mock. Currently only the five pure helpers in `lateProviderLogic.ts` are tested in isolation.

## Findings

- **File**: `functions/src/index.ts` lines 1069–1323
- **Pattern to follow**: `functions/src/cleanupLogic.ts`
- **Source**: Architecture reviewer (P1 by convention-violation severity)

## Proposed Solution

Extract a `functions/src/lateProviderOrchestration.ts` module containing:
- `buildEligibleLateProviders(db, lateSchedules, todayDateKey, nowMinutes)` — eligibility loop
- `writeLatenessAlertBatch(db, lateProviders, now)` — dedup batch write
- `dispatchAdminPushAlerts(db, lateProviders, notificationBody)` — fan-out + subscription cleanup

`index.ts` becomes the thin wiring layer: call `onSchedule` and delegate.

## Acceptance Criteria

- [ ] `functions/src/lateProviderOrchestration.ts` exists with extracted functions
- [ ] Unit tests cover eligibility filtering, dedup hit, location inactive, provider disabled, active session suppression
- [ ] `functions/src/index.ts` `checkLateProviders` body is ≤50 lines of wiring
- [ ] All 230 existing tests still pass

## Work Log

- 2026-03-25: Identified by architecture reviewer in ce-review of PR #101
