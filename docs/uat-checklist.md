# User Acceptance Testing (UAT) Checklist — Provider Check-In/Check-Out

Purpose: Validate the end-to-end experience meets the PRD, is stable in real-world conditions, and is production-ready.

## 1) Authentication & Roles

- Login with Google OAuth and email/password
- Role-based access: Provider vs Admin navigation and permissions
- Session persistence across refresh and new tabs

## 2) Provider Flow

- View assigned schools with distance shown and search/filter
- Check-In: requires GPS in-range and accurate within school radius
- Live session timer visible; status badge reflects Active
- Check-Out: prompts confirmation; finalizes session with duration
- Error handling: permission denied, timeout, drift, no network

## 3) Session History

- Completed sessions appear with correct timestamps and durations
- Detail modal shows location, user, and status info
- Filtering by date/school; empty and error states handled

## 4) Admin Management

- Dashboard loads stats; navigation is consistent
- Schools CRUD: create/edit with geocoding and GPS validation
- User/provider management and assignments
- Reports: filters, CSV export, summaries; scheduled report cards render

## 5) PWA & Offline

- Install prompt works on supported browsers/devices
- App is installable (manifest, icons, theme color)
- Offline mode: can open app shell and queued actions are synced later
- Network status indicators and offline messaging visible

## 6) Performance (Thresholds)

- Core Web Vitals on mid-tier mobile: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- Image optimization effective (WebP/AVIF, lazy loading)
- Cache hit rates reasonable for cached services (basic smoke via logs)

## 7) Accessibility (WCAG 2.1 AA)

- Keyboard navigable; focus ring visible; Skip to content present
- Color contrast meets AA; semantic roles/labels applied
- Dialogs/traps focus; screen reader announcements for critical actions

## 8) Monitoring & Analytics

- GA4 receives page views and basic events
- Web Vitals reports sent to `/api/analytics/web-vitals`
- Firebase Performance traces generated for vitals in production
- Sentry breadcrumbs present when vitals are “needs-improvement/poor”

## 9) Deployment & Env

- Production build succeeds; static export compatible
- Firebase Hosting headers/caching in place
- Environment validation passes (required env vars present)

## 10) UAT Sign-off

- Stakeholders review provider and admin scenarios
- Confirm acceptance criteria met and no blocking issues remain

Notes:

- Use emulators locally for Auth/Firestore/Storage. For UAT, validate against staging.
- Capture screenshots of key flows and attach to the release notes.
