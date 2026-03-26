---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, architecture, cloud-functions]
---

## Problem Statement

`checkLateProviders` has a race condition: the dedup check (step 1 per schedule) and the dedup write (after all eligibility checks complete) are separated by the full duration of the `Promise.all` eligibility fan-out. If Cloud Scheduler fires the function twice concurrently (at-least-once semantics), both invocations pass the dedup check simultaneously and both send push notifications to all admins — doubling alert noise.

A secondary race exists within a single invocation: a provider who checks in after the session query at step 5 but before the dedup write will still receive an alert.

## Findings

- **File**: `functions/src/index.ts` — `checkLateProviders` orchestration
- **Source**: Performance oracle (P1) and Architecture reviewer (P1)
- Cloud Scheduler guarantees **at-least-once delivery**, not exactly-once
- The dedup batch write happens ~seconds after the dedup reads complete

## Proposed Solutions

### Option A — Firestore transaction per schedule (Recommended)
Use `db.runTransaction()` to atomically read + conditionally write each dedup doc. If the doc already exists, skip. This shrinks the race window to near-zero.

- Pros: Correct, idiomatic Firestore pattern
- Cons: Transactions have a 10-second limit; limits parallelism across schedules
- Effort: Medium

### Option B — `set()` with `{exists: false}` precondition
Use `db.collection("latenessAlerts").doc(dedupId).create(data)` (or equivalent precondition). Catch the already-exists error and treat it as a dedup hit.

- Pros: Simpler than full transaction; still atomic per document
- Cons: Requires error handling for each write; slightly more verbose
- Effort: Small

### Option C — Accept the race (current state)
At school-district scale, concurrent invocations are rare. The worst outcome is a duplicate alert.

- Pros: No code change
- Cons: Admins receive duplicate alerts; degrades trust in the system over time
- Effort: None

## Recommended Action

Option B — `create()` semantics on the dedup write, combined with moving the write earlier (before or during the eligibility check loop rather than after all checks complete).

## Acceptance Criteria

- [ ] Concurrent invocations of `checkLateProviders` do not produce duplicate push notifications
- [ ] A provider who checks in during the eligibility window does not receive an alert on that run
- [ ] Tests cover the concurrent-invocation scenario (mock the dedup doc write to fail and verify no push is sent)

## Work Log

- 2026-03-25: Identified by performance oracle and architecture reviewer in ce-review of PR #101
