---
status: done
priority: p2
issue_id: "005"
tags: [code-review, performance, architecture]
dependencies: []
---

# N+1 Queries and Stale Closures in AdminSessionNotes Name Loading

## Problem Statement

`AdminSessionNotes.tsx` issues individual `getDoc` calls for each unique userId and locationId in the page results. With 25 sessions across 15 providers and 10 locations, that's 25+ extra Firestore reads per page load. Additionally, `loadUserName`/`loadLocationName` have stale closure risk — their `useCallback` deps include the name state maps, causing recreation on every name load, and the early-return guard can miss concurrent lookups for the same ID.

## Proposed Solutions

### Option A: Batched queries with ref-based cache (Recommended)
1. Collect all unique userIds and locationIds from page results
2. Batch fetch using `where(documentId(), "in", [...])` (max 30 per batch)
3. Use `useRef` for name caches to avoid stale closures
- **Effort:** Medium
- **Risk:** Low

### Option B: Use existing cached services
Route lookups through `cachedUserService`/`cachedSchoolService` from the service layer.
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Name lookups batched (max 2 queries per page: one for users, one for locations)
- [ ] No stale closure risk in name loading callbacks
- [ ] Page load Firestore reads reduced by ~80%

## Resources

- `src/components/admin/AdminSessionNotes.tsx` lines 67-95
