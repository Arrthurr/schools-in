# PRD: Automatic Geofence Check-In/Check-Out

## 1. Introduction/Overview

Providers currently must manually tap a button to check in and out of school locations. This feature adds an **optional automatic check-in/check-out mode** that uses continuous GPS monitoring to detect when a provider enters or exits a school's geofence radius.

When enabled, the system will show a notification when the provider enters an assigned school's radius, automatically checking them in after a countdown unless dismissed. Similarly, when leaving the radius, a notification will appear before auto-checkout.

This feature supplements (does not replace) the existing manual check-in/check-out flow.

## 2. Goals

1. Reduce friction for providers who visit schools regularly
2. Improve check-in accuracy by catching entries/exits that might otherwise be missed
3. Maintain provider control through notifications with countdown timers
4. Work reliably within PWA/browser limitations (foreground only)

## 3. User Stories

- **US-1:** As a provider, I want to enable automatic check-in so I don't have to remember to tap the check-in button when I arrive at a school.
- **US-2:** As a provider, I want to see a notification before auto-check-in happens so I can cancel it if I'm just passing by.
- **US-3:** As a provider, I want automatic check-out when I leave a school so I don't forget to end my session.
- **US-4:** As a provider, I want to disable auto-check mode and use manual check-in when needed.
- **US-5:** As a provider, I want the system to fall back to manual check-in if GPS is unreliable.

## 4. Functional Requirements

### 4.1 User Preference Setting

1. The system must provide a toggle in user settings/preferences to enable or disable "Auto Check-In/Out Mode"
2. The setting must persist across sessions (stored in Firestore user document or local storage)
3. The default state must be **disabled** (opt-in feature)
4. The setting must be accessible from the provider dashboard or settings page

### 4.2 GPS Monitoring (When Auto-Mode Enabled)

5. The system must poll GPS location every **60 seconds** while auto-mode is active
6. GPS monitoring must only run while the app is **open and visible** in the browser (foreground)
7. The system must stop GPS polling when the app tab is hidden or closed
8. The system must resume GPS polling when the app tab becomes visible again
9. The system must display a visual indicator showing that auto-check mode is active

### 4.3 Auto Check-In Flow

10. When the provider enters the geofence radius of an **assigned school** (and has no active session), the system must show a notification
11. The notification must include: school name, distance, and a **15-second countdown** to auto-check-in
12. The notification must provide a "Cancel" button to dismiss and prevent auto-check-in
13. If not cancelled, the system must automatically call the existing check-in API after the countdown
14. The check-in must use the existing `checkInMethod: "geo"` (no special marking for auto vs manual)
15. If the provider enters multiple school geofences, the system must check in to the **first school entered** (not the closest)

### 4.4 Auto Check-Out Flow

16. When the provider exits the geofence radius of their currently checked-in school, the system must show a notification
17. The notification must include: school name, session duration, and a **15-second countdown** to auto-check-out
18. The notification must provide a "Stay Checked In" button to dismiss and prevent auto-check-out
19. If not cancelled, the system must automatically call the existing check-out API after the countdown

### 4.5 GPS Accuracy Handling

20. If GPS accuracy is **worse than 50 meters**, the system must skip that polling cycle
21. If GPS accuracy remains poor for **3 consecutive cycles** (3 minutes), the system must:
    - Show a notification about GPS issues
    - Disable auto-check mode temporarily
    - Prompt the provider to use manual check-in
22. The system must re-enable auto monitoring when GPS accuracy improves

### 4.6 State Transitions

23. The system must track geofence state: `outside`, `entering`, `inside`, `exiting`
24. The system must require the provider to be **inside** the geofence for at least **2 consecutive polls** before triggering auto-check-in (debouncing)
25. The system must require the provider to be **outside** the geofence for at least **2 consecutive polls** before triggering auto-check-out (debouncing)

## 5. Non-Goals (Out of Scope)

- **Background location tracking**: The PWA cannot reliably track location when the app is closed or in background
- **Native app geofencing**: No iOS/Android native geofence APIs will be used
- **Multiple simultaneous sessions**: Only one active session at a time (existing constraint)
- **Admin controls**: Admins cannot force-enable/disable auto-check for providers
- **Per-school auto-check settings**: The setting is global, not per-school
- **Modifying existing manual check-in flow**: This is purely additive

## 6. Design Considerations

### UI Components Needed

1. **Settings Toggle**: Switch component in user preferences for "Auto Check-In/Out Mode"
2. **Active Mode Indicator**: Persistent badge/icon on provider dashboard showing auto-mode is active (e.g., location pin with pulse animation)
3. **Check-In Notification**: Toast/modal with school name, countdown timer, and Cancel button
4. **Check-Out Notification**: Toast/modal with school name, duration, countdown timer, and "Stay Checked In" button
5. **GPS Warning Notification**: Alert when GPS accuracy is poor

### Notification Behavior

- Use existing toast system (`sonner`) for in-app notifications
- Request browser notification permission for tab-backgrounded scenarios
- Countdown should be visually prominent (large numbers, progress indicator)

## 7. Technical Considerations

### Existing Infrastructure to Leverage

- `useSession` hook for `checkIn()` and `checkOut()` APIs
- `locationService.getCurrentLocation()` for GPS polling
- `CachedSessionService.validateSessionGeofence()` for radius checking
- `useCachedSession` for active session state
- `Location.radiusMeters` for per-school geofence radius

### New Components/Hooks Needed

- `useAutoGeofenceCheck` hook: Core logic for polling, state machine, and trigger detection
- Auto-check preference in user document or `localStorage`
- Geofence state machine: `outside` → `entering` → `inside` → `exiting` → `outside`

### Page Visibility API

- Use `document.visibilityState` and `visibilitychange` event to pause/resume polling
- Clear intervals when hidden, restart when visible

### Performance Considerations

- 60-second polling interval minimizes battery/CPU impact
- Debouncing (2 consecutive polls) prevents false triggers from GPS jitter
- Stop all polling when feature is disabled

## 8. Success Metrics

1. **Adoption rate**: % of providers who enable auto-check mode
2. **Auto-check usage**: % of sessions started/ended via auto-check vs manual
3. **Cancellation rate**: % of auto-check notifications that are cancelled (indicates if countdown timing is appropriate)
4. **GPS failure rate**: % of sessions where auto-check fell back to manual due to poor GPS
5. **User satisfaction**: Qualitative feedback on feature usefulness

## 9. Open Questions

1. Should there be an onboarding prompt introducing this feature to existing providers?
2. Should the countdown duration (15 seconds) be configurable by the user?
3. Should we show a "You're approaching [School]" notification before entering the geofence (e.g., at 150% of radius)?
4. What happens if a provider's phone goes to sleep while they're inside a geofence? (They'd need to manually check out when they reopen the app)
5. Should there be analytics/logging for debugging auto-check behavior during initial rollout?
