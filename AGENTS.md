# AGENTS.md - schools-in

Next.js 14 PWA with Firebase backend for school check-in/out via geofencing. Static export to Firebase Hosting.

## Essential Commands

| Task | Command |
|------|---------|
| Dev | `npm run dev` |
| Dev + emulators | `npm run dev:firebase` |
| Build | `npm run build` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Test | `npm test` |
| E2E | `npm run test:e2e` |

> **Critical**: `npm run build` does NOT typecheck (`ignoreBuildErrors: true`). Always run `npx tsc --noEmit` to verify.

## Static Export Constraint

All routes must be compatible with `output: "export"` — no runtime server rendering.

## Domain-Specific Guides

- [Architecture & Key Utilities](docs/agents/architecture.md) — project structure, services, hooks
- [Code Style](docs/agents/code-style.md) — imports, components, naming
- [Firebase](docs/agents/firebase.md) — emulators, deploy, rollback, rules
- [PWA](docs/agents/pwa.md) — service worker, meta tags, capabilities
- [Testing](docs/agents/testing.md) — coverage requirements, test commands
