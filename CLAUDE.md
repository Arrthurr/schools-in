# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Schools-In is a PWA for education service providers to check in/out at school locations using geofencing. It supports offline functionality, real-time sync, and role-based access (providers vs admins).

## Common Commands

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run dev:firebase           # Start dev server + Firebase emulators together

# Building
npm run build                  # Production build (static export)
npm run analyze                # Build with bundle analyzer

# Testing
npm test                       # Run Jest unit tests
npm run test:watch             # Jest in watch mode
npm run test:e2e               # Cypress E2E (interactive)
npm run test:e2e:headless      # Cypress E2E (headless)
npm run test:ci                # CI mode with coverage

# Single test file
npm test -- path/to/file.test.ts
npm test -- --testNamePattern="test name"

# Linting
npm run lint                   # ESLint check
npm run lint:fix               # ESLint auto-fix

# Firebase
npm run firebase:emulators     # Start Firebase emulators (auth:9099, firestore:8080, storage:9199)
npm run firebase:deploy        # Deploy all
npm run firebase:deploy:hosting # Deploy hosting only
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router, static export
- **UI**: React 18, Radix UI primitives, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage, Functions)
- **PWA**: Serwist (service worker), IndexedDB for offline
- **Maps**: @vis.gl/react-google-maps

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Provider dashboard
│   ├── admin/              # Admin pages (users, schools, reports)
│   └── provider/           # Provider-specific pages
├── components/
│   ├── ui/                 # Radix/shadcn primitives
│   ├── maps/               # Google Maps components
│   ├── pwa/                # PWA prompts and status
│   └── [feature]/          # Feature-specific components
└── lib/
    ├── firebase/           # Firebase config, auth, Firestore utils
    ├── hooks/              # Custom React hooks (auth, geofence, offline, cache)
    ├── services/           # Business logic (user, location, session, feedback)
    ├── cache/              # Multi-layer caching (memory → session → local → IndexedDB)
    └── offline/            # Offline queue and sync
```

### Data Model (Firestore Collections)
- **users**: `uid`, `role` (provider|admin), `displayName`, `email`, `autoGeofenceCheckEnabled`
- **locations**: `name`, `address`, `geo` (GeoPoint), `radiusMeters`, `assignedProviders[]`
- **sessions**: `userId`, `locationId`, `startTime`, `endTime`, `status`, `checkInMethod`, `dayKey`
- **feedback**: `providerId`, `category`, `severity`, `description`, `status`
- **services**: `name`, `code`, `isActive`
- **schedules**: `providerId`, `locationId`, `serviceId`, `dayOfWeek`, `startTime`, `endTime`

### Key Patterns

**Path alias**: Use `@/` for imports from `src/` (e.g., `@/lib/hooks/useAuth`)

**Caching**: Use cached versions of hooks and services:
- `useCachedAuth` instead of `useAuth` for auth state
- `CachedSchoolService`, `CachedUserService` for data fetching
- Multi-layer cache: memory (5-30min) → session → local → IndexedDB

**Geofencing**: Four-tier strategy detection in `useGeofenceStrategy.ts`:
1. Periodic Sync (Chrome/Android)
2. Visibility + Wake Lock (Safari iOS)
3. Visibility polling (Firefox)
4. Manual fallback

**Offline**: Operations queued in IndexedDB, synced when online via `useOfflineQueue`

## Code Style

- Primary brand color: `#154690` - use `bg-primary`, `text-primary` Tailwind classes
- Status colors: `status-active` (green), `status-completed` (primary), `status-paused` (yellow), `status-error` (red)
- Use Radix UI components from `@/components/ui/`
- Forms: React Hook Form + Zod validation
- Dates: Use `date-fns` and `America/Chicago` timezone for session `dayKey`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=schools-in-check.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=schools-in-check
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_DISABLE_AUTH=true|false  # For local development
```

## Testing

- Jest config: 70% coverage threshold
- Test files: `*.test.ts` or `*.spec.ts` alongside source files
- Use `@testing-library/react` for component tests
- E2E: Cypress tests in `cypress/e2e/`
- Firebase rules tests: `npm run test:firestore-rules`
