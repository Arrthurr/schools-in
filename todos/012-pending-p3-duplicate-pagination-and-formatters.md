---
status: done
priority: p3
issue_id: "012"
tags: [code-review, simplicity, duplication]
dependencies: []
---

# Duplicate Pagination Logic and Timestamp Formatters Across Components

## Problem Statement

Three components (`AdminSessionNotes`, `SessionNotesList`, `SessionHistory`) implement nearly identical Firestore pagination with `PAGE_SIZE + 1`, `startAfter`, `hasMore` state. Three files also duplicate `formatDate`/`formatTime`/`formatTimeAgo` timestamp formatting.

## Proposed Solutions

1. Extract shared formatters to `src/lib/utils/time.ts` (already exists)
2. Consider a `usePaginatedFirestoreQuery` hook if more paginated views are planned

- **Effort:** Medium
- **Risk:** Low

## Resources

- `src/components/admin/AdminSessionNotes.tsx`
- `src/components/provider/SessionNotesList.tsx`
- `src/components/ui/NotificationBell.tsx`
- `src/lib/utils/time.ts`
