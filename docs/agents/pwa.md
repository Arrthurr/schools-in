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

## Background Sync

`src/lib/pwa/periodicBackgroundSync.ts` — Chrome/Android background geofence registration

## Push Notifications

`src/lib/pwa/pushReminders.ts` — Push subscription helpers for admin alerts

## Components

| Component | Purpose |
|-----------|---------|
| `PWAStatus` | Installation and status indicators |
| `PWAInstallPrompt` | Custom install prompt |
| `PWAUpdatePrompt` | Service worker update notifications |

Located in `src/components/pwa/`
