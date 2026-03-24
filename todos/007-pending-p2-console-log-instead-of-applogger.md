---
status: done
priority: p2
issue_id: "007"
tags: [code-review, conventions, logging]
dependencies: []
---

# console.log/console.error Used Instead of appLogger

## Problem Statement

CLAUDE.md mandates: "Use `appLogger` from `@/lib/logging/appLogger` instead of `console.log`." New code in this PR uses raw `console.*` calls in multiple files.

## Findings

Affected files:
- `src/lib/hooks/useNotifications.ts` — `console.error` in listener error handler
- `src/lib/hooks/useSession.ts` — `console.error` in updateNote callback
- `src/lib/offline/actionQueue.ts` — `console.log` and `console.error` in syncUpdateNote/queueUpdateNote
- `src/lib/offline/queueManager.ts` — `console.log` in updateNote method

## Proposed Solutions

Replace all `console.*` calls with `appLogger` equivalents. Straightforward find-and-replace.

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No `console.log` or `console.error` in new code
- [ ] All logging uses `appLogger`

## Resources

- `src/lib/logging/appLogger.ts`
