# Firebase

## Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Functions | 5001 |
| Firestore | 8080 |
| Hosting | 5000 |

## Emulator Commands

```bash
npm run firebase:emulators      # All emulators
npm run firebase:emulators:ui   # Auth/Firestore/Storage with UI
```

## Deploy Commands

```bash
npm run firebase:deploy              # Everything
npm run firebase:deploy:hosting      # Hosting only
npm run firebase:deploy:rules        # Rules only
npm run firebase:deploy:production   # Full production deploy (scripts/deploy-production.sh)
npm run firebase:deploy:dry-run      # Production dry-run
npm run firebase:deploy:staging      # Staging channel
```

## Rollback

```bash
npm run firebase:rollback            # Interactive
npm run firebase:rollback:emergency  # Auto-rollback to previous version
```

Rollback requires `jq` and `curl`. Supports `FORCE_ROLLBACK=true` to skip confirmation.

## Production Deploy Script

`scripts/deploy-production.sh`:
- Validates `.env.production` and security rules
- Runs unit tests
- Builds `out/`
- Deploys Firestore + Storage + Hosting

Flags: `--dry-run`, `--skip-tests`

## Rules Testing

```bash
npm run test:firestore-rules
npm run test:storage-rules
```

## Database Seeding

```bash
npm run db:seed   # Runs scripts/seed-firestore.ts via ts-node
```

Seeds schools from `schools.json` with default radius of 300 m.

## Node Version

Firebase Functions require Node 20. Use Node 20 for functions deploys/emulators.

## Live URL

https://schools-in-check.web.app

---

## Cloud Functions

Function exports live in `functions/src/index.ts`. Shared utilities (auth helpers, distance calculation, push notification wrappers, config constants) are in `functions/src/utils.ts`. See [Architecture — Cloud Functions](architecture.md#cloud-functions) for the full list.

### Secrets (defined in Cloud Functions config)

| Secret | Used By |
|--------|---------|
| `MS_TENANT_ID` | `syncUserFromM365` |
| `MS_CLIENT_ID` | `syncUserFromM365` |
| `MS_CLIENT_SECRET` | `syncUserFromM365` |
| `DMDL_OFFICE_GROUP_ID` | `syncUserFromM365` |
| `DMDL_OFFICE_GROUP_NAME` | `syncUserFromM365` |
| `VAPID_PUBLIC_KEY` | `cleanupStaleSessions`, `getVapidPublicKey` |
| `VAPID_PRIVATE_KEY` | `cleanupStaleSessions` |
| `VAPID_EMAIL` | `cleanupStaleSessions` |
| `SENDGRID_API_KEY` | `notifyOnFeedback` (optional) |
| `ADMIN_EMAIL` | `notifyOnFeedback` |
| `BASE_URL` | `notifyOnFeedback` |

### Deploying Functions

```bash
cd functions && npm run build   # Build TypeScript
firebase deploy --only functions
```

Or use the predeploy hook (configured in `firebase.json`) which runs the build automatically.

---

## Firestore Collections

| Collection | Key Fields | Access |
|------------|-----------|--------|
| `users/{userId}` | `role`, `displayName`, `email`, `autoGeofenceCheckEnabled` | Own data + admin |
| `users/{uid}/pushSubscriptions/{id}` | `endpoint`, `keys` | Own data |
| `locations/{locationId}` | `geo`, `radiusMeters`, `assignedProviders[]`, `active` | Assigned providers + admin |
| `sessions/{sessionId}` | `userId`, `locationId`, `status`, `dayKey`, `checkInMethod`, `startTime` | Own sessions + admin |
| `feedback/{feedbackId}` | `providerId`, `category`, `severity`, `status` | Create: any auth; Read/update: admin |
| `services/{serviceId}` | `name`, `code`, `isActive` | Read: any auth; Write: admin |
| `schedules/{scheduleId}` | `providerId`, `locationId`, `dayOfWeek`, `startTime` | Own schedules + admin |
| `reportSchedules/{id}` | `reportType`, `frequency`, `recipients[]` | Admin only |
| `system/{document}` | Varies (analytics, daily stats) | Admin only |
| `cache_stats/{document}` | Cache performance metrics | Admin only |
| `rate_limits/{userId}` | Rate limiting counters | System |

### Admin Session Reports indexes

- **Session Reports** (`/admin/reports`, component `SessionReports`) queries `sessions` with a **`startTime` range**, optional **`userId` / `status`**, and optional **`locationId` or `schoolId`**, plus **`orderBy("startTime", "desc")`**.
- Composite definitions live in [`firestore.indexes.json`](../../firestore.indexes.json). After changing indexes, deploy with `firebase deploy --only firestore:indexes` (or your usual rules/index deploy) and **wait until indexes finish building** in the Firebase console before relying on new filter combinations in production.

### Security Rules Highlights

- **Providers** can only check in at assigned locations using `geo` or `offline-sync` methods
- **Admins** can check in at any location using `manual` method
- Session status transitions are validated (e.g. `active` → `completed`, not `completed` → `active`)
- `Location.assignedProviders` is the authoritative RBAC field

---

## Storage Rules

| Path | Max Size | Types | Access |
|------|----------|-------|--------|
| `/users/{userId}/profile/{file}` | 5 MB | `image/*` | Own profile + admin |
| `/locations/{locationId}/images/{file}` | 5 MB | `image/*` | Read: any auth; Write: admin |
| `/sessions/{sessionId}/attachments/{file}` | 5 MB (images), 10 MB (docs) | `image/*`, `application/pdf` | Session owner + admin |
| `/system/**` | — | — | Admin only |
| `/public/**` | — | — | Read: all; Write: admin |

---

## Environment Variables

### Required (Firebase SDK)

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

### Optional (feature flags and tuning)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_APP_VERSION` | — | Displayed in app UI |
| `NEXT_PUBLIC_FEATURE_AUTO_GEOFENCE` | `"true"` | Enable auto geofence check |
| `NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING` | `"false"` | Firebase Performance Monitoring |
| `NEXT_PUBLIC_ENABLE_CACHING` | `"true"` | Enable multi-layer caching |
| `NEXT_PUBLIC_PWA_ENABLED` | `"false"` | Enable PWA features |
| `NEXT_PUBLIC_CACHE_TTL_SHORT` | `300000` (5 min) | Short cache TTL in ms |
| `NEXT_PUBLIC_CACHE_TTL_MEDIUM` | `1800000` (30 min) | Medium cache TTL in ms |
| `NEXT_PUBLIC_CACHE_TTL_LONG` | `7200000` (2 hr) | Long cache TTL in ms |
| `NEXT_PUBLIC_CACHE_MAX_MEMORY_SIZE` | `200` | Max items in memory cache |

Validated at startup by `src/lib/utils/environmentValidator.ts`.

---

## Firebase SDK Initialization

- Config: `firebase.config.js` (root level)
- Firestore: `CACHE_SIZE_UNLIMITED`, `ignoreUndefinedProperties: true`
- Dev mode: Auto-connects to emulators (Auth 9099, Firestore 8080, Storage 9199, Functions 5001)
- Performance monitoring: Production only
