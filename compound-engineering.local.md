---
review_agents:
  - compound-engineering:review:kieran-typescript-reviewer
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:performance-oracle
  - compound-engineering:review:architecture-strategist
  - compound-engineering:review:code-simplicity-reviewer
---

## Project Context for Review Agents

This is a **Next.js 14 PWA** with a **Firebase backend** (Firestore, Auth, Cloud Functions, Hosting).

Key conventions:
- Static export (`output: "export"`) — no SSR
- All types defined in `src/lib/firebase/types.ts`
- Cloud Functions in `functions/src/` (Node 20, TypeScript)
- Default timezone: `America/Chicago` — use `getDayKey()` or `Intl.DateTimeFormat`
- `Location.assignedProviders[]` is the single source of truth for provider-location RBAC
- Use `appLogger` not `console.log` in client code; use `logger` from `firebase-functions` in Cloud Functions
- Sessions: `status in ["active", "paused", "completed"]`

Review focus for Cloud Functions PRs:
- Firestore read/write efficiency (N+1 queries, missing indexes)
- Idempotency of scheduled functions
- Push notification failure handling (stale subscriptions)
- TypeScript strictness and type safety
