# CLAUDE.md - schools-in

This document provides essential context for AI assistants working on this codebase.

## Project Overview

**schools-in** is a Next.js 14 Progressive Web App (PWA) for school check-in/out management using geofencing. Providers can check in/out at assigned school locations based on GPS proximity.

**Live URL**: https://schools-in-check.web.app

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 with App Router |
| Output | Static export (`output: "export"`) to Firebase Hosting |
| Database | Firebase Firestore |
| Auth | Microsoft Authentication with role-based access |
| PWA | Serwist (`@serwist/next`) |
| Maps | `@vis.gl/react-google-maps` |
| UI | Radix UI + Tailwind CSS + shadcn/ui |
| Forms | react-hook-form + zod |
| Testing | Jest + Cypress + Lighthouse CI |

## Critical Constraints

### Static Export

All routes must be compatible with `output: "export"`. No runtime server rendering is available.

### Type Checking

**IMPORTANT**: Always run `npx tsc --noEmit` before committing. The `next build` command enforces type checking (`ignoreBuildErrors: false`).

### Node Version

- Main project: Node 18.17+
- Firebase Functions: Node 20 required

## Essential Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Dev + Firebase emulators | `npm run dev:firebase` |
| Build | `npm run build` |
| **Typecheck** | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Lint + fix | `npm run lint:fix` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |
| E2E headless | `npm run test:e2e:headless` |
| Firestore rules tests | `npm run test:firestore-rules` |
| Storage rules tests | `npm run test:storage-rules` |
| Lighthouse | `npm run lighthouse:local` |
| Bundle analyzer | `npm run analyze` |

### Firebase Commands

```bash
npm run firebase:emulators       # Start all emulators
npm run firebase:deploy          # Deploy everything
npm run firebase:deploy:hosting  # Deploy hosting only
npm run firebase:deploy:rules    # Deploy Firestore/Storage rules
npm run firebase:rollback        # Interactive rollback
```

### Firebase Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Functions | 5001 |
| Firestore | 8080 |
| Hosting | 5000 |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard pages
│   ├── dashboard/          # Provider dashboard
│   ├── provider/           # Provider-specific pages
│   ├── profile/            # User profile
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   └── sw.ts               # Service Worker source
├── components/
│   ├── admin/              # Admin UI components
│   ├── auth/               # Authentication components
│   ├── common/             # Shared components
│   ├── dashboard/          # Dashboard widgets
│   ├── feedback/           # Feedback system
│   ├── layout/             # Layout components
│   ├── maps/               # Google Maps components
│   ├── offline/            # Offline indicators
│   ├── provider/           # Provider UI components
│   ├── pwa/                # PWA install/update prompts
│   ├── schedules/          # Schedule management
│   └── ui/                 # shadcn/ui base components
├── lib/
│   ├── cache/              # Multi-layer caching utilities
│   ├── firebase/           # Firebase client, types, auth
│   ├── hooks/              # React hooks
│   ├── offline/            # Offline queue management
│   ├── pwa/                # PWA capabilities, push, sync
│   ├── services/           # Business logic services
│   └── utils/              # General utilities
├── types/                  # TypeScript type definitions
└── instrumentation.ts      # Next.js instrumentation
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/firebase/types.ts` | All Firestore document types |
| `src/lib/firebase/auth.ts` | Authentication logic |
| `src/lib/services/locationService.ts` | Location queries, distance calculations |
| `src/lib/services/cachedUserService.ts` | User operations with caching |
| `src/lib/hooks/useCachedAuth.ts` | Auth hook with caching |
| `src/lib/hooks/useCachedSession.ts` | Session management |
| `src/lib/hooks/useAutoGeofenceCheck.ts` | Geofence detection loop |
| `firestore.rules` | Firestore security rules |
| `storage.rules` | Firebase Storage security rules |

## Data Model

### Core Collections

| Collection | Key Fields |
|------------|------------|
| `users` | uid, role (`provider`\|`admin`), displayName, email, autoGeofenceCheckEnabled |
| `locations` | id, name, address, geo (GeoPoint), radiusMeters, assignedProviders[] |
| `sessions` | userId, locationId, startTime, endTime, status, checkInMethod, dayKey |
| `services` | id, name, code, isActive |
| `schedules` | providerId, locationId, serviceId, dayOfWeek, startTime, endTime |
| `feedback` | providerId, category, severity, description, status |

### Key Pattern

`Location.assignedProviders[]` is the **single source of truth** for provider-location assignments.

## Code Conventions

### Imports

Use `@/` alias for src imports. Group external imports before internal:

```typescript
import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { useCachedAuth } from '@/lib/hooks/useCachedAuth';
import type { User } from '@/lib/firebase/types';
```

### Component Patterns

- Use `cn()` from `@/lib/utils` for className merging (clsx + tailwind-merge)
- Prefer `OptimizedImage` or `LazyImage` over raw `<img>` tags
- Use cached hooks (`useCachedAuth`, `useCachedSession`) over uncached alternatives

### TypeScript

- Strict mode enabled
- Export types from `src/lib/firebase/types.ts`
- Prefix unused variables with underscore: `_unusedVar`

### ESLint Rules

- `no-console`: warn (avoid console.log in production code)
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: warn (underscore-prefixed allowed)
- `react-hooks/exhaustive-deps`: warn

## Architecture Patterns

### Multi-Layer Caching

Memory → Session Storage → Local Storage → IndexedDB (70-90% cache hit rates)

```typescript
// Prefer cached hooks
const { user, loading } = useCachedAuth();
const { session, checkIn, checkOut } = useCachedSession();
```

### Offline Support

- `useEnhancedOfflineQueue`: Prioritized offline action queue
- `useConnectivityRestoration`: Auto-sync when back online
- `useNetworkStatus`: Network state detection

### Geofencing Strategy

Adaptive 4-tier detection via `useGeofenceStrategy.ts`:

1. **periodic-sync** (Chrome/Android): Service Worker Periodic Background Sync
2. **visibility-wakelock** (Safari iOS): Page Visibility + Wake Lock API
3. **visibility-polling** (Firefox): Visibility-based foreground polling
4. **manual-only**: Fallback for unsupported browsers

### SSR Safety

All client-only modules initialize post-hydration. Use dynamic imports with `{ ssr: false }` for browser-only components.

## Testing Requirements

### Coverage Thresholds

70% minimum for: branches, functions, lines, statements

### Performance Targets (Core Web Vitals)

| Metric | Target |
|--------|--------|
| LCP | ≤ 2.5s |
| FID | ≤ 100ms |
| CLS | ≤ 0.1 |

### Accessibility

- Lighthouse accessibility score ≥ 95%
- WCAG 2.1 AA compliance required

## PR Checklist

Before submitting:

1. Run `npx tsc --noEmit` (typecheck)
2. Run `npm run lint` (no new warnings/errors)
3. Run `npm test` (all tests pass)
4. Test offline functionality if modifying offline code
5. Check accessibility for UI changes
6. Update Firestore rules if changing data access patterns

## Firebase Security Rules

Key rule helpers in `firestore.rules`:

- `isAuthenticated()`: User is logged in
- `isAdmin()`: User has admin role
- `isProvider()`: User has provider role
- `isOwner(userId)`: Current user owns the resource
- `isProviderAssignedToLocation(providerId, locationId)`: Provider is assigned to location

## Common Pitfalls

1. **Forgetting typecheck**: Build passes but TypeScript errors exist
2. **Server-side imports**: Using browser APIs without SSR guards
3. **Missing offline handling**: Not queuing actions for offline sync
4. **Direct Firestore access**: Use service layer instead of raw Firestore calls
5. **Uncached hooks**: Using `useAuth` instead of `useCachedAuth`
6. **Static export violations**: Using server-only Next.js features

## Related Documentation

- [Architecture](docs/agents/architecture.md)
- [Code Style](docs/agents/code-style.md)
- [Firebase](docs/agents/firebase.md)
- [PWA](docs/agents/pwa.md)
- [Testing](docs/agents/testing.md)
- [Design System](docs/design-system.md)
- [CI/CD Guide](docs/ci-cd-guide.md)
