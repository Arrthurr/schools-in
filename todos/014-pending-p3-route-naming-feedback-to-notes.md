---
status: done
priority: p3
issue_id: "014"
tags: [code-review, architecture, naming]
dependencies: []
---

# Route Still Named /admin/feedback and /provider/feedback Instead of /notes

## Problem Statement

The routes `/admin/feedback` and `/provider/feedback` now serve session notes content, not feedback. The `NotificationBell` links to `/admin/feedback` and push notification URLs use this path. This is a naming inconsistency that could confuse users with bookmarks.

## Proposed Solutions

Rename routes to `/admin/notes` and `/provider/notes` (or `/admin/session-notes`). Consider a redirect from old paths if bookmarks are a concern.

- **Effort:** Medium (file renames + URL updates)
- **Risk:** Low

## Resources

- `src/app/admin/feedback/page.tsx`
- `src/app/provider/feedback/page.tsx`
- `src/components/ui/NotificationBell.tsx` lines 97, 136
