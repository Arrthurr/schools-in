# Architecture

## Stack Overview

- **Framework**: Next.js 14 with App Router, static export (`output: "export"`)
- **Hosting**: Firebase Hosting serves the `out/` directory
- **Database**: Firebase Firestore (collections: users, system, sessions, locations)
- **Auth**: Microsoft Authentication with role-based access
- **Maps**: `@vis.gl/react-google-maps` for geolocation and navigation
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **PWA**: Serwist (`@serwist/next`) — source at `src/app/sw.ts`, output at `public/sw.js`

## Caching & Offline

- **Multi-layer caching**: Memory → Session → Local → IndexedDB (70-90% hit rates)
- **SSR-safe**: All client-only modules initialize post-hydration
- **Offline queue**: `useEnhancedOfflineQueue` for prioritized offline actions
- **Connectivity restoration**: `useConnectivityRestoration` syncs when back online

## Geofencing Strategy

Adaptive 4-tier detection via `useGeofenceStrategy.ts`:

1. **periodic-sync** (Chrome/Android): Service Worker Periodic Background Sync
2. **visibility-wakelock** (Safari iOS): Page Visibility + Wake Lock API
3. **visibility-polling** (Firefox): Visibility-based foreground polling
4. **manual-only**: Fallback for unsupported browsers

## Key Services

| Service | Purpose |
|---------|---------|
| `src/lib/services/locationService.ts` | Firestore location queries, distance calculations |
| `src/lib/services/assignmentService.ts` | Admin assignment operations |
| `src/lib/services/cachedUserService.ts` | User operations with caching |

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useCachedAuth` | Auth with user data caching |
| `useCachedSession` | Session management with real-time sync |
| `useAutoGeofenceCheck` | Main geofence detection loop |
| `useGeofenceStrategy` | Capability-based strategy selector |
| `useAutoCheckoutReminder` | Countdown and toast notifications |
| `useConnectivityRestoration` | Offline-to-online syncing |
| `useEnhancedOfflineQueue` | Prioritized offline action queue |
| `useLazyLoading` | Intersection Observer-based loading |
| `useLocation` | Geolocation services |

## Key Components

### Maps
- `src/components/maps/GoogleMap.tsx` — Main map component
- `src/components/maps/LocationPicker.tsx` — Interactive location selection
- `src/components/maps/NavigationButton.tsx` — "Get Directions" functionality

### Images
- `OptimizedImage` / `OptimizedAvatar` (`src/components/ui/optimized-image.tsx`) — SSR-safe with fallbacks
- `LazyImage` (`src/components/ui/lazy-image.tsx`) — Advanced lazy loading

### PWA
- `PWAStatus` — Installation and status indicators
- `PWAInstallPrompt` — Custom install prompt
- `PWAUpdatePrompt` — Service worker update notifications

## Data Model

`Location.assignedProviders` is the single source of truth for provider-location assignments.
