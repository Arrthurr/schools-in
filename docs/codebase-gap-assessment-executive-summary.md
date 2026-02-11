# Codebase Gap Assessment — Executive Summary

**Date:** 2026-02-10 · **Project:** schools-in · **Full report:** [codebase-gap-assessment-2026-02-10.md](./codebase-gap-assessment-2026-02-10.md)

---

## Overall health

The codebase is in **good shape**: strong architecture, clear domain model, solid offline/PWA setup, and a real test foundation. The main gaps are **security hardening**, **CI breadth**, and **alignment of scripts, docs, and assets** with production expectations.

---

## Top risks (address first)

| Risk | What’s wrong | One-line fix |
|------|----------------|--------------|
| **Role escalation** | Users can set their own Firestore role to `admin` on profile create. | Restrict create to `role == 'provider'`; admin only via backend/sync. |
| **Geofence bypass** | Offline-sync check-in can skip server-side distance check if location is omitted. | Require `checkInLocation` for offline-sync; always validate distance server-side. |
| **Auth bypass** | `NEXT_PUBLIC_DISABLE_AUTH=true` can turn off auth with no production guard. | Only allow bypass when not production (e.g. dev/staging + Cypress). |
| **Weak CI** | PRs only run typecheck + Firestore rules; no unit tests, lint, or storage rules. | Add `npm test`, `npm run lint`, `npm run test:storage-rules` to CI. |

---

## Strengths

- **Domain & types:** Sessions, locations, users, and rules are well modeled.
- **Offline:** Queue, sync, and cache layers are mature and documented.
- **PWA:** Static export + service worker and push scaffolding in place.
- **Testing:** Unit, Firestore rules, and Cypress e2e exist; need CI and coverage expansion.
- **Deploy:** Production script, validation, and rollback tooling are comprehensive.

---

## Next 6 actions

1. **Security hotfixes** — Fix user-role rule, geofence for offline-sync, and auth-bypass guard.
2. **CI** — Add unit tests, lint, and storage-rules tests to the PR workflow.
3. **Test/docs** — Fix or remove references to missing `performance-accessibility.cy.ts` and related scripts.
4. **Functions tests** — Add integration tests for `startSession`, `endSession`, `cleanupStaleSessions`.
5. **Operations** — Require auth on sensitive callables; reduce PII in logs; standardize on `appLogger`.
6. **PWA** — Add missing notification icons/screenshots; enable provider `sessionAlerts` subscription flow.

---

## Success criteria (short)

- No privilege-escalation path in rules or functions.
- CI fails PRs when unit tests, lint, or rules tests fail.
- All documented test commands and workflows run successfully.
- Core check-in/check-out and timeout flows covered by automated tests.
- Timeout push reminders work for both providers and admins.
