# Architecture

## Stack Overview

- **Framework**: Next.js 14 with App Router, static export (`output: "export"`)
- **Hosting**: Firebase Hosting serves the `out/` directory
- **Database**: Firebase Firestore
- **Auth**: Microsoft 365 group-based authentication with role-based access (`provider` / `admin`)
- **Cloud Functions**: Firebase Cloud Functions (Node 20) for session management, M365 sync, scheduled jobs
- **Maps**: `@vis.gl/react-google-maps` for geolocation and navigation
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **Forms**: react-hook-form + zod validation
- **PWA**: Serwist (`@serwist/next`) — source at `src/app/sw.ts`, output at `public/sw.js`

## Caching & Offline

- **Multi-layer caching**: Memory → Session → Local → IndexedDB (70-90% hit rates)
- **SSR-safe**: All client-only modules initialize post-hydration
- **Offline queue**: `actionQueue` → `queueManager` → `syncManager` pipeline for prioritized offline actions
- **Connectivity restoration**: `useConnectivityRestoration` syncs when back online
- **Cache TTLs** (configurable via env vars):
  - Short: 5 min (`NEXT_PUBLIC_CACHE_TTL_SHORT`)
  - Medium: 30 min (`NEXT_PUBLIC_CACHE_TTL_MEDIUM`)
  - Long: 2 hr (`NEXT_PUBLIC_CACHE_TTL_LONG`)

## Geofencing

### Strategy (adaptive 4-tier detection via `useGeofenceStrategy.ts`)

1. **periodic-sync** (Chrome/Android): Service Worker Periodic Background Sync
2. **visibility-wakelock** (Safari iOS): Page Visibility + Wake Lock API
3. **visibility-polling** (Firefox): Visibility-based foreground polling
4. **manual-only**: Fallback for unsupported browsers

### Key Constants (`useAutoGeofenceCheck.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| Default radius | 300 m | Geofence radius when not set on location |
| Accuracy threshold | 50 m | Minimum GPS accuracy required |
| Countdown | 15 s | Auto-check-in countdown duration |
| Near poll interval | 30 s | Poll interval within 250 m |
| Far poll interval | 90 s | Poll interval beyond 500 m |
| Cancel cooldown | 5 min | Cooldown after user cancels auto-check-in |
| Check-in grace | 60 s | Grace period after check-in before auto-checkout logic |

### Distance Calculation

Haversine formula in both client (`src/lib/utils/geo.ts`) and server (`functions/src/utils.ts`). Server-side validation enforces `distanceFromCenter <= radiusMeters`.

## Session Lifecycle

| Phase | Trigger | Status |
|-------|---------|--------|
| Check-in | `startSession` Cloud Function | `active` |
| Check-out | `endSession` Cloud Function | `completed` |
| Warning | `cleanupStaleSessions` at 8h 30m | push notification sent |
| Timeout | `cleanupStaleSessions` at 9 hr | `error` + `errorCode: "timeout_auto_close"` |

- **Session timeout**: 9 hours
- **Warning window**: 8 hours 30 minutes
- **Cleanup schedule**: Every 30 minutes
- **Offline grace**: 15 min (recently synced sessions skipped during cleanup)

## Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `startSession` | Callable | Create session with geofence validation |
| `endSession` | Callable | End session, calculate duration |
| `cleanupStaleSessions` | Scheduled (30 min) | Warn at 8h 30m, auto-close at 9h |
| `generateDailyStats` | Scheduled (02:00 daily) | Aggregate daily session statistics |
| `syncUserFromM365` | Callable | Sync roles and assignments from M365 groups |
| `requestM365Resync` | Callable | Request M365 group resync |
| `healthCheck` | Callable | Test Firestore/Auth/Storage connectivity |
| `trackCachePerformance` | Callable | Store client cache metrics |
| `trackUserActivity` | Callable | Record user activity events |
| `updateSessionNote` | Callable | Add/update session note, notify admins in-app |
| `notifyOnFeedback` | Firestore trigger | Email admins on new feedback |
| `getVapidPublicKey` | Callable | Return VAPID key for push setup |

## Key Services

| Service | Purpose |
|---------|---------|
| `locationService.ts` | Firestore location queries, distance calculations, `getCurrentLocation()` |
| `assignmentService.ts` | Admin assignment operations (add/remove providers to locations) |
| `serviceManager.ts` | Orchestrates check-in/out with offline queue integration |
| `cachedUserService.ts` | User operations with caching |
| `cachedSchoolService.ts` | Location/school data with caching |
| `cachedSessionService.ts` | Session operations with intelligent caching |
| `schoolService.ts` | Re-exports `CachedSchoolService` (backward compat) |
| `locationNormalizer.ts` | Normalizes location data formats (GeoPoint, lat/lng variations) |
| `locationValidationService.ts` | GPS coordinate validation |
| `bulkSchoolOperations.ts` | Bulk activate/deactivate/delete/update/assign |
| `userService.ts` | User data operations and role management |
| `userPreferences.ts` | User preference management (e.g. auto geofence toggle) |
| `scheduleService.ts` | Provider schedule management |
| `reportScheduleService.ts` | Report schedule CRUD |
| `serviceService.ts` | Service type/code CRUD |

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useCachedAuth` | Auth with user data caching (preferred) |
| `useAuth` | Basic Firebase auth (simpler, no caching) |
| `useSession` | Session check-in/out, real-time active session listener |
| `useCachedSession` | Session management with caching and real-time sync |
| `useAutoGeofenceCheck` | Main geofence detection loop, auto-check-in countdown, "still here?" prompt |
| `useGeofenceStrategy` | Capability-based strategy selector |
| `useAutoGeofencePreference` | Role-based preference (providers: on, admins: off) |
| `useAutoCheckoutReminder` | Countdown and toast notifications |
| `useLocation` | Geolocation services |
| `useProviderLocations` | Cache-first provider location assignments (SWR pattern) |
| `useActiveSessions` | Active sessions list for admin dashboard |
| `useNetworkStatus` | Network connectivity detection with quality metrics |
| `useConnectivityRestoration` | Offline-to-online syncing |
| `useEnhancedOfflineQueue` | Prioritized offline action queue |
| `useOfflineQueue` | Basic offline action queue operations |
| `useOffline` | Offline state and sync operations wrapper |
| `useCache` | Cache management for schools/sessions/user data |
| `useAdminMetrics` | Admin dashboard statistics and activity feed |
| `useProviderMetrics` | Provider dashboard metrics and weekly stats |
| `useLazyLoading` | Intersection Observer-based loading |
| `useTheme` | Theme management (dark/light mode) |
| `useNotifications` | Admin in-app notifications (real-time onSnapshot) |
| `useStartupLogging` | Startup diagnostics and environment logging |

## Key Utilities

| Module | Purpose |
|--------|---------|
| `geo.ts` | Haversine distance, `validateGeofence()`, coordinate extraction |
| `location.ts` | GPS utilities, `getCurrentLocation()`, `Coordinates` interface |
| `session.ts` | Session business logic, `calculateSessionDuration()`, `SessionData` |
| `time.ts` | `getDayKey()`, `minutesToHours()`, time range calculations |
| `dateTime.ts` | Date/time utilities with America/Chicago timezone conversion |
| `csv.ts` | CSV export utilities (`toCSV`, `downloadCSV`, session export) |
| `sessionHistory.ts` | Duration histograms, hours-by-location analysis |
| `environmentValidator.ts` | Production environment validation |
| `imageOptimization.ts` | Blur data URLs, srcset generation |

## Offline Queue Architecture

```
actionQueue.ts          queueManager.ts         syncManager.ts
┌──────────────┐       ┌──────────────┐        ┌──────────────┐
│ queueCheckIn │──────▶│ checkIn()    │──────▶  │ sync()       │
│ queueCheckOut│       │ checkOut()   │         │ processQueue │
│ queueAction  │       │ online/      │         │ retry logic  │
│              │       │ offline fork │         │              │
└──────┬───────┘       └──────────────┘        └──────────────┘
       │
       ▼
  offlineDB.ts / dbSchema.ts (IndexedDB)
```

- **Online path**: `queueManager` calls `startSession`/`endSession` Cloud Functions directly
- **Offline path**: Actions queue to IndexedDB via `actionQueue`, then `syncManager` replays on reconnection
- **Cache layers**: `cacheStrategy.ts` and `cacheManager.ts` handle expiration and size limits

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

### Logging
- `src/lib/logging/appLogger.ts` — Application-wide structured logger
- `src/lib/logging/startupLogger.ts` — Startup diagnostics

## Data Model

### Firestore Collections

| Collection | Description |
|------------|-------------|
| `users/{userId}` | User accounts (role, displayName, email, autoGeofenceCheckEnabled) |
| `users/{userId}/pushSubscriptions/{id}` | Push notification subscriptions (`sessionAlerts`, `adminAlerts`) |
| `locations/{locationId}` | School/location data (geo, radiusMeters, assignedProviders) |
| `sessions/{sessionId}` | Check-in/out sessions (status, dayKey, durationMinutes, hasNotes) |
| `users/{userId}/notifications/{id}` | In-app notifications for admins (session notes) |
| `feedback/{feedbackId}` | User feedback (category, severity, status) |
| `services/{serviceId}` | Service definitions (name, code, isActive) |
| `schedules/{scheduleId}` | Provider schedules (dayOfWeek, startTime, endTime) |
| `reportSchedules/{id}` | Automated report schedules |
| `system/{document}` | System metadata and analytics (admin only) |
| `cache_stats/{document}` | Cache performance monitoring |
| `rate_limits/{userId}` | Rate limiting data |

### Key Types

All defined in `src/lib/firebase/types.ts`:

- **User**: `role: "provider" | "admin"`, `autoGeofenceCheckEnabled`
- **Location**: `geo: GeoPoint`, `radiusMeters` (default 300), `assignedProviders: string[]` (authoritative for RBAC)
- **Session**: `status: "active" | "paused" | "completed" | "cancelled" | "error"`, `checkInMethod: "geo" | "manual" | "offline-sync"`, `dayKey` (YYYY-MM-DD in America/Chicago)
- **Feedback**: `category`, `severity`, `status`
- **AppNotification**: `type: "session_note"`, `sessionId`, `providerName`, `locationName`, `notePreview`, `read`
- **Service**, **Schedule**, **ReportSchedule**

`Location.assignedProviders` is the single source of truth for provider-location assignments.

### Agent API Surface

**Callable Cloud Functions** (write path):
| Function | Input | Output |
|----------|-------|--------|
| `startSession` | `{ locationId, startTime, dayKey, checkInMethod, checkInLocation?, notes? }` | `{ success, sessionId, session }` |
| `endSession` | `{ sessionId, endTime, notes?, checkOutLocation? }` | `{ success, sessionId }` |
| `updateSessionNote` | `{ sessionId, notes }` | `{ success, sessionId, notes, notesUpdatedAt }` — note text is silently truncated to 500 chars server-side; rate-limited to one update per 10 s per session |

**Stable Firestore paths** (read path — direct queries):
| Path | Access | Use |
|------|--------|-----|
| `sessions` where `hasNotes == true` orderBy `updatedAt desc` limit 25 | Admin | List session notes (page 1); iterate with `startAfter(lastDoc)` until result count < 25 for subsequent pages. Requires composite index `hasNotes ASC + updatedAt DESC`. Resolve display names via `users/{userId}.displayName` and `locations/{locationId}.name`. |
| `sessions` where `userId == {uid}` orderBy `startTime desc` | Provider | List own sessions |
| `users/{uid}/notifications` orderBy `createdAt desc` | Admin | List notifications |
| `users/{uid}/notifications/{id}` update `{ read: true }` | Admin | Mark notification read |

## App Routes

```
/                         Home / login
/dashboard                Provider dashboard
/dashboard/history        Session history
/dashboard/schedules      Provider read-only schedule view
/dashboard/schools        Provider schools list
/admin                    Admin dashboard
/admin/assignments        Provider-location assignments
/admin/notes              Session notes management
/admin/reports            Reports
/admin/schedules          Provider schedule management
/admin/schools            School management
/admin/services           Service management
/admin/users              User management
/profile                  User profile
/provider/notes           Provider session notes
```
