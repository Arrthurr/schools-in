# Codebase Gap Assessment

Date: 2026-02-10  
Project: `schools-in`  
Scope: architecture, security/Firebase, testing/CI, frontend/Next.js/PWA

## Executive Summary

The codebase has strong foundational architecture, clear domain modeling, solid offline/PWA infrastructure, and good baseline testing. The largest current gaps are in security hardening, CI coverage breadth, and production-readiness consistency (scripts/docs/assets alignment).  

Most urgent risks are:
- potential role escalation in Firestore user creation rules,
- offline geofence bypass path in session start logic,
- auth bypass toggled by public env flag without production guard,
- missing test gates in CI.

## Findings By Severity

### Critical / High

1. **Firestore role escalation risk on user create**  
   - **Evidence:** `firestore.rules` allows `request.resource.data.role in ['provider', 'admin']` for user self-create.
   - **Impact:** Any authenticated user can potentially create self with admin role.
   - **Recommendation:** Restrict create role to `provider`; reserve admin assignment to trusted backend/admin workflows.

2. **Offline-sync geofence bypass in `startSession`**  
   - **Evidence:** `functions/src/index.ts` sets `distanceFromCenter = data.distanceFromCenterAtCheckIn || 0` and enforces geofence only when `checkInLocation` is present.
   - **Impact:** Malicious/invalid clients can omit location and pass fallback distance.
   - **Recommendation:** Require `checkInLocation` for offline-sync and always compute distance server-side.

3. **Auth bypass lacks production guard**  
   - **Evidence:** `src/lib/firebase/authBypass.ts` enables bypass directly from `NEXT_PUBLIC_DISABLE_AUTH === "true"`.
   - **Impact:** Misconfiguration in production could disable auth protections.
   - **Recommendation:** Gate bypass to non-production environments and Cypress-only contexts.

4. **CI quality gates are incomplete**  
   - **Evidence:** `.github/workflows/ci.yml` only runs typecheck + Firestore rules tests.
   - **Impact:** Regressions can pass PR checks (unit tests, lint, storage rules, e2e omitted).
   - **Recommendation:** Add at minimum `npm test`, `npm run lint`, and `npm run test:storage-rules`.

5. **Documented Cypress spec missing**  
   - **Evidence:** `package.json` scripts reference `cypress/e2e/performance-accessibility.cy.ts`, but file is absent.
   - **Impact:** `test:performance` and `test:a11y` fail and create doc/automation drift.
   - **Recommendation:** Add the missing spec or remove/update scripts and related docs.

6. **Provider timeout push workflow incomplete**  
   - **Evidence:** cleanup job checks `sessionAlerts` first; client code only persists `adminAlerts`.
   - **Impact:** Providers may miss timeout warnings intended for active sessions.
   - **Recommendation:** Add provider-side subscription flow for `sessionAlerts`.

### Medium

1. **Unauthenticated callable endpoints**
   - **Evidence:** `trackCachePerformance` and `healthCheck` perform privileged writes/reads without auth checks.
   - **Impact:** Abuse/noise risk, possible operational cost or data pollution.
   - **Recommendation:** Require auth and add rate limits/App Check.

2. **PII logging in Cloud Functions**
   - **Evidence:** `notifyOnFeedback` logs rich feedback/email payload data.
   - **Impact:** Expanded PII footprint in logs.
   - **Recommendation:** Log only metadata/IDs; redact content fields.

3. **Inconsistent logging strategy**
   - **Evidence:** Extensive `console.*` usage across app/services despite `appLogger`.
   - **Impact:** Harder observability and inconsistent log hygiene.
   - **Recommendation:** Standardize on `appLogger` with level-based output.

4. **Core Cloud Functions not sufficiently tested**
   - **Evidence:** No focused tests for `startSession`, `endSession`, `cleanupStaleSessions`.
   - **Impact:** Business-critical behavior can regress unnoticed.
   - **Recommendation:** Add integration tests with emulator-backed fixtures.

5. **Rules transition tests incomplete**
   - **Evidence:** Session transition rules exist, but not fully validated in rules tests.
   - **Impact:** Policy regressions may pass unnoticed.
   - **Recommendation:** Add explicit allow/deny tests for each status transition path.

6. **Timezone consistency risk in daily stats**
   - **Evidence:** Daily stats use naive `Date` boundaries in functions runtime.
   - **Impact:** Day-boundary drift relative to America/Chicago assumptions.
   - **Recommendation:** Compute day windows in explicit business timezone.

7. **Overlapping service manager abstractions**
   - **Evidence:** `src/lib/services/serviceManager.ts` and `src/lib/offline/serviceManager.ts`.
   - **Impact:** Naming and ownership ambiguity.
   - **Recommendation:** Rename/consolidate responsibilities and document boundaries.

### Low

1. **PWA/notification assets missing**
   - **Evidence:** icon and screenshot paths in manifest/service worker reference files not present in `public/`.
   - **Impact:** Weaker install and push UX polish.
   - **Recommendation:** Add assets or correct paths.

2. **Deploy script `--skip-tests` inconsistency**
   - **Evidence:** flag parsed but normal `main` flow still always runs tests.
   - **Impact:** Operator confusion.
   - **Recommendation:** honor the flag in main deployment path.

3. **Deprecated rules surface retained**
   - **Evidence:** `assignments` collection still present for backward compatibility.
   - **Impact:** minor maintenance overhead.
   - **Recommendation:** complete migration and remove deprecated rules.

## Strengths

- Strong domain model and clear types for sessions/locations/users.
- Good foundational Firestore/Storage rules structure and helper functions.
- Mature offline architecture (queue, sync, cache layers).
- Next.js static export + PWA scaffolding are well established.
- Existing test foundation includes unit tests, rules tests, and Cypress suite.
- Production deploy tooling and operational docs are comprehensive.

## Priority Remediation Plan

1. **Security hotfixes immediately**
   - lock down user role creation in rules,
   - enforce server-side geofence for all check-ins (including offline-sync),
   - restrict auth bypass to non-production.

2. **Strengthen CI gates**
   - add unit tests, lint, storage-rules tests to PR workflow.

3. **Repair test/docs contract**
   - resolve missing Cypress performance/a11y spec references.

4. **Increase critical path coverage**
   - add Cloud Functions integration tests for check-in/out and stale cleanup.

5. **Operational hardening**
   - auth/rate-limit sensitive callables,
   - reduce PII logging,
   - standardize logging strategy.

6. **PWA UX completion**
   - add missing assets,
   - ship provider `sessionAlerts` subscriptions.

## Suggested Success Criteria

- No known privilege-escalation path in rules or functions.
- CI blocks merges when unit/lint/rules checks fail.
- All referenced test scripts and docs are executable and current.
- Core session lifecycle fully covered by automated tests.
- Push reminders work for both providers and admins as designed.
