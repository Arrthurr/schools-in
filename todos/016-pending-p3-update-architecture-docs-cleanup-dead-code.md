---
status: done
priority: p3
issue_id: "016"
tags: [code-review, documentation, cleanup]
dependencies: []
---

# Update Architecture Docs and Clean Up Dead Feedback Code

## Problem Statement

1. `docs/agents/architecture.md` still references `feedbackService.ts` in Key Services and `notifyOnFeedback` in Cloud Functions — both removed by this PR.
2. The `notifyOnFeedback` Cloud Function trigger may still exist in `functions/src/index.ts` (needs verification).
3. Architecture doc should add `updateSessionNote` to Cloud Functions table, `useNotifications` to Key Hooks, and `AppNotification` to Data Model.

## Proposed Solutions

1. Check if `notifyOnFeedback` exists in `functions/src/index.ts` — remove if present
2. Update `docs/agents/architecture.md` to reflect the new state
3. Update `docs/feedback-system.md` to note the system was replaced

- **Effort:** Small
- **Risk:** Low

## Resources

- `docs/agents/architecture.md`
- `docs/feedback-system.md`
- Learnings Researcher flagged dead code concern
