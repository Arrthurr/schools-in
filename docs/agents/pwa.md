# PWA

## Service Worker

- **Source**: `src/app/sw.ts`
- **Output**: `public/sw.js`
- **Framework**: Serwist (`@serwist/next`)

## Required Meta Tags

Include both for broad mobile support:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
```

Implementation:
- `src/app/layout.tsx` adds the standard tag via `other: { 'mobile-web-app-capable': 'yes' }`
- `src/app/layout.tsx` sets `appleWebApp.capable = true` for iOS
- `src/app/head.tsx` ensures fallback during app routes rendering

## Capability Detection

`src/lib/pwa/capabilities.ts` provides browser feature detection:
- Wake Lock, Periodic Sync, Push, Background Sync

Used by `useGeofenceStrategy` to select the appropriate geofence detection tier.

## Background Sync

`src/lib/pwa/periodicBackgroundSync.ts` — Chrome/Android background geofence registration

Manages the Periodic Background Sync API for background geofence checking when the app is not in the foreground.

## Push Notifications

### Subscription Model

Push subscriptions are stored in Firestore under `users/{userId}/pushSubscriptions/`:

| Subscription ID | Purpose | Used By |
|-----------------|---------|---------|
| `sessionAlerts` | Session timeout warnings for providers | `cleanupStaleSessions` |
| `adminAlerts` | Admin notifications (timeout alerts, feedback) | `cleanupStaleSessions`, `notifyOnFeedback` |

When sending session timeout warnings, the system checks `sessionAlerts` first, then falls back to `adminAlerts`.

### Notification Types

| Type | Trigger | Target | Data Payload |
|------|---------|--------|-------------|
| `session-timeout-warning` | Session reaches 90+ min | Session owner | `{ sessionId }` |
| `session-timeout` | Session auto-closed at 2 hr | All admins | `{ count, sessionIds[] }` |
| Feedback alert | New feedback submitted | Admin email | Email (not push) |

### VAPID Configuration

Push notifications use the Web Push protocol with VAPID authentication:
- `VAPID_PUBLIC_KEY` — shared with clients via `getVapidPublicKey` Cloud Function
- `VAPID_PRIVATE_KEY` — server-side only (Cloud Functions secret)
- `VAPID_EMAIL` — contact email for push service (must be `mailto:` or `https://` URL)

Helpers in `src/lib/pwa/pushReminders.ts` handle client-side subscription management.

### "Still Here?" Prompt

When the app regains visibility after 30+ minutes of a running session, `useAutoGeofenceCheck` shows a toast with a "Check Out" action button. This is a client-side prompt (not a push notification) designed to catch users who forget to check out.

## Components

| Component | Purpose |
|-----------|---------|
| `PWAStatus` | Installation and status indicators |
| `PWAInstallPrompt` | Custom install prompt |
| `PWAUpdatePrompt` | Service worker update notifications |
| `OfflineQueue` | Offline action queue status display |

Located in `src/components/pwa/`
