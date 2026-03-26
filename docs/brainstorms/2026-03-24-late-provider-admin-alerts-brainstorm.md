# Brainstorm: Late Provider Admin Alerts

**Date:** 2026-03-24
**Status:** Draft

---

## What We're Building

A background Cloud Function that detects when scheduled providers haven't checked in within 15 minutes of their scheduled start time, and sends push notifications to all admins so they can follow up.

This fills a real gap: admins currently have no way to know a provider is a no-show until they happen to look at the dashboard. With this feature, admins are proactively alerted and can act immediately.

---

## Why This Approach

We chose **Approach 1: Scheduled Cloud Function** because:

- It mirrors the existing `cleanupStaleSessions` pattern exactly — same scheduler skeleton, same admin push flow, same deduplication flag approach
- Push notifications reach admins regardless of whether they have the app open
- No new infrastructure (no Cloud Tasks, no client polling)
- Runs every 30 minutes, matching the existing cleanup scheduler cadence

---

## Context & Existing Patterns

- **`Schedule` type** exists with `providerId`, `locationId`, `dayOfWeek`, `startTime` (HH:MM), `isActive` — this is the source of expected check-in times
- **Schedule coverage is partial** — only some providers have schedules; providers without schedules are simply excluded from lateness checks
- **Admin push notifications** use `web-push` via VAPID, delivered to `users/{uid}/pushSubscriptions/adminAlerts` — fully established in `cleanupStaleSessions`
- **Deduplication pattern**: `warningNotificationSent: true` on `Session` is the reference; for lateness we can't use Session (it doesn't exist yet), so we use a separate `latenessAlerts` collection

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Trigger mechanism | Scheduled Cloud Function (every 30 min) | Mirrors existing `cleanupStaleSessions` pattern |
| Grace period | 15 minutes after `startTime` | Sufficient buffer for minor delays; avoids noise |
| Grace period configurability | Hardcoded constant to start | YAGNI — can be made configurable later if needed |
| Alert recipients | All admins (role == "admin") via push | Consistent with existing admin alert pattern |
| Deduplication | `latenessAlerts/{scheduleId}-{startTime}-{YYYY-MM-DD}` document | Can't use Session (doesn't exist yet); keyed by slot+date so each slot alerts independently |
| Scope | Only providers with active schedules | No schedule = no expected arrival = nothing to alert on |

---

## Data Flow

```
Every 30 min: checkLateProviders()
  → Query schedules where dayOfWeek == today AND isActive == true
  → For each schedule where now > startTime + 15 min:
      → Check if latenessAlerts/{scheduleId}-{startTime}-{today} exists → skip if so
      → Check if active session exists for provider+location today → skip if so
      → Send push to all admins
      → Write latenessAlerts/{scheduleId}-{startTime}-{today} to prevent re-alert
```

---

## Resolved Questions

- **Who receives alerts?** All admins via push (same as existing cleanup alerts)
- **What is the grace period?** 15 minutes, hardcoded constant
- **Resolution notification?** No — one alert is enough; admins can check the dashboard if they want updates
- **Multi-session schedules?** Yes — each slot is checked independently; deduplication key includes `startTime` so both a 9am and 1pm slot can alert separately
- **Admin review flag?** Push only — no Firestore flag; the alert is self-contained

---

## Open Questions

_None — all questions resolved._

---

## Out of Scope

- Per-location or per-schedule configurable grace periods (can add later)
- In-dashboard "expected today" view (could complement this but is separate work)
- SMS or email delivery (push only, matching existing pattern)
- Historical reporting on lateness patterns
