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
| Firestore rules | `npm run test:firestore-rules` |
| Storage rules | `npm run test:storage-rules` |

> **Critical**: Always run `npx tsc --noEmit` before committing. The `next build` command enforces type checking.

## Static Export Constraint

All routes must be compatible with `output: "export"` — no runtime server rendering.

## Domain-Specific Guides

- [Architecture & Key Utilities](docs/agents/architecture.md) — project structure, services, hooks
- [Code Style](docs/agents/code-style.md) — imports, components, naming
- [Firebase](docs/agents/firebase.md) — emulators, deploy, rollback, rules
- [PWA](docs/agents/pwa.md) — service worker, meta tags, capabilities
- [Testing](docs/agents/testing.md) — coverage requirements, test commands
