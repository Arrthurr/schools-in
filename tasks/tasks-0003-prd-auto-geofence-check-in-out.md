## Relevant Files

- `src/lib/hooks/useSession.ts` - Existing session management hook providing `checkIn`/`checkOut` APIs to integrate auto flows.
- `src/lib/hooks/useCachedSession.ts` - Cached session state used to determine active session and current school context.
- `src/lib/hooks/useLocation.ts` - Hook for obtaining current GPS location and handling browser geolocation permissions.
- `src/lib/services/locationService.ts` - Location utilities including `getAssignedLocations`, distance calculations, and geofence radius usage.
- `src/lib/services/cachedSessionService.ts` - Session service with geofence-related helpers such as `validateSessionGeofence`.
- `src/lib/utils/location.ts` - Utility helpers for geospatial calculations that can support geofence state transitions.
- `src/lib/hooks/useAutoGeofenceCheck.ts` - New hook implementing auto geofence polling, state machine, and trigger logic.
- `src/components/provider/ProviderDashboardCards.tsx` - Provider dashboard surface where auto-mode indicators can be displayed.
- `src/components/provider/SessionStatus.tsx` - Component showing current session state; candidate for surfacing auto-mode status.
- `src/components/provider/CheckInButton.tsx` - Existing manual check-in/out UI that must coexist with auto-mode.
- `src/components/provider/SessionTimerDisplay.tsx` - Displays session duration for use in checkout notifications.
- `src/components/ui/switch.tsx` - UI switch component for the auto check-in/out preference toggle.
- `src/components/ui/enhanced-toast.tsx` - Enhanced toast system (`sonner`) for countdown notifications and alerts.
- `src/components/ui/use-toast.ts` - Hook for triggering toast notifications from hooks and components.
- `src/app/profile/page.tsx` - User profile/settings page where the auto check-in/out preference can be exposed.
- `src/lib/firebase/types.ts` - User type definitions that may be extended with an auto-mode preference field.
- `src/components/pwa/PWAStatus.tsx` - PWA status component that may reference foreground-only constraints and location usage.
- `src/lib/hooks/useAutoGeofenceCheck.test.ts` - New unit tests for the auto geofence hook state machine and polling behavior.
- `src/components/provider/__tests__/ProviderDashboardCards.test.tsx` - Tests to cover auto-mode indicator rendering.
- `src/components/provider/__tests__/SessionStatus.test.tsx` - Tests to verify auto-mode status messaging when enabled.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Implement auto check-in/out user preference and settings UI
  - [ ] 1.1 Add an `autoCheckInOutEnabled` preference to the user model (e.g., in `UserProfile`-related Firestore/user types) with a default of disabled.
  - [ ] 1.2 Persist the auto-mode preference in Firestore (and/or local storage fallback) so it survives reloads and sign-ins.
  - [ ] 1.3 Add a toggle control labeled "Auto Check-In/Out Mode" to the provider settings/profile page using the existing `Switch` component.
  - [ ] 1.4 Wire the toggle to read and update the persisted preference, handling loading/saving states and error feedback.
  - [ ] 1.5 Ensure the preference is easily discoverable from the provider dashboard (e.g., link or hint) without cluttering the UI.

- [ ] 2.0 Implement auto geofence check hook and GPS polling state machine
  - [ ] 2.1 Create a new `useAutoGeofenceCheck` hook that accepts the auto-mode preference and current user/session context.
  - [ ] 2.2 Implement 60-second GPS polling using `locationService`/`useLocation`, scoped to when auto-mode is enabled.
  - [ ] 2.3 Use the Page Visibility API to start polling only when the tab is visible and to stop polling when it is hidden or closed.
  - [ ] 2.4 Implement geofence state tracking (`outside`, `entering`, `inside`, `exiting`) based on user position relative to assigned school geofences.
  - [ ] 2.5 Add debouncing logic requiring two consecutive polls inside the geofence before considering an entry, and two outside before considering an exit.
  - [ ] 2.6 Integrate GPS accuracy checks, skipping polls when accuracy is worse than 50 meters.
  - [ ] 2.7 Track consecutive poor-accuracy cycles and expose a signal when GPS has been unreliable for 3 cycles so the UI can show a warning and temporarily disable auto-mode.
  - [ ] 2.8 Ensure polling is stopped when auto-mode is disabled or when the user signs out.

- [ ] 3.0 Implement auto check-in/out notifications and countdown UX
  - [ ] 3.1 Design a toast/modal pattern using the existing toast system to present auto check-in and auto check-out prompts.
  - [ ] 3.2 Implement an auto check-in notification that shows school name, distance, and a 15-second countdown with a prominent cancel button.
  - [ ] 3.3 Implement an auto check-out notification that shows school name, session duration, and a 15-second countdown with a "Stay Checked In" button.
  - [ ] 3.4 Wire the countdown to call the existing `checkIn`/`checkOut` APIs with `checkInMethod: "geo"` when not cancelled.
  - [ ] 3.5 Ensure only the first school whose geofence is entered during a polling window is used for auto check-in when multiple geofences overlap.
  - [ ] 3.6 Provide visual feedback that auto-mode is currently active (e.g., badge or icon) on the provider dashboard.
  - [ ] 3.7 Handle error states where auto check-in/out fails (e.g., API error) by surfacing a clear toast and falling back to manual controls.

- [ ] 4.0 Integrate auto geofence mode into the provider dashboard and existing session flows
  - [ ] 4.1 Initialize `useAutoGeofenceCheck` within the provider dashboard context using the stored user preference and active session state.
  - [ ] 4.2 Ensure auto check-in does not trigger when there is already an active session, and auto check-out only triggers for the currently checked-in school.
  - [ ] 4.3 Coordinate auto-mode with the existing manual `CheckInButton` so manual actions remain fully supported and override auto behavior when invoked.
  - [ ] 4.4 Update session status components to reflect when auto-mode is enabled and, if helpful, current geofence state (e.g., entering/inside/outside).
  - [ ] 4.5 Ensure GPS warnings and auto-mode temporary disablement are clearly communicated in the dashboard UI.
  - [ ] 4.6 Verify that auto-mode integrates cleanly with offline/queue behavior and existing session persistence.

- [ ] 5.0 Add telemetry, resilience, and automated tests for auto geofence mode
  - [ ] 5.1 Instrument key events (auto-mode toggled, auto check-in/out triggered, cancelled, or failed; GPS accuracy issues) for analytics and debugging.
  - [ ] 5.2 Write unit tests for the `useAutoGeofenceCheck` hook covering state transitions, debouncing, GPS accuracy handling, and visibility changes.
  - [ ] 5.3 Add tests for notification behavior to ensure correct countdown durations, button actions, and single-school selection in overlapping geofences.
  - [ ] 5.4 Add or update provider dashboard tests to validate auto-mode indicator rendering and integration with session status.
  - [ ] 5.5 Perform manual QA to confirm auto check-in/out flows work as expected within PWA/browser foreground constraints and that manual fallback is always available.
