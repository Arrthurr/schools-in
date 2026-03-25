---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, architecture, typescript]
---

## Problem Statement

The `latenessAlerts` Firestore collection schema is defined only as an inline object literal in `functions/src/index.ts`. Every other Firestore collection has a corresponding exported interface in `src/lib/firebase/types.ts` (`Session`, `Location`, `Schedule`, `User`, etc.). Without a type, any future consumer must re-infer the shape.

## Findings

- **File**: `src/lib/firebase/types.ts` (nothing added)
- **Source**: Architecture reviewer (P2)

## Proposed Solution

Add to `src/lib/firebase/types.ts`:

```ts
export interface LatenessAlert {
  scheduleId: string;
  providerId: string;
  locationId: string;
  startTime: string; // "HH:MM"
  alertedAt: Timestamp;
  adminCount: number;
  expireAt: Timestamp; // TTL field — Firestore auto-deletes after this date
}
```

Then use `LatenessAlert` in `functions/src/index.ts` when writing dedup docs.

## Acceptance Criteria

- [ ] `LatenessAlert` interface exported from `src/lib/firebase/types.ts`
- [ ] `checkLateProviders` dedup write uses the type
- [ ] TypeScript strict mode passes with no new errors

## Work Log

- 2026-03-25: Identified by architecture reviewer in ce-review of PR #101
