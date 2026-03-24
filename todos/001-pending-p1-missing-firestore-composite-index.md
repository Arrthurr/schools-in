---
status: done
priority: p1
issue_id: "001"
tags: [code-review, performance, architecture, firestore]
dependencies: []
---

# Missing Firestore Composite Index for Admin Session Notes Query

## Problem Statement

The `AdminSessionNotes` component queries sessions with `where("notes", "!=", "")` combined with `orderBy("notes")` and `orderBy("updatedAt", "desc")`. This requires a composite Firestore index on `(notes, updatedAt)` in the sessions collection. **No such index exists.** The query will throw a runtime error on the admin notes page, making the feature completely non-functional for admins.

**Why it matters:** This is a hard blocker — the admin notes page will crash on load.

## Findings

- **Performance Oracle:** Confirmed missing index in `firestore.indexes.json`. Query will fail with Firestore error linking to index creation page.
- **Architecture Strategist:** Confirmed. Also notes this is coupled with Finding 002 (sort order issue).
- **TypeScript Reviewer:** Confirmed the query pattern at `AdminSessionNotes.tsx` lines 112-118.

## Proposed Solutions

### Option A: Add composite index (Quick fix)
Add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "notes", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```
- **Pros:** Minimal code change
- **Cons:** Does NOT fix the sort order issue (Finding 002) — results still sorted alphabetically by note text
- **Effort:** Small
- **Risk:** Low

### Option B: Add `hasNotes` boolean field + simpler index (Recommended)
- Cloud Function sets `hasNotes: true` when notes are non-empty
- Query becomes `where("hasNotes", "==", true), orderBy("updatedAt", "desc")`
- Add simpler composite index on `(hasNotes, updatedAt)`
- **Pros:** Fixes both the missing index AND the sort order issue (Finding 002)
- **Cons:** Requires Cloud Function change + new field on session docs
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option B — fixes two findings at once.

## Technical Details

- **Affected files:** `firestore.indexes.json`, `functions/src/index.ts`, `src/components/admin/AdminSessionNotes.tsx`
- **Components:** AdminSessionNotes query, updateSessionNote CF, endSession CF

## Acceptance Criteria

- [ ] Admin notes page loads without Firestore index errors
- [ ] Notes are displayed in chronological order (most recent first)
- [ ] Composite index deployed to Firestore

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-23 | Created from code review | Identified by Performance Oracle, Architecture Strategist, TypeScript Reviewer |

## Resources

- PR #95: feat: provider session notes with admin notifications
- `src/components/admin/AdminSessionNotes.tsx` lines 112-118
- `firestore.indexes.json`
