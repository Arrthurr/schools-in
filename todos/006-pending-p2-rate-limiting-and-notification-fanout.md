---
status: done
priority: p2
issue_id: "006"
tags: [code-review, security, performance, cloud-functions]
dependencies: []
---

# No Rate Limiting on updateSessionNote + Unbounded Admin Notification Fan-out

## Problem Statement

Two related issues in the `updateSessionNote` Cloud Function:

1. **No rate limiting:** A compromised provider account could spam note updates, generating unbounded Firestore writes, admin notifications, and push notification attempts.

2. **Sequential admin fan-out:** The function queries ALL admin users, then for EACH admin sequentially reads push subscriptions and creates notification docs. This scales linearly with admin count and amplifies the cost of each invocation.

## Proposed Solutions

### Rate limiting
Add a cooldown check: reject if `notesUpdatedAt` is within the last 10 seconds for the same session. Simple, no extra infrastructure needed.

### Fan-out optimization
1. Parallelize push subscription reads with `Promise.all` instead of sequential loop
2. Parallelize location doc + admin query reads (they're independent)
3. Consider notification deduplication: update existing unread notification for same session instead of creating new ones

- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [ ] Rate limiting prevents >6 note updates per session per minute
- [ ] Push subscription reads parallelized
- [ ] Independent Firestore reads parallelized (location + admins)
- [ ] Cloud Function latency reduced for multi-admin scenarios

## Resources

- `functions/src/index.ts` — updateSessionNote function, lines 1570-1640
