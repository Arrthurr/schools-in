# AGENTS.md - schools-in

Next.js 14 PWA with Firebase backend for school check-in/out via geofencing. Static export to Firebase Hosting.

**Live URL**: https://schools-in-check.web.app

## Essential Commands

| Task | Command |
|------|---------|
| Dev | `npm run dev` |
| Dev + emulators | `npm run dev:firebase` |
| Build | `npm run build` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Test | `npm test` |
| Test watch | `npm run test:watch` |
| E2E | `npm run test:e2e` |
| E2E headless | `npm run test:e2e:headless` |
| Functions test | `cd functions && npm test` |
| Firestore rules | `npm run test:firestore-rules` |
| Storage rules | `npm run test:storage-rules` |

> **Critical**: Always run `npx tsc --noEmit` before committing. The `next build` command enforces type checking.

## Key Business Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Default geofence radius | 300 m | `locationData.radiusMeters \|\| 300` |
| Session timeout | 9 hours | Auto-closed by `cleanupStaleSessions` |
| Timeout warning | 8h 30m | Push notification sent to user |
| Cleanup schedule | Every 30 min | Scheduled Cloud Function |
| Default timezone | America/Chicago | Used for `dayKey` generation |

## Static Export Constraint

All routes must be compatible with `output: "export"` — no runtime server rendering.

## Domain-Specific Guides

- [Architecture & Key Utilities](docs/agents/architecture.md) — project structure, services, hooks, data model, cloud functions
- [Code Style](docs/agents/code-style.md) — imports, components, naming, logging, patterns
- [Firebase](docs/agents/firebase.md) — emulators, deploy, rollback, rules, collections, env vars
- [PWA](docs/agents/pwa.md) — service worker, meta tags, capabilities, push notifications
- [Testing](docs/agents/testing.md) — coverage requirements, test commands
