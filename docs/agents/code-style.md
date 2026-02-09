# Code Style

## Imports

Use `@/` alias for src imports. Group external imports before internal.

```ts
// External
import { useState, useCallback, useRef } from "react";
import { Timestamp } from "firebase/firestore";

// Internal
import { useSession } from "@/lib/hooks/useSession";
import { locationService } from "@/lib/services/locationService";
import type { SessionData } from "@/lib/firebase/types";
```

## Components

- Use `cn()` for className merging (clsx + tailwind-merge)
- Types are exported from `src/lib/firebase/types.ts`
- UI primitives live in `src/components/ui/` (shadcn/ui)

## Locations

Use `locationService` for location operations:
- `getAssignedLocations()`, `calculateDistance()`, `isWithinRadius()`

## Images

Use `OptimizedImage` or `LazyImage` instead of raw `<img>` tags.

## Performance

Prefer cached hooks (`useCachedAuth`, `useCachedSession`) over uncached alternatives.

## Maps

Use `@vis.gl/react-google-maps` components for Google Maps integration.

## Accessibility

See `docs/design-system.md` and `docs/responsive-design-system.md` for ARIA and semantic HTML patterns.

## Logging

Use `appLogger` from `@/lib/logging/appLogger` instead of raw `console.log`:

```ts
import { appLogger } from "@/lib/logging/appLogger";

appLogger.info("Manual checkout from still-here prompt");
appLogger.warn("Checkout failed", { err });
```

In Cloud Functions, use the `logger` from `firebase-functions`:

```ts
import { logger } from "firebase-functions";

logger.info("Found stale session", { docId, duration });
```

## Avoiding Stale Closures

When a long-lived closure (e.g. toast `onClick`, timer callback) needs to read the latest value of state that may change while the closure is alive, use a ref that shadows the state:

```ts
const activeSessionRef = useRef(activeSession);
activeSessionRef.current = activeSession;

// Inside a long-lived closure:
const current = activeSessionRef.current; // always fresh
```

This avoids adding the state variable to dependency arrays, which would cause unnecessary re-creation of callbacks.

## Offline Queue Pattern

When calling `checkIn` or `checkOut`, always pass the actual geofence distance (not just GPS accuracy) through the full call chain:

```
useAutoGeofenceCheck → useSession.checkIn(schoolId, location, distanceFromCenter)
  → serviceManager.checkIn(schoolId, userId, location, distanceFromCenter)
    → queueManager.checkIn(schoolId, userId, location, distanceFromCenter)
      → actionQueue.queueCheckIn(schoolId, userId, location, distanceFromCenter)
```

The `distanceFromCenter` parameter is optional and falls back to `location.accuracy` if omitted.

## Environment Variables

- All public env vars use the `NEXT_PUBLIC_` prefix
- Validated at startup by `src/lib/utils/environmentValidator.ts`
- See [Firebase — Environment Variables](firebase.md#environment-variables) for the full list

## Timezone

The app uses `America/Chicago` as the default timezone for `dayKey` generation and date display. The `getDayKey()` utility in `src/lib/utils/time.ts` handles this.
