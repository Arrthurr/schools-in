# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Next.js 14 PWA with Firebase backend for school provider check-in/out via geofencing. Static export (`output: "export"`) hosted on Firebase Hosting.

**Live URL**: https://schools-in-check.web.app

## Commands

| Task | Command |
|------|---------|
| Dev | `npm run dev` |
| Dev + emulators | `npm run dev:firebase` |
| Build | `npm run build` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Unit tests | `npm test` |
| Unit tests (watch) | `npm run test:watch` |
| Single test file | `npm test -- path/to/file.test.ts` |
| E2E tests | `npm run test:e2e` |
| E2E headless | `npm run test:e2e:headless` |
| Cloud Functions tests | `cd functions && npm test` |
| Firestore rules tests | `npm run test:firestore-rules` |
| Storage rules tests | `npm run test:storage-rules` |

> **Critical**: Always run `npx tsc --noEmit` before committing. The `next build` command enforces type checking.

## Architecture

See [`docs/agents/architecture.md`](docs/agents/architecture.md) for the full reference. Key points:

### Layers

- **`src/app/`** — Next.js App Router pages (login, dashboard, admin, profile, provider)
- **`src/components/`** — React components; UI primitives in `src/components/ui/` (shadcn/ui)
- **`src/lib/services/`** — Service layer (Firestore operations, business logic)
- **`src/lib/hooks/`** — Custom React hooks (auth, geofencing, offline, caching)
- **`src/lib/firebase/`** — Firebase SDK init and all shared TypeScript types (`types.ts`)
- **`src/lib/utils/`** — Pure utilities (geo, time, CSV, logging)
- **`src/lib/offline/`** — Offline support (IndexedDB, sync manager, offline queue)
- **`src/lib/cache/`** — Multi-layer caching (Memory → Session → Local → IndexedDB)
- **`functions/src/`** — Firebase Cloud Functions (session management, M365 sync, scheduled jobs)

### Key Constraints

- All routes must be compatible with `output: "export"` — no runtime server rendering
- `Location.assignedProviders[]` is the single source of truth for provider-location RBAC
- All types are defined in `src/lib/firebase/types.ts`
- Default timezone: `America/Chicago` — use `getDayKey()` from `src/lib/utils/time.ts`

### Geofencing

4-tier adaptive detection strategy (`useGeofenceStrategy.ts`): `periodic-sync` (Chrome) → `visibility-wakelock` (Safari iOS) → `visibility-polling` (Firefox) → `manual-only` fallback. Default geofence radius: 300 m.

### Session Lifecycle

Check-in (`startSession` Cloud Function) → active session → warning push at 8h 30m → auto-close at 9h (`cleanupStaleSessions` scheduled every 30 min).

### Offline Queue

`actionQueue.ts` → `queueManager.ts` → `syncManager.ts`. Online: calls Cloud Functions directly. Offline: queues to IndexedDB, replays on reconnection via `useConnectivityRestoration`.

## Code Conventions

See [`docs/agents/code-style.md`](docs/agents/code-style.md) for full details. Key rules:

- Use `@/` alias for all `src/` imports; group external imports before internal
- Use `cn()` (clsx + tailwind-merge) for className merging
- Use `appLogger` from `@/lib/logging/appLogger` instead of `console.log`; use `logger` from `firebase-functions` in Cloud Functions
- Prefer cached hooks (`useCachedAuth`, `useCachedSession`) over uncached alternatives
- Use `OptimizedImage` or `LazyImage` instead of raw `<img>` tags
- Use `locationService` for all location operations
- For long-lived closures that read state (timers, toasts), use a ref that shadows the state to avoid stale closures

## Firebase

See [`docs/agents/firebase.md`](docs/agents/firebase.md) for emulator ports, deploy commands, rollback, rules, and environment variables.

Emulator ports: Auth 9099 | Functions 5001 | Firestore 8080 | Hosting 5000

## Testing

See [`docs/agents/testing.md`](docs/agents/testing.md) for coverage requirements and performance targets.

Coverage thresholds: 70% branches, 58% functions, 68% lines/statements.
