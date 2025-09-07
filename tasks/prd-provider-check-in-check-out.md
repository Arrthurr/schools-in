# Provider Location-Based Check-In / Check-Out

## 1. Introduction / Overview
Providers of Title I services (e.g., Tutoring, Fine Arts, Counseling) frequently travel to multiple school campuses.  Schools and company staff (Program Managers) need auditable proof of each provider’s presence on site to comply with funding, billing, and safety requirements.  The proposed Progressive Web Application (PWA) will enable providers to **check-in** and **check-out** of a school location using GPS verification (mobile web) so administrators can accurately track time on campus and eliminate paper sign-in sheets.

## 2. Goals
1. Replace paper sign-in sheets at participating schools.
2. Provide verifiable location data proving a provider was physically on campus at check-in and check-out.
3. Allow administrators to export reliable attendance/session reports without manual cleanup.
4. Achieve ≥ 95 % successful provider check-ins/outs on the first attempt within the first month of rollout.

## 3. User Stories
- **As a Service Provider**, I want to see a list of my assigned schools so that I can quickly select the campus I am visiting.
- **As a Service Provider**, I want to check-in at a school and have the app confirm that I am physically on campus via GPS so that my session is considered valid.
- **As a Service Provider**, I want to check-out when I leave so that my session captures accurate start and end times.
- **As a Service Provider**, I want to review my past sessions so that I can confirm my logged time.
- **As a School Administrator**, I want to create and maintain school locations so that GPS boundaries are correct.
- **As a School Administrator**, I want to view and export attendance/session data so that I can meet compliance and billing needs.
- **As a School Administrator**, I want to correct or close erroneous open sessions so that reports remain accurate.

## 4. Functional Requirements
1. **Authentication**
   1. The system shall allow users to sign in with Google OAuth and/or email + password via Firebase Authentication.
2. **Role Management**
   1. The system shall support at least two roles: **Provider** and **Admin**.
   2. The system shall restrict Provider actions to their own sessions; Admins have full access.
3. **School Management (Admin-only)**
   1. The system shall allow Admins to create, edit, and delete school records (name, address, geo-coordinates, optional QR code).
4. **Provider Dashboard**
   1. The system shall display a list (and/or map) of schools assigned to the logged-in Provider.
5. **Check-In**
   1. The system shall allow a Provider to select a school and attempt check-in.
   2. The system shall fetch the device’s current GPS coordinates (with user permission).
   3. The system shall validate that the coordinates fall inside the school’s allowed radius (configurable per school, default 100 m).
   4. If validation passes, the system shall create a **session** record containing Provider ID, School ID, start timestamp, start GPS coordinates, and a blank end time.
   5. If validation fails, the system shall display an error explaining the Provider is not within range.
6. **Check-Out**
   1. The system shall allow a Provider to end the active session.
   2. The system shall capture end timestamp and end GPS coordinates, then mark the session as closed.
7. **Session History (Provider)**
   1. The system shall allow Providers to view a paginated list of their past sessions with date, school, and duration.
8. **Admin Reporting**
   1. The system shall allow Admins to filter sessions by Provider, School, and date range.
   2. The system shall allow Admins to export filtered results as CSV.
9. **Session Maintenance (Admin)**
   1. The system shall allow Admins to edit or force-close sessions in error.
10. **Offline Support**
    1. The PWA shall cache necessary assets and queued actions so Providers can check-in/out when offline; actions sync when connectivity returns.
11. **Accessibility & UX**
    1. The application shall be usable on modern mobile and desktop browsers.
    2. UI shall follow WCAG 2.1 AA contrast standards.

## 5. Non-Goals (Out of Scope for First Release)
- Parent-facing functionality.
- Push notifications or reminders.
- Payroll, invoicing, or third-party billing integrations.

## 6. Design Considerations
- Use Tailwind CSS v4 and shadcn/ui components.
- Apply brand color **#154690** and cooler blue tones throughout.
- Minimal, functional aesthetic inspired by social apps.
- A single brand asset (TBD) will be integrated once supplied.

## 7. Technical Considerations
- **Stack:** Next.js (React) PWA, Firebase Authentication, Firestore, Vite build (if desired), ESLint 9.
- **Firestore Data Model**
  - `locations` – id, name, address, latitude, longitude, radiusM, …
  - `users` – uid, role, displayName, assignedLocationIds[] …
  - `sessions` – id, providerUid, locationId, startAt, endAt, startCoords, endCoords, notes …
- Cloud Functions (future) may enforce additional validation or nightly report generation.
- Offline capability implemented via service worker (Next PWA plugin) and local persistence (IndexedDB or Firestore cache).

## 8. Success Metrics
1. ≥ 95 % of check-in/out attempts succeed on first try in production within 30 days of launch.
2. Admins can export a month-to-date CSV with zero manual data cleanup needed.
3. Paper sign-ins reduced by ≥ 90 % at pilot schools within 3 months.

## 9. Open Questions
- Max allowable GPS error radius per campus? (default 100 m acceptable?)
- Do Providers need ability to add a free-text note per session (e.g., “IEP meeting”)?
- Will QR code check-in be required in a subsequent phase?
- Any time-zone handling considerations for districts spanning zones?
- Brand asset delivery date? (Needed before final UI polish)
