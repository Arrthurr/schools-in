# Provider Performance Audit (Mobile PWA)

Date: 2026-01-11  
Scope: **Provider** experience (Mobile PWA first), audit-only findings + prioritized recommendations.

## Executive summary

- **Geofenced check-in is implemented and enforced server-side when GPS coordinates are provided**, with client-side debouncing and accuracy gating. Default geofence radius in code is **100m** (configurable per location via Firestore `radiusMeters`).
- **Offline check-in/out is not implemented for the real Provider flow** (auto-geofence uses `httpsCallable("startSession")` and fails offline). There is substantial offline infrastructure in the repo, but it is **duplicated** and **not wired into Provider check-in/out**.
- **School list “instant offline” persistence is not implemented in the Provider UI** (`getDocs` fetch on each load). There is an existing caching layer (`FirebaseCache` + `getCachedLocationsByProvider`) and provider cache warming, but Provider screens do **not** use it.

## System map (as implemented)

```mermaid
flowchart TD
  ProviderUI[ProviderUI]
  AutoGeofenceHook[useAutoGeofenceCheck]
  GeoAPI[navigator.geolocation]
  StartSessionFn[functions.startSession(onCall)]
  Sessions[Firestore:sessions]
  Locations[Firestore:locations]
  SW[SerwistServiceWorker]
  IDB1[IndexedDB:schools-in-offline]
  IDB2[IndexedDB:schools-in-cache]

  ProviderUI --> AutoGeofenceHook
  AutoGeofenceHook --> GeoAPI
  AutoGeofenceHook -->|checkIn/checkOut| Sessions
  AutoGeofenceHook -->|validateGeofence against| Locations
  ProviderUI -->|manual check-in path| StartSessionFn
  StartSessionFn -->|transaction + enforce| Sessions
  StartSessionFn --> Locations
  SW --> IDB1
  ProviderUI --> IDB2
```

## Epic 1: Location-Aware Check-In

### User Story 1.1: Geofenced Check-In

| Acceptance criteria | Status | Evidence (code) | Notes / performance impact |
|---|---:|---|---|
| Request and verify high-accuracy GPS permissions | **Partial** | `src/lib/utils/location.ts` uses `enableHighAccuracy: true`. `src/lib/hooks/useAutoGeofenceCheck.ts` infers permission via success/error codes. | No explicit `navigator.permissions.query({name:"geolocation"})` gating; iOS “precise location” cannot be verified directly. Polling with high accuracy is **battery-expensive**. |
| Auto Check-In disabled until within radius of Firestore coordinates | **Met** | `src/lib/hooks/useAutoGeofenceCheck.ts` checks `validateGeofence(...)` and requires `DEBOUNCE_POLLS` consecutive “inside” pings before starting countdown/triggering `checkIn`. | Default radius is `radiusMeters ?? 100`. Your story example used 200m; currently configured per location, default 100m. |
| UI provides “In Range” indicator using `@vis.gl/react-google-maps` | **Partial** | `src/components/maps/GoogleMap.tsx` uses `@vis.gl/react-google-maps`. Provider UI shows “In Range” badges in `src/components/provider/SchoolList.tsx` and `src/components/provider/SchoolDetailSheet.tsx`. | Map does **not** currently render a geofence circle (only markers + an overlay label). If you want the indicator *on the map* (green ring), add a `Circle` overlay and color based on in-range state. |

**Server-side enforcement (important):** The callable `functions/src/index.ts` `exports.startSession` validates role + assignment + (when `checkInLocation` is present) enforces the geofence radius. This is the strongest guarantee and should remain the source of truth.

### User Story 1.2: Offline Session Logging

| Acceptance criteria | Status | Evidence (code) | Notes / performance impact |
|---|---:|---|---|
| Serwist SW intercepts request and stores check-in event in IndexedDB | **Not met** | `src/app/sw.ts` has **no** `fetch` event interception and no request-to-IDB write for check-in/out. | Current SW uses background sync + client messaging, but does not “intercept the request” as specified. |
| UI shows “Pending Sync” for offline entries | **Partial** | Offline status components exist (`src/components/offline/*`) and reference a queue (`useEnhancedOfflineQueue`). | Provider check-in/out code path does not enqueue actions when offline, so “Pending Sync” won’t appear for real sessions today. |
| When connection returns, Firebase SDK syncs IndexedDB → Firestore | **Partial** | There are two custom sync systems: `src/lib/offline/offlineDB.ts` (`syncPendingActions`) and `src/lib/offline/actionQueue.ts` (`processQueue`). | This is **custom sync**, not Firestore persistence. Also, both systems currently write sessions directly via client SDK (`createDocument/updateDocument`), which can bypass `startSession` invariants unless Firestore rules are strict. |

#### Critical wiring gap (Provider flow)

The actual Provider flow on the dashboard uses **auto-geofence** and calls `checkIn/checkOut` from `src/lib/hooks/useSession.ts` (which calls `httpsCallable("startSession")` for check-in). There is **no fallback** to queue actions offline. Result: **offline check-in/out is not available** to providers, despite the UI messaging suggesting it is.

#### Duplication / performance concerns (offline)

- **Two parallel queue systems exist:**
  - `offlineDB/serviceManager` + SW `sync` tags storing actions in `schools-in-offline` DB
  - `actionQueue/queueManager/syncManager` storing actions in `schools-in-cache` DB
- **`syncManager.syncSingleAction` is currently a placeholder** that calls `processQueue()` (processes the entire queue) per action, which can multiply work and waste battery/data on mobile.

## Epic 2: Data & State Management

### User Story 2.1: School List Persistence

| Acceptance criteria | Status | Evidence (code) | Notes / performance impact |
|---|---:|---|---|
| On initial load, school list is cached in the browser | **Met** | `src/lib/hooks/useProviderLocations.ts` reads `getCachedLocationsByProvider` immediately; `src/components/provider/SchoolList.tsx` now uses the hook instead of direct `getDocs`. | Cold loads now render from multi-layer cache; legacy `getAssignedLocations` path removed from provider UI. |
| Uses Cache-First / SWR via Serwist | **Met (app-level)** | `useProviderLocations` performs cache-first + Firestore revalidation; Serwist still only caches static assets (Firestore SDK not cached at SW). | SWR is achieved at the app layer; no change to `src/app/sw.ts` because Firestore over HTTP isn’t SW-cached. |
| Firestore snapshot listeners update local cache for assignment changes | **Met** | `useProviderLocations` subscribes via `subscribeToCachedCollection` (filters: `assignedProviders` array-contains UID, `active` true, orderBy name) and keeps FirebaseCache warm. | Assignment changes in Firestore now flow live into the cache and UI. |

## Edge cases (“What-ifs”)

### The “Stuck” session

- **Current behavior:** `functions/src/index.ts` runs `cleanupStaleSessions` **every 15 minutes** and auto-closes sessions older than `_PRODUCTION_CONFIG.sessionTimeoutHours` (**2 hours**). It marks them `status: "error"` and adds `notes: "Session automatically closed due to timeout."`
- **Mismatch vs proposal:** This is not “midnight close” and does not explicitly “flag for admin review” beyond the `status: "error"` and metrics write.
- **Performance implication:** This is a reliability backstop when the PWA can’t run auto-checkout (e.g., app closed).

### GPS drift near geofence edge

- **Current behavior:** `useAutoGeofenceCheck` requires `DEBOUNCE_POLLS` consecutive readings (currently **2** per `getStrategyConfig`) before transitioning to “inside/exiting” and triggering auto actions. Also pauses auto-check on poor accuracy (> 50m).
- **Mismatch vs proposal:** Your suggested “3 consecutive pings” isn’t the default; it’s easy to tune (and you may also want hysteresis: different enter/exit radii).
- **Performance implication:** Increasing debounce reduces false positives but may delay legitimate check-in/out and prolong polling.

### App termination / tab closed mid-shift

- **Current behavior:** Active session state is persisted in Firestore and reloaded via listeners (`useSession` and/or `useCachedSession`). Auto-geofence config is mirrored into IndexedDB (`src/lib/offline/offlineDB.ts`) for SW access.
- **Remaining limitation:** iOS cannot do background geolocation; auto checkout cannot be guaranteed when the app is not active. Scheduled cleanup mitigates “forever active”.

## Key performance risks (mobile PWA)

### P0 risks
- **Offline architecture duplication** increases app weight and background work (extra timers, extra IndexedDB initialization, duplicated queues).
- **Provider list fetch is network-bound** on startup (no cache-first read), making cold loads slower and worse on poor reception.
- **Client-side direct Firestore writes in offline sync paths** can bypass `startSession` checks and geofence validation unless Firestore rules fully enforce invariants.

### P1 risks
- **GPS polling** (`getCurrentPosition` with high accuracy every 30–60s) can be battery-heavy.
- **Repeated IndexedDB writes** (geofence config updates, queue stats polling) can be expensive on low-end devices.
- **Cache invalidation** in `FirebaseCache.invalidateCache` is best-effort and does not truly support pattern invalidation (risk of stale UI).

## Prioritized recommendations

### P0 (correctness + major performance)
- **Unify to one offline queue + one sync path.** Pick either:
  - the “actionQueue/queueManager” system (recommended; already drives UI messaging), or
  - the “offlineDB/serviceManager + SW sync tags” system  
  Then delete/disable the other to avoid duplicate work and confusion.
- **Wire Provider check-in/out to the offline queue.**
  - When offline: enqueue `{type: check_in/check_out, locationId/sessionId, checkInLocation/checkOutLocation}` and show “Pending Sync”.
  - When online: prefer calling `startSession` (callable) so server-side invariants remain consistent.
- **Ensure offline sync replays through server-validated endpoints**, or mirror the same validations in Firestore rules. Right now, offline sync paths write directly to Firestore.

### P1 (UX + battery)
- **Make Provider school list cache-first**:
  - Read from `getCachedLocationsByProvider` immediately, render, then revalidate in background.
  - Add a snapshot listener to keep cache warm when assignments change (either via `assignments` collection or `locations` array-contains).
- **Upgrade map “In Range” UX**:
  - Render a geofence ring on the map (Circle overlay) and color it based on in-range state.
- **Tune drift handling**:
  - Default `debouncePolls` to **3** for edge stability.
  - Consider hysteresis (enter radius < exit radius) to prevent flapping.

### P2 (observability + verification)
- Add a small “performance/health” screen (admin-only) showing:
  - last geofence poll time, last accuracy, pending queue size, last sync result, cache hit rate.
- Optional measurement pass (not run in this audit):
  - `npm run analyze`, `npm run lighthouse:local`, `npm run test:performance`.

