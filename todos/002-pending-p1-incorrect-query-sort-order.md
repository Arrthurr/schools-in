---
status: done
priority: p1
issue_id: "002"
tags: [code-review, architecture, ux, firestore]
dependencies: ["001"]
---

# Admin Session Notes Query Sorts Alphabetically by Note Text, Not by Recency

## Problem Statement

The `AdminSessionNotes` query uses `where("notes", "!=", "")` which forces `orderBy("notes")` as the primary sort (Firestore requirement: inequality filter field must be the first orderBy). This means results are sorted alphabetically by note content, not by `updatedAt`. The secondary `orderBy("updatedAt", "desc")` only sorts within groups of identical note text — effectively useless.

Admins expect to see the most recently updated notes first.

**Why it matters:** The admin notes view displays notes in a confusing, non-chronological order, making it hard to find recent submissions.

## Findings

- **TypeScript Reviewer:** "An admin viewing Session Notes almost certainly expects chronological ordering."
- **Performance Oracle:** Confirmed Firestore limitation forces this behavior.
- **Architecture Strategist:** Recommended `hasNotes` boolean approach to decouple filtering from sorting.

## Proposed Solutions

### Option A: Client-side sort (Quick fix)
Keep the query as-is but sort results client-side by `updatedAt` after fetching.
- **Pros:** No index or schema changes needed
- **Cons:** Pagination breaks — you can't reliably paginate when the server sort doesn't match the display sort
- **Effort:** Small
- **Risk:** Medium (pagination correctness)

### Option B: `hasNotes` boolean field (Recommended — combined with Finding 001)
See Finding 001 Option B. Query becomes `where("hasNotes", "==", true), orderBy("updatedAt", "desc")`.
- **Pros:** Correct sort order with proper pagination
- **Cons:** Requires adding a field to session docs via Cloud Function
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option B — combined with Finding 001.

## Technical Details

- **Affected files:** `src/components/admin/AdminSessionNotes.tsx` lines 112-118
- **Related to:** Finding 001 (missing composite index)

## Acceptance Criteria

- [ ] Admin notes page shows notes sorted by most recently updated first
- [ ] Pagination works correctly with the new sort order
- [ ] "Load more" loads the next chronological batch

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-23 | Created from code review | Firestore requires inequality filter field as first orderBy |

## Resources

- PR #95
- `src/components/admin/AdminSessionNotes.tsx` lines 112-118
