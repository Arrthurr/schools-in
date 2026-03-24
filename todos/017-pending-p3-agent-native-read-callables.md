---
status: done
priority: p3
issue_id: "017"
tags: [code-review, agent-native, architecture]
dependencies: []
---

# No Agent-Accessible Read Callables for Admin Operations

## Problem Statement

The write path (updateSessionNote, endSession with notes) is fully agent-accessible via Cloud Functions. However, the read/query path (admin list all notes, view notifications, mark as read) is entirely embedded in React components with direct Firestore queries. An agent acting on behalf of an admin has no clean API for these operations.

Agent-native score: 3/10 UI capabilities have full callable API parity.

## Proposed Solutions

1. Add a `getSessionNotes` callable CF with role-based access, pagination, and denormalized data
2. Add a `markNotificationsRead` callable or document the Firestore path as a stable agent contract
3. Document Cloud Functions as an agent API surface with input/output schemas

- **Effort:** Large
- **Risk:** Low

## Resources

- Agent-Native Reviewer report
- `functions/src/index.ts` — existing callable patterns
