## Relevant Files

- `src/lib/firebase/types.ts` - ✅ Defines the `User`, `Location`, and `Session` data structures with enhanced types for dashboard metrics.
- `src/lib/utils/time.ts` - ✅ Utility functions for timezone-aware date calculations (e.g., `getDayKey`, `getWeekRange` for "America/Chicago").
- `src/lib/utils/geo.ts` - ✅ Utility function for Haversine distance calculation and geofencing validation.
- `src/lib/services/cachedSessionService.ts` - ✅ Service for managing session data with Firestore, including `startSession`, `endSession`, and fetching session-related metrics.
- `src/lib/hooks/useProviderMetrics.ts` - ✅ Hook that provides real-time data for the Provider Dashboard (current session, weekly stats, session management).
- `src/components/provider/ProviderDashboardCards.tsx` - ✅ Main dashboard cards component with real-time metrics and session controls.
- `src/components/provider/ProviderDashboardTest.tsx` - ✅ Comprehensive test component for validating dashboard functionality.
- `src/lib/hooks/useAdminMetrics.ts` - To create a hook that provides real-time data for the Admin Dashboard (active providers, check-in stats, etc.).
- `src/app/dashboard/page.tsx` - To replace mock data and handlers with the new `useProviderMetrics` hook.
- `src/components/admin/AdminDashboard.tsx` - To replace placeholder stats with live data from the new `useAdminMetrics` hook.
- `src/components/admin/CsvExportButton.tsx` - To create a new component that allows admins to export session data.
- `firestore.rules` - ✅ Security rules for the `sessions` and `assignments` collections with provider/admin access controls.
- `firestore.indexes.json` - ✅ Composite indexes for efficient session querying by user, date, and status.
- `functions/src/index.js` - ✅ Callable function (`startSession`) to enforce the "one active session per provider" rule atomically.

### Notes

- Unit tests should be created alongside the files they are testing (e.g., `time.test.ts` for `time.ts`).
- Use `npm test -- path/to/file.test.ts` to run specific tests.

## Tasks

- [x] **1.0 Foundation: Firestore and Utilities**

  - [x] 1.1 Define the `User`, `Location`, and `Session` types in `src/lib/firebase/types.ts` according to the PRD.
  - [x] 1.2 Create `src/lib/utils/time.ts` with functions to handle timezone conversions and date calculations for "America/Chicago".
  - [x] 1.3 Create `src/lib/utils/geo.ts` with a function to calculate the distance between two GPS coordinates (Haversine formula).
  - [x] 1.4 Update `firestore.indexes.json` with the composite indexes specified in the PRD for the `sessions` collection.
  - [x] 1.5 Update `firestore.rules` to include security rules for `sessions` and `assignments`, ensuring providers can only manage their own sessions and admins have full access.

- [x] **2.0 Core Services: Session and Data Management**

  - [x] 2.1 Create a callable cloud function in `functions/src/index.ts` named `startSession` that checks if a provider already has an active session before creating a new one.
  - [x] 2.2 Create `src/lib/services/cachedSessionService.ts` to handle all Firestore interactions for sessions (create, update, fetch).
  - [x] 2.3 Implement `startSession` in the service, which calls the new callable function and validates the provider's location against the geofence.
  - [x] 2.4 Implement `endSession` in the service to update the session status, set the end time, and calculate the final duration.

- [x] **3.0 Provider Dashboard: UI Implementation**

  - [x] 3.1 Create the `useProviderMetrics` hook to fetch and manage the data needed for the provider dashboard cards.
  - [x] 3.2 The hook should expose the user's current active session (if any).
  - [x] 3.3 The hook should expose the number of completed sessions for the current week (Sun-Sat, America/Chicago).
  - [x] 3.4 The hook should expose the total hours for all completed sessions this week.
  - [x] 3.5 In `src/app/dashboard/page.tsx`, replace the mock state and handlers with the `useProviderMetrics` hook.
  - [x] 3.6 Wire the "Current Status", "This Week", and "Total Hours" cards to the data from the hook.

- [x] **4.0 Admin Dashboard: UI Implementation**

  - [x] 4.1 Create the `useAdminMetrics` hook to fetch the data required for the admin dashboard.
  - [x] 4.2 The hook should provide the number of active providers and active sessions.
  - [x] 4.3 The hook should provide the number of check-ins for today and yesterday to calculate the percentage change.
  - [x] 4.4 The hook should provide the average session duration in hours over the last 30 days.
  - [x] 4.5 The hook should provide a list of the 5 most recent session activities.
  - [x] 4.6 In `src/components/admin/AdminDashboard.tsx`, integrate the `useAdminMetrics` hook.
  - [x] 4.7 Update the "Active Providers", "Today's Check-ins", "Avg Session Duration", and "Recent Activity" cards with live data.

- [x] **5.0 Advanced Features: CSV Export and Reminders**

  - [x] 5.1 Create a utility function to convert an array of `Session` objects into a CSV string.
  - [x] 5.2 Create a new component, `CsvExportButton.tsx`, that allows an admin to specify a date range and trigger a CSV download.
  - [x] 5.3 Add the `CsvExportButton` to the admin dashboard.
  - [x] 5.4 Implement the logic for the 2-hour auto check-out reminder (client-side notification).

- [x] **6.0 Testing and Validation**
  - [x] 6.1 Write unit tests for the utility functions in `time.ts` and `geo.ts`.
  - [x] 6.2 Write unit tests for the metric calculations within the `useProviderMetrics` and `useAdminMetrics` hooks using mock data.
  - [x] 6.3 Manually test the end-to-end flow in the emulator: check-in, check-out, and verify that the dashboard metrics update correctly for both provider and admin roles.
  - [x] 6.4 Verify that Firestore security rules correctly block unauthorized access (e.g., a provider trying to access another provider's session data).
  - [x] 6.5 Run `npm run lint:fix` and `npm run build` to ensure there are no errors.
