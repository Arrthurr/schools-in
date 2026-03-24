---
status: done
priority: p1
issue_id: "018"
tags: [code-review, quality, logging, pr-97]
dependencies: []
---

# `loadNames` Silent `.catch(() => {})` Must Log via `appLogger`

## Problem Statement

`AdminSessionNotes.tsx` line 159 swallows name-hydration failures completely silently:

```typescript
loadNames(newSessions).catch(() => {});
```

The CLAUDE.md convention is explicit: use `appLogger` from `@/lib/logging/appLogger` instead of `console.log` for all logging. When `loadNames` fails (e.g., a security rules regression on the `users` or `locations` collections), the table permanently shows "Loading..." in every name cell with zero operational signal. An admin seeing this has no way to know whether names are still loading or permanently broken.

**Why it blocks merge:** This violates the project's explicit logging convention.

## Findings

- **TypeScript Reviewer:** Flagged as BLOCK. Swallowing the rejection with `.catch(() => {})` violates the project's logging convention. "If `loadNames` throws, the table will permanently show 'Loading...' for every name cell with no trace of why."
- **Security Sentinel:** Flagged as Low severity — `loadNames` issues queries against `users` (admin-only) and `locations` (admin + scoped provider). A rules regression that silently starts denying these queries would be invisible.
- **Performance Oracle:** Confirmed the `.catch(() => {})` pattern is functionally correct for keeping sessions visible but leaves admins with permanent "Loading..." cells and no diagnostic signal.
- **Learnings Researcher:** Confirmed — documented pattern: "For fire-and-forget async calls in React, ensure unhandled rejections are caught — even a `.catch(err => appLogger.error(...))` suffix is sufficient to prevent silent failures."

## Proposed Solutions

### Option A: Log as warning (Recommended)
```typescript
// Load display names after sessions are shown — failure here is non-fatal
loadNames(newSessions).catch((err) => {
  appLogger.warn("AdminSessionNotes: failed to hydrate display names", { err });
});
```
- **Pros:** Correct convention; non-fatal; gives operational signal; one-line change
- **Cons:** None
- **Effort:** Small
- **Risk:** None

### Option B: Log as error
Same as A but `appLogger.error` — appropriate if display name resolution is considered critical.
- **Pros:** Higher-visibility log
- **Cons:** May create noise for transient failures; names are decorative
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A — use `appLogger.warn`. Display names are non-critical decoration; a warning is the right severity.

## Technical Details

- **File:** `src/components/admin/AdminSessionNotes.tsx:159`
- **Import needed:** `appLogger` from `@/lib/logging/appLogger` (check if already imported)

## Acceptance Criteria

- [ ] `loadNames(newSessions).catch((err) => appLogger.warn(..., { err }))` in place
- [ ] `appLogger` imported at top of file
- [ ] Tests pass (`npm test`)
- [ ] TypeScript clean (`npx tsc --noEmit`)

## Work Log

- 2026-03-24: Identified by TypeScript reviewer (BLOCK) and Security Sentinel (Low) during PR #97 review
