---
title: "feat: Schedules Admin Page & Provider Schedule Page"
type: feat
status: active
date: 2026-03-16
---

# feat: Schedules Admin Page & Provider Schedule Page

## Overview

Surface the existing but underutilised Schedules feature in two dedicated views:

1. **A dedicated Admin Schedules page** (`/admin/schedules`) — a unified view for managing all provider schedules, replacing the buried modal in the Users page.
2. **A dedicated Provider Schedules page** (`/dashboard/schedules`) — a read-only view for providers to see their schedules per school, accessible from the provider navigation.

Both outcomes leverage existing infrastructure: `scheduleService.ts` already provides all required data access methods, and `ScheduleManager.tsx` already handles the full create/edit/delete UI.

---

## Problem Statement / Motivation

- **Admin UX**: Schedule management is buried inside the Users page as a modal. There is no dedicated place to audit or manage all provider schedules across the organisation.
- **Provider UX**: Providers have no visibility into their own schedules. With manual check-in/out as the default session start method, knowing *when* they are expected at a school is useful context — and deserves its own page rather than being appended to a location details sheet.
- **Extensibility**: A dedicated `/dashboard/schedules` route creates a natural foundation for future features (e.g. schedule-based check-in suggestions, week view, calendar sync).

---

## Proposed Solution

### Outcome 1 — Admin Schedules Page

Create `src/app/admin/schedules/page.tsx`:

- Fetches all users with `role === "provider"` and displays them in a searchable table.
- "Manage" button per row opens the existing `ScheduleManager` dialog — no refactor of that component needed.
- Add a "Schedules" entry to `AdminNavigation.tsx`.
- Remove the "Manage schedule" button and embedded `ScheduleManager` from `src/app/admin/users/page.tsx`.

### Outcome 2 — Provider Schedules Page

Create `src/app/dashboard/schedules/page.tsx`:

- Fetches all active schedules for the current provider via `getSchedulesByProvider(uid)`.
- Groups schedules by school (location), then by day of week within each school.
- Each schedule entry shows: day name, service name, start time, end time.
- Empty state when no schedules exist.
- Add a "Schedules" entry to `ProviderNavigation.tsx`.

---

## Technical Considerations

### Admin Page Architecture

`ScheduleManager` already accepts `{ providerId, providerName, isOpen, onClose }` — it can be reused as a dialog trigger unchanged.

The provider list on the admin page can be fetched via the existing pattern from `admin/users/page.tsx` (Firestore query on the `users` collection with `where("role", "==", "provider")`).

**Page layout:**
```
/admin/schedules
├── Page title: "Schedules"
├── Search input (filter by provider name)
└── Table: Provider Name | Actions
              └── "Manage" button → <ScheduleManager> dialog
```

Schedule counts per provider are a nice-to-have enhancement — omit in v1 to keep the initial load fast.

### Provider Schedules Page Architecture

**Data fetching:**
- `getSchedulesByProvider(uid)` — returns all active schedules for the provider.
- The response includes `locationId` and `serviceId` strings. To display human-readable names, fetch locations via `userService` or a location service (providers only have access to their assigned locations), and all active services via `getAllServices()` (same pattern `ScheduleManager` uses internally).

**Data organisation on the page:**
```
/dashboard/schedules
├── Page title: "My Schedules"
└── Per school card (Location name)
    └── Per day rows, sorted by dayOfWeek then startTime
        └── Day name | Service name | Start–End time
```

**Routing:** New page at `src/app/dashboard/schedules/page.tsx`, protected with `ProtectedRoute` for `["provider"]`.

**Navigation:** Add to `ProviderNavigation.tsx` `navigationItems`:
```typescript
{
  href: "/dashboard/schedules",
  label: "My Schedules",
  icon: CalendarClock,   // lucide-react, already used in admin area
}
```

Current nav items: Dashboard → Session History → Feedback. "My Schedules" fits between Dashboard and Session History.

### Removing Schedules from Admin Users Page

The "Manage schedule" button (lines 518–527 of `admin/users/page.tsx`) and the bottom-of-page `ScheduleManager` render (lines 552–559) will be removed. The `scheduleUser` state and `handleManageSchedule` handler are also safe to remove.

---

## System-Wide Impact

- **Interaction graph:** The new provider page adds Firestore reads at page load: `getSchedulesByProvider` + `getAllServices` (+ optionally `getAssignedLocations`). These are bounded by the provider's own data — no fan-out concern.
- **Error propagation:** Data fetch failures on the provider page should display an inline error state, not crash the page. Wrap in try/catch and use `appLogger.error`.
- **State lifecycle risks:** Removing the schedule modal from `admin/users/page.tsx` is a clean deletion — no orphaned state, no DB migration needed.
- **API surface parity:** No agent tool surfaces schedules today; this change doesn't affect that surface.
- **Integration test scenarios:**
  1. Admin opens `/admin/schedules`, opens ScheduleManager for a provider, creates a schedule — verify it appears in the provider's `/dashboard/schedules`.
  2. Provider with no schedules sees empty state on `/dashboard/schedules`.
  3. Provider with schedules at multiple schools sees per-school grouping.

---

## Acceptance Criteria

### Admin Schedules Page (`/admin/schedules`)
- [ ] Page is accessible to `role === "admin"` only (ProtectedRoute)
- [ ] All providers are listed; search filters by name
- [ ] "Manage" button opens `ScheduleManager` dialog for the selected provider
- [ ] Schedules can be created, edited, and soft-deleted from this page
- [ ] "Schedules" nav item appears in the admin sidebar
- [ ] Schedule management (button + modal) removed from `admin/users/page.tsx`

### Provider Schedules Page (`/dashboard/schedules`)
- [ ] Page is accessible to `role === "provider"` only (ProtectedRoute)
- [ ] "My Schedules" (or "Schedules") appears in the provider navigation
- [ ] Schedules are grouped by school, then ordered by day of week and start time
- [ ] Each entry shows: day name, service name, start–end time
- [ ] **View-only** — no create, edit, or delete controls are shown to providers
- [ ] Empty state shown when provider has no active schedules
- [ ] Loading skeleton shown while fetching
- [ ] Error state shown on fetch failure

### General
- [ ] `appLogger` used for all error logging (replace any `console.error` in touched files)
- [ ] `npx tsc --noEmit` passes
- [ ] No new ESLint warnings

---

## Success Metrics

- Admins can reach any provider's schedules in ≤ 2 clicks from the admin nav.
- Providers can view their full schedule in ≤ 1 tap from the nav bar.
- No regressions to existing schedule CRUD flows.

---

## Dependencies & Risks

| Item | Detail |
|------|--------|
| Location name resolution on provider page | Need to map `locationId` → display name. Use `getAssignedLocations(uid)` from an existing service, or confirm `locationService` has a suitable method. |
| `getAllServices()` in provider context | Confirm this is not admin-only in Firestore rules; `ScheduleManager` calls it as a provider-level read already so it should be fine. |
| `ScheduleManager` `console.error` | Replace with `appLogger.error` as part of this work. |
| Clean removal from Users page | Verify no other code depends on `scheduleUser` state in `admin/users/page.tsx` before deleting. |

---

## Files to Create / Modify

| Action | File |
|--------|------|
| **Create** | `src/app/admin/schedules/page.tsx` |
| **Create** | `src/app/dashboard/schedules/page.tsx` |
| **Modify** | `src/components/admin/AdminNavigation.tsx` — add Schedules nav item |
| **Modify** | `src/components/provider/ProviderNavigation.tsx` — add My Schedules nav item |
| **Modify** | `src/app/admin/users/page.tsx` — remove schedule modal and related state |
| **Modify** | `src/components/schedules/ScheduleManager.tsx` — replace `console.error` with `appLogger.error` |

---

## Sources & References

### Internal References

- `ScheduleManager` component: `src/components/schedules/ScheduleManager.tsx`
- Schedule service: `src/lib/services/scheduleService.ts`
- Schedule type: `src/lib/firebase/types.ts:90–102`
- Admin navigation: `src/components/admin/AdminNavigation.tsx:38–81`
- Provider navigation: `src/components/provider/ProviderNavigation.tsx:29–45`
- Admin users page (current home of ScheduleManager): `src/app/admin/users/page.tsx:518–559`
- Provider school list: `src/components/provider/SchoolList.tsx`
- Provider dashboard: `src/app/dashboard/page.tsx`

### Related Work

- Manual check-in/out feature (context for why schedules matter to providers): PR #89
