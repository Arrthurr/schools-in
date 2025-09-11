# Provider UAT Run — 2025-09-11

## Metadata

- Tester: Arthur Turnbull
- Staging URL: TBD
- Commit SHA: b76b65c
- Environment: Staging
- Devices/Browsers:
  - iPhone (iOS) • Safari
  - Android • Chrome
  - Mac • Chrome, Safari

Note: Until a staging URL is available, perform a local dry run using the dev server and Firebase emulators.

## Pre-checks

- [ ] Build deployed and reachable (200 on /)
- [ ] Test accounts available (provider, admin)
- [ ] Firebase emulators OFF (staging)
- [ ] Feature flags as expected
- [ ] Clear cache before each device run

---

## Scenarios

### 1) Auth: Login/Logout

- Steps: Open landing → Login with Google → Verify dashboard → Logout
- Expected: Auth succeeds; role = Provider; dashboard loads
- Result: [Pass|Fail|Blocked]
- Evidence: (screenshots/recording)
- Notes:

### 2) School list & distance

- Steps: Open Schools → Verify assigned schools + distance sorting
- Expected: Schools list visible; distance computed; search works
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 3) Check-in within radius (GPS)

- Steps: Select school → Allow location → Check in
- Expected: Location validated (≤ configured radius); session starts; status shows Active
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 4) Check-out & summary

- Steps: Open Active session → Check out → Confirm
- Expected: Session ends; duration computed; confirmation shown
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 5) Session history

- Steps: Open History → Locate last session → Open details
- Expected: Accurate time, location, school, status
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 6) Offline queue & sync

- Steps: Go offline → Attempt check-in/out → Go online
- Expected: Actions queued; sync completes; UI reconciles
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 7) PWA install

- Steps: Add to Home Screen (mobile) or Install (desktop)
- Expected: App installs; launches standalone; routing works
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 8) Performance spot-check

- Steps: Cold-load dashboard; interact with schools and check-in
- Expected thresholds: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1
- Result: [Pass|Fail|Blocked]
- Evidence: (Lighthouse/Web Vitals overlay)
- Notes:

### 9) Accessibility spot-check

- Steps: Run axe; keyboard-nav; focus states; landmarks
- Expected: No critical issues; forms labeled; contrast OK
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:

### 10) Monitoring signals

- Steps: Navigate and perform check-in/out
- Expected:
  - GA4 pageviews/events present
  - Web Vitals posted to /api/analytics/web-vitals
  - Firebase Performance traces recorded
  - Sentry breadcrumbs appear for slow vitals
- Result: [Pass|Fail|Blocked]
- Evidence:
- Notes:
