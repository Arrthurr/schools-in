---
review_agents:
  - compound-engineering:review:kieran-typescript-reviewer
  - compound-engineering:review:security-sentinel
  - compound-engineering:review:performance-oracle
  - compound-engineering:review:code-simplicity-reviewer
---

This is a Next.js 14 PWA with Firebase backend. Key context for reviews:
- Static export (`output: "export"`) — no server-side rendering
- Firebase Firestore for data, Cloud Functions for business logic
- Composite Firestore indexes must be deployed separately
- Use `appLogger` not `console.log`
- All types in `src/lib/firebase/types.ts`
