---
status: done
priority: p2
issue_id: "008"
tags: [code-review, architecture, conventions]
dependencies: []
---

# Direct Firestore Queries in UI Components Bypass Service/Caching Layer

## Problem Statement

`AdminSessionNotes.tsx` and `SessionNotesList.tsx` make direct Firestore queries (`getDocs`, `getDoc`) from within components. The project architecture defines a service layer (`src/lib/services/`) and caching layer (`cachedFirestore`, etc.) that should mediate all data access. `SessionNotesList` also uses the unusual `where("__name__", "==", id)` pattern instead of direct `getDoc`.

## Proposed Solutions

### Option A: Route through existing services
Use `cachedUserService` for user names, `cachedSchoolService` for location names. For session queries, create a minimal `sessionNotesService` or add methods to existing session service.

### Option B: Use direct getDoc but fix the pattern (Minimum)
At minimum, replace `where("__name__", "==", id)` with `getDoc(doc(db, COLLECTIONS.LOCATIONS, id))` in `SessionNotesList.tsx`.

- **Effort:** Medium (Option A), Small (Option B)
- **Risk:** Low

## Acceptance Criteria

- [ ] `SessionNotesList` uses `getDoc` instead of `where("__name__")` query
- [ ] Consider routing name lookups through cached services

## Resources

- `src/components/admin/AdminSessionNotes.tsx`
- `src/components/provider/SessionNotesList.tsx` lines 96-113
- `src/lib/services/` — existing service layer
