---
status: done
priority: p2
issue_id: "004"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Pervasive `any` Usage in New Code — Type Safety Violations

## Problem Statement

The PR introduces `any` types in multiple new interfaces and function signatures, particularly for Firestore timestamp fields and Cloud Function request/response types. This undermines TypeScript's type safety guarantees.

## Findings

Locations of `any` usage:
- `AdminSessionNotes.tsx` lines 42-47: `startTime: any`, `endTime?: any`, `notesUpdatedAt?: any`, `updatedAt?: any`
- `AdminSessionNotes.tsx`: `formatDate(timestamp: any)`, `formatTimeAgo(timestamp: any)`
- `SessionNotesList.tsx` lines 27-31: same timestamp `any` pattern
- `useNotifications.ts` line 28: `createdAt: any`
- `useSession.ts`: `endPayload: Record<string, any>`
- `actionQueue.ts`: `payload: Record<string, any>`, `(response as any)?.data` casts
- `queueManager.ts`: `Record<string, any>` pattern
- `functions/src/index.ts`: `request: any` instead of `CallableRequest`

## Proposed Solutions

### Option A: Define proper types (Recommended)
1. Define `FirestoreTimestamp` type: `Timestamp | { toDate(): Date } | Date | string`
2. Define `EndSessionPayload` interface with proper fields
3. Use `httpsCallable<Input, Output>` generic for typed responses
4. Type Cloud Function request as `CallableRequest`
5. Replace local `SessionNote`/`SessionWithNote` interfaces with proper types from `types.ts`

- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] No new `any` types in PR (excluding pre-existing code)
- [ ] Timestamp fields use a proper type alias
- [ ] Cloud Function request/response properly typed
- [ ] `npx tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-23 | Created from code review | TypeScript Reviewer identified systemic pattern |

## Resources

- PR #95
- `src/lib/firebase/types.ts` — canonical type definitions
