---
status: done
priority: p2
issue_id: "010"
tags: [code-review, performance, reliability]
dependencies: []
---

# markAllAsRead Missing Firestore Batch Size Guard

## Problem Statement

`useNotifications.ts` `markAllAsRead` queries all unread notifications and updates them in a single `writeBatch`. Firestore batches are limited to 500 operations. If an admin accumulates >500 unread notifications, this will throw a runtime error.

## Proposed Solutions

Chunk the batch into groups of 500:
```typescript
const BATCH_LIMIT = 500;
for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
  const batch = writeBatch(db);
  snapshot.docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `markAllAsRead` handles >500 unread notifications without error

## Resources

- `src/lib/hooks/useNotifications.ts` lines 95-107
