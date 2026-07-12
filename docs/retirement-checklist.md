# schools-in Soft Retirement Checklist

**Project:** `schools-in-check` (this repo)  
**Former live URL:** https://schools-in-check.web.app  
**Firebase / GCP project:** `schools-in-check` (keep the project; decommission services)  
**Replacement:** [CampusAccess](https://github.com/Arrthurr/dmdl-location-native) — local path `~/Developer/dmdl-location-native/`  
**Admin (replacement):** https://ca-admin.dmdlinc.com  

**Goal:** Soft retire production. Decommission Firebase backends (especially Firestore). Keep the **GitHub repo** (archive, do not delete) for portfolio. Users already informed — no farewell Hosting page.

**Out of scope:** Deleting the Firebase/GCP project. Deleting the GitHub repository.

---

## Phase 2 — Export data

Keep exports **outside** the live app paths (local disk or a bucket you control long-term).

### Firestore

- [x] Managed export completed (GCP → Firestore → [Import/Export](https://console.cloud.google.com/firestore/import-export?project=schools-in-check))
- [x] Download / copy the export out of any bucket that will be emptied or deleted in Phase 5
- [x] Spot-check: export metadata / sample docs look sane

### Storage (recommended if you still need images/attachments)

- [x] Inventory / export complete (or skipped — not needed for soft retire)

### Auth roster (optional)

- [x] Skipped or complete

### Export gate

- [x] Exports you care about are verified readable **before** Phase 5 deletes Firestore data / Storage objects

**Phase 2 complete.** → Continue with Phase 3.

---

## Phase 3 — Kill live behavior

Stop mutations, schedules, and client access. Project stays; production stops.

### Stop CI from redeploying

- [x] Disable deploy workflow: renamed to [`.github/workflows/deploy.yml.disabled`](../.github/workflows/deploy.yml.disabled) (local)
- [ ] Commit and push the rename so `origin/main` no longer has an active `deploy.yml` (until then, GitHub still runs the remote file)
- [ ] Confirm nothing else redeploys this project (other workflows, local scripts, teammates) — `ci.yml` remains; it does not deploy

### Cloud Functions

Includes session APIs, `cleanupStaleSessions`, `checkLateProviders`, `generateDailyStats`, M365 sync, push/VAPID helpers, feedback notify.

- [ ] List: `firebase functions:list --project schools-in-check`
- [ ] Delete all functions (Console → Functions, or `firebase functions:delete … --project schools-in-check`)
- [ ] Confirm [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=schools-in-check) has no leftover jobs

### Auth

- [ ] Disable all sign-in providers: [Authentication → Sign-in method](https://console.firebase.google.com/project/schools-in-check/authentication/providers)

### Hosting

- [ ] Disable or clear Hosting for site `schools-in-check` (Console → Hosting → manage site / unrelease), **or** leave a blank/minimal page — no farewell required
- [ ] Confirm https://schools-in-check.web.app no longer serves the live app (or is intentionally blank)

### Lockdown (until Phase 5 data purge)

- [ ] Deploy deny-all Firestore + Storage rules so nothing can read/write while you finish teardown

---

## Phase 4 — Revoke external secrets & credentials

Stop spend and risk outside GCP. Safe for portfolio: secrets never belonged in the public repo history as “features.”

### Microsoft Entra / M365 (`syncUserFromM365`)

- [ ] Locate the schools-in app registration (`MS_CLIENT_ID` / `MS_TENANT_ID` from local env — do not commit values)
- [ ] If **not** shared with CampusAccess: delete secrets or disable/delete the app registration
- [ ] If **shared** with CampusAccess: only remove obsolete schools-in redirect URIs / permissions

### SendGrid

- [ ] Revoke `SENDGRID_API_KEY` if it was used for `notifyOnFeedback`

### Web Push (VAPID)

- [ ] Discard VAPID public/private keys / email config (harmless once Functions are gone)

### Google Maps

- [ ] Restrict or delete `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if it was schools-in-only

### GitHub (keep repo; scrub secrets)

- [ ] Delete Actions secrets/variables (Firebase config, `FIREBASE_SERVICE_ACCOUNT`, Maps key, etc.)
- [ ] Do **not** delete the repository

### Local machines

- [ ] Remove local `.env*`, `serviceAccountKey.json`, and admin SDK keys for `schools-in-check`
- [ ] Confirm teammates do the same

---

## Phase 5 — Decommission Firebase services (do not delete the GCP project)

Goal: no production Firestore / Storage / Functions cost or surface. Keep the empty (or near-empty) Firebase project if useful for console history; **do not** delete `schools-in-check` unless you later change your mind.

### Firestore

- [ ] Confirm Phase 2 export is safe offline
- [ ] Delete application data (Console bulk delete, scripted wipe, or **Delete database** under Firestore settings if you want the service fully gone)
- [ ] Prefer **delete the Firestore database** (or empty all collections) over leaving data behind deny-all — that actually decommissions the service
- [ ] Confirm no active Firestore databases / no meaningful document storage remaining

### Storage

- [ ] Empty or delete Storage buckets used by the app (after any Storage export you need)
- [ ] Confirm bucket(s) are empty or removed

### Functions / Scheduler / Auth (confirm)

- [ ] No Cloud Functions remain
- [ ] No Cloud Scheduler jobs remain
- [ ] Auth providers stay disabled (users can remain; they cost nothing meaningful)

### Billing check

- [ ] [GCP Billing](https://console.cloud.google.com/billing) for `schools-in-check` shows near-zero ongoing usage (no Functions invocations, no Firestore reads/writes/storage, no Hosting bandwidth of consequence)

---

## Phase 6 — Retire the GitHub repo (archive, do not delete)

Portfolio-friendly end state: public or private-as-you-prefer, **archived**, README explains what it was and that CampusAccess replaced it.

- [ ] Update root `README.md` with a retired banner, e.g.:

  > **Retired (soft).** Internal school check-in PWA, replaced by **CampusAccess** ([dmdl-location-native](https://github.com/Arrthurr/dmdl-location-native)). Former Firebase project: `schools-in-check`. Code kept for portfolio — do not deploy.

- [ ] Optionally note admin successor: https://ca-admin.dmdlinc.com
- [ ] Optionally update `AGENTS.md` / `CLAUDE.md` live-URL lines so they don’t imply production is active
- [ ] Disable deploy/CI workflows (keep files in git history if you want them visible)
- [ ] Remove remaining repo secrets (if any left from Phase 4)
- [ ] GitHub → Settings → **Archive this repository** (read-only, still cloneable and portfolio-visible)
- [ ] Confirm the repo URL still loads and shows the retired README

**Do not:** Delete the GitHub repository.

---

## Done when

- [ ] Firestore export retained offline; Firestore service emptied or database deleted
- [ ] Storage emptied/removed if decommissioned
- [ ] No Cloud Functions / Scheduler; Auth sign-in disabled; Hosting not serving the live app
- [ ] External credentials revoked or owned only by CampusAccess
- [ ] Firebase/GCP project `schools-in-check` still exists (or explicitly kept as an empty shell)
- [ ] GitHub repo **archived**, not deleted, with a clear retired README for portfolio

---

## Quick reference

| Item | Soft-retire disposition |
|------|-------------------------|
| GitHub repo | Keep + **archive** (portfolio) |
| Firebase/GCP project | Keep; decommission services |
| Firestore | Export done → delete data / delete database |
| Storage | Export if needed → empty / delete |
| Cloud Functions | Delete all |
| Auth | Disable providers |
| Hosting | Disable or blank; no farewell page |
| CampusAccess | Successor — https://ca-admin.dmdlinc.com |
| Firebase docs (this repo) | [`docs/agents/firebase.md`](agents/firebase.md) |
