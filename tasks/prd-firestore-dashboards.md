# PRD: Firestore Integration and Dashboard Metrics (Provider + Admin)

## 1) Introduction / Overview

This feature connects the existing Next.js app to Firestore to power the Provider and Admin Dashboards with real-time, accurate session and location data. It defines collections, fields, security, and queries needed to:

- Track provider sessions (check-in to check-out) with geofencing.
- Display weekly and daily metrics for providers and admins.
- Support offline usage with safe synchronization.

Primary timezone: America/Chicago. Calendar week: Sunday–Saturday.

## 2) Goals

- Implement Firestore-backed data for users, locations (schools), and sessions.
- Provider Dashboard shows:
  - Current Status: active session (if any).
  - This Week: count of completed sessions in current calendar week.
  - Total Hours: sum of completed session hours this week, rounded to 1 decimal.
- Admin Dashboard shows:
  - Active Providers: distinct providers currently in active sessions.
  - Active Sessions: total sessions with status=active.
  - Today’s Check-ins: count of sessions started today with % change vs yesterday.
  - Avg Session Duration: average duration of completed sessions in the last 30 days (hours).
  - Recent Activity: session events list (check-in, check-out, pauses/resumes).
- Enforce one active session per provider.
- Require geofence validation within 100 meters at check-in.
- Support offline start/end with proper flags and admin-only overrides.
- Provide CSV export for admins (sessions by date range).
- Maintain performance with appropriate indexes and caching hooks/services.

## 3) User Stories

- As a provider, I want to check in at a school only when I’m on-site so my time is recorded accurately.
- As a provider, I want to see whether I’m currently checked in and where.
- As a provider, I want to see how many sessions I’ve completed this week and the total hours so I can track my workload.
- As an admin, I want to see how many providers are currently active and the total number of active sessions.
- As an admin, I want to see how many sessions were started today and how that compares to yesterday.
- As an admin, I want to see the average session duration over the last 30 days.
- As an admin, I want a recent activity feed to audit check-ins and check-outs.
- As an admin, I want to export session data in CSV format for reporting.

## 4) Functional Requirements

1. Firestore Collections (Top-level)
   1. users
      - Fields:
        - uid (string, doc id)
        - role (string: 'provider' | 'admin')
        - displayName (string)
        - email (string)
        - photoURL (string, optional)
        - disabled (boolean, default false)
        - isActive (boolean, default true)
        - createdAt (timestamp)
        - lastActiveAt (timestamp)
   2. locations
      - Fields:
        - id (string, doc id)
        - name (string)
        - address (string)
        - geo (GeoPoint)
        - radiusMeters (number, default 100)
        - timezone (string, default "America/Chicago")
        - active (boolean, default true)
        - assignedProviders (array<string> of userIds) // authoritative for RBAC per existing security rules
        - createdAt (timestamp)
        - updatedAt (timestamp)
   3. sessions
      - Fields:
        - id (string, doc id)
        - userId (string)
        - locationId (string)
        - startTime (timestamp)
        - endTime (timestamp, optional until completed)
        - status (string: 'active' | 'paused' | 'completed' | 'cancelled')
        - durationMinutes (number, derived on completion; excludes paused time)
        - checkInMethod (string: 'geo' | 'manual' | 'offline-sync')
        - distanceFromCenterAtCheckIn (number, meters)
        - dayKey (string, YYYY-MM-DD for America/Chicago, computed from startTime)
        - notes (string, optional)
        - createdAt (timestamp)
        - updatedAt (timestamp)
2. Session Lifecycle
   - Create session: provider can create with status 'active' if within geofence (100m).
   - Pause session: status transitions allowed: active → paused; paused → active.
   - Complete session: active/paused → completed; set endTime; compute durationMinutes (exclude paused intervals).
   - Only one active session per provider is allowed at a time.
   - Auto check-out reminder at 2 hours for active sessions (notification-only; does not auto-complete).
3. Geofencing
   - On check-in, client must measure device location and compute distance to location.geo.
   - Check-in allowed only if distance <= radiusMeters (default 100m).
   - Record distanceFromCenterAtCheckIn.
   - Offline check-in allowed but flagged as checkInMethod='offline-sync' and requires later geofence verification; if unverifiable, mark session for admin review.
4. Timezone & Week Definition
   - Use America/Chicago for all date derivations.
   - dayKey computed from startTime in America/Chicago.
   - Week: Sunday–Saturday.
5. Provider Dashboard Data
   - Current Status:
     - Show active session if exists: location name, start time, elapsed time.
   - This Week (count):
     - Count of sessions with status='completed' where endTime falls within current week window.
   - Total Hours (this week):
     - Sum of durationMinutes for completed sessions this week, display hours rounded to 1 decimal.
6. Admin Dashboard Data
   - Active Providers:
     - Count of distinct userId where sessions.status='active'.
   - Active Sessions:
     - Count of sessions where status='active'.
   - Today’s Check-ins:
     - Count sessions with startTime in today (America/Chicago) vs yesterday; compute percentage change.
   - Avg Session Duration:
     - Average durationMinutes over last 30 days among sessions with status='completed'; display in hours to 1 decimal.
   - Recent Activity:
     - Show up to 5 most recent session events (check-in, pause, resume, check-out) with timestamp, user, and location.
7. CSV Export (Admin)
   - Admin can export sessions by date range (start/end dates in America/Chicago) to CSV:
     - Columns: user, location, startTime, endTime, status, durationMinutes, checkInMethod, distanceFromCenterAtCheckIn, notes.
8. Security & Access
   - Admin: full read/write on users, locations, sessions (per rules).
   - Provider:
     - Read/write only their sessions.
     - Read only assigned locations (via locations.assignedProviders contains userId).
     - Cannot edit sessions after status='completed'.
     - Manual override edits are admin-only.
9. Offline Behavior
   - Allow creating/updating sessions offline; sync on reconnect.
   - Mark offline-created check-ins as 'offline-sync' and flag if geofence was not validated at creation time.
10. Indexing (Composite)

- sessions:
  - [userId, status, dayKey]
  - [status, startTime desc]
  - [userId, endTime]
  - [locationId, dayKey]
- locations:
  - [active, name] (optional for admin list sorting)

11. Caching & Hooks

- Use existing cached services and hooks:
  - useCachedAuth for user/role.
  - useCachedSession (create, pause, resume, complete, and live subscription).
  - cachedSchoolService for locations.

12. Acceptance Criteria

- Provider Dashboard cards display correct values given seeded data in emulator and in production.
- Admin Dashboard cards display correct counts and averages with emulator and production data.
- Attempting to start a second active session for the same provider is blocked (callable function or transactional guard).
- Check-in beyond 100m is blocked in the client; server marks offline sessions accordingly.
- CSV export downloads a file with the specified columns and filters.

## 5) Non-Goals (Out of Scope)

- Multi-tenant or organizational partitioning.
- Payroll, invoicing, or billing logic.
- Full audit/event subcollections (beyond what is needed for Recent Activity).
- Automated geo-overrides; manual/admin overrides only.
- Automated end at midnight (not required).

## 6) Design Considerations

- Keep dashboards accessible and fast via cached hooks and lightweight queries.
- Display timezone-aware timestamps (America/Chicago).
- Summaries should handle zero states gracefully (e.g., no activity yet).
- Distinguish “Active Providers” (distinct users) from “Active Sessions” (total active sessions).

## 7) Technical Considerations

- Field Names
  - Use startTime/endTime (timestamps) and durationMinutes for precise calculations.
  - Use dayKey (YYYY-MM-DD in America/Chicago) for common “today/yesterday” filters and weekly grouping if needed.
- One Active Session Enforcement
  - Prefer callable Cloud Function (startSession) that atomically checks for existing active/paused sessions for userId before creating a new one.
  - Fallback: client-side check + server-side onCreate validator (function) with compensating cancellation if violation detected.
- Geofencing
  - Client computes distance to location.geo using Haversine.
  - For offline, tag as offline-sync; on sync, best-effort verify with latest known location or mark as needs-review.
- Indexes
  - Add composite indexes listed above in firestore.indexes.json.
- Security Rules
  - Align with existing rules:
    - locations.assignedProviders used for provider read access.
    - sessions create only with status in ['active', 'paused'] (we will create with 'active').
    - Validate transitions per provided rules.
  - Providers cannot update completed sessions.
  - Manual overrides (e.g., editing distance or times) restricted to admins.
- Timezone Utils
  - Use a shared util to compute dayKey and time windows for “today,” “yesterday,” and the current week in America/Chicago.
- CSV Export
  - Client-side generation (streamed) or a callable function that returns a signed URL to a generated CSV stored in Firebase Storage.
- Performance
  - Use pagination or limit for admin tables/lists.
  - Reuse cached services; avoid N+1 queries by preloading user and location maps for Admin cards.
- Assignments Model Note
  - You selected a separate assignments collection. Current security rules rely on locations.assignedProviders. For this phase, we will continue using assignedProviders in locations for RBAC and queries. A separate assignments collection can be added later for reporting; see Open Questions.

## 8) Success Metrics

- Provider Dashboard loads above metrics in < 750ms median on broadband.
- Admin Dashboard loads key cards in < 1s median on broadband.
- > 95% of check-ins occur within 100m of the target location.
- <1% session creation attempts fail due to race conditions for “one active session.”
- CSV export completes in < 5 seconds for 10k sessions.

## 9) Open Questions

1. Pause/Resume: Confirm that pause/resume is fully supported in UI and data (current code shows handlers). If yes, we’ll track paused intervals to exclude from durationMinutes.
2. Assignments collection: Do we want to add a 4th top-level collection (“assignments”) now, or defer and keep locations.assignedProviders as the source of truth for this release?
3. Recent Activity: Are pause/resume events required in the feed, or only check-in/out? Proposed: show all session status transitions, limited to 5 items.
4. CSV Export: Is client-side generation acceptable, or should we generate via Cloud Function (recommended for large datasets)?
5. Offline geofence validation: If we can’t verify location after sync, should those sessions be flagged for admin review with a dedicated status (e.g., 'needs-review') or a boolean field (needsReview=true)?

## 10) Implementation Notes (for developers)

- Queries
  - Provider “This Week” and “Total Hours”:
    - Compute [weekStart, weekEnd) in America/Chicago.
    - Query sessions where userId == currentUserId AND status == 'completed' AND endTime in range.
    - Sum count and durationMinutes; convert minutes to hours (1 decimal).
  - Admin “Today’s Check-ins”:
    - Compute today and yesterday [start, end) windows in America/Chicago.
    - Count sessions with startTime in each window; compute delta %.
  - Active counts:
    - Active Providers: query sessions where status=='active', map distinct userId count.
    - Active Sessions: count sessions where status=='active'.
  - Recent Activity:
    - Order by updatedAt desc (or startTime/endTime events), limit 5, across sessions.
- Hooks/Services
  - Prefer useCachedAuth and useCachedSession; add utility methods:
    - startSession({ locationId, position }) → validates geofence, creates session.
    - pauseSession(sessionId), resumeSession(sessionId), endSession(sessionId).
  - cachedSchoolService: add getAssignedLocations(userId) using locations.assignedProviders array-contains.
- UI
  - Provider cards already scaffolded; wire to hooks and replace mock values.
  - Admin cards: implement queries and subscriptions where appropriate.
- Notifications
  - Auto check-out reminder at 2 hours: local notification or in-app banner; optional Cloud Function to send FCM if enabled.

## 11) Testing

- Unit tests for:
  - dayKey and week range utilities (America/Chicago).
  - durationMinutes calculation including pause/resume.
  - geofence distance calculation.
- Integration/E2E:
  - Emulator tests for session lifecycle and dashboard metrics.
  - Security rules tests: providers cannot read others’ sessions, cannot modify completed sessions.
