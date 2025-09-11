# Provider UAT Run — 2025-09-11

Status: In Progress

## Metadata
- Commit: <fill with current commit SHA/tag>
- Environment: Staging (<staging URL>)
- Tester: <name>
- Devices/Browsers:
  - macOS (Chrome, Safari)
  - iOS (Safari, installed PWA)
  - Android (Chrome, installed PWA)

## Objectives
Validate end-to-end Provider flows per UAT checklist, including:
- Authentication & role-gated navigation (Provider)
- Check-In/Check-Out with GPS validation and live timer
- Session history accuracy
- PWA/offline behavior for queued actions
- Performance thresholds and accessibility smoke checks
- Monitoring signals: GA pageviews/events, Web Vitals endpoint, Firebase Perf traces, Sentry breadcrumbs

## Pre-Checks
- [ ] Staging build deployed and healthy
- [ ] Required env vars present (GA ID, Sentry DSN, Firebase config)
- [ ] Test accounts seeded (Provider role with assigned schools)
- [ ] Location services enabled on test devices

## Scenarios & Results

### 1) Authentication & Roles
- [ ] Login via Google OAuth
- [ ] Login via email/password
- [ ] Role-based navigation shows Provider dashboard
- [ ] Session persists across refresh and new tab
Notes:

### 2) Provider Flow
- [ ] School list shows assigned schools with distance; search/filter works
- [ ] Check-In: within geofence radius; rejects when out of range
- [ ] Live session timer visible; status badge shows Active
- [ ] Check-Out prompts confirmation; session finalizes with correct duration
- [ ] Error states: permission denied, timeout, drift, no network (simulated)
Notes:

### 3) Session History
- [ ] Completed session appears with correct timestamps & duration
- [ ] Detail modal shows location, user, and status info
- [ ] Filter by date/school; empty and error states
Notes:

### 5) PWA & Offline (Provider-specific)
- [ ] Install prompt works; app installable
- [ ] Offline app shell loads; check-in/out queued and syncs on reconnect
- [ ] Network status indicators and offline messaging visible
Notes:

### 6) Performance (Smoke)
- [ ] LCP ≤ 2.5s on mid-tier mobile (warm and cold)
- [ ] INP ≤ 200ms; CLS ≤ 0.1
- [ ] Images served optimized (WebP/AVIF) and lazy-loaded
Evidence:

### 7) Accessibility (Smoke)
- [ ] Keyboard navigation, focus ring, skip link
- [ ] Color contrast AA; semantic roles/labels
- [ ] Dialogs trap focus; SR announcements on key actions
Notes:

### 8) Monitoring & Analytics
- [ ] GA4 shows pageviews/events for key screens
- [ ] Web Vitals POSTs received at /api/analytics/web-vitals
- [ ] Firebase Performance traces present in console (prod/staging)
- [ ] Sentry breadcrumbs for needs-improvement/poor vitals visible
Notes:

## Issues Found
- ID / Title:
  - Severity: (blocker/major/minor)
  - Context/Repro:
  - Expected vs Actual:
  - Evidence (screenshots/logs):
  - Status/Owner:

## Summary
- Pass/Fail: <pending>
- Key risks:
- Follow-ups required before sign-off:

## Attachments
- Screenshots: /docs/uat-runs/assets/2025-09-11/<...>
- Logs: link to CI artifacts or console captures
