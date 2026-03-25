---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, simplification, cloud-functions]
---

## Problem Statement

Several minor simplification opportunities in the `checkLateProviders` implementation:

1. **`adminCount` update batch** (lines 1305–1317): Second batched write to update dedup docs with final `adminCount` after push. This field is not read anywhere — it's YAGNI. Costs an extra Firestore write batch per run.
2. **`parseStartTimeMinutes` export**: Used only by `isScheduleLate` internally and in tests. No production caller outside the module needs it. Widening the public API surface without a consumer.
3. **`graceMinutes` parameter on `isScheduleLate`**: Default param signals flexibility that has no current use. All callers pass `LATE_PROVIDER_GRACE_MINUTES` anyway.
4. **`formatTime` inner function in `buildLatenessNotificationBody`**: Hand-rolled 12-hour formatter that `Intl.DateTimeFormat` can handle with zero edge cases.

## Proposed Solutions

Remove the `adminCount` update batch unless a concrete consumer (dashboard query, report) exists. Remove the `graceMinutes` parameter and export from `parseStartTimeMinutes`. Replace `formatTime` with `Intl`.

Effort: Small (~30 LOC reduction)

## Acceptance Criteria

- [ ] `adminCount` update batch removed (or a concrete read path documented)
- [ ] `parseStartTimeMinutes` unexported (or renamed to indicate it's internal)
- [ ] `graceMinutes` parameter removed from `isScheduleLate`
- [ ] All tests still pass after simplification

## Work Log

- 2026-03-25: Identified by code-simplicity reviewer in ce-review of PR #101
