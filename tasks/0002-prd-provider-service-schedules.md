# Product Requirements Document: Provider Service Schedules

## Introduction/Overview

This feature enables administrators to create and manage service schedules for providers at their assigned schools. Each provider will have separate weekly schedules for each school they serve, defining when they are scheduled to provide services. This feature is a prerequisite for the upcoming session alert system, which will notify providers 10 minutes before their first scheduled session each day.

**Problem:** Currently, there is no way to track or display when providers are scheduled to be at specific schools, which prevents implementation of automated reminder/alert systems.

**Goal:** Enable admins to define recurring weekly schedules (days and times) for providers at each assigned school location.

## Goals

1. Allow administrators to create weekly service schedules for providers at each assigned school
2. Display provider schedules on provider profile pages and school detail pages
3. Store schedule data in a structured format that can be queried for alert generation
4. Support multiple independent schedules when a provider serves multiple schools
5. Ensure schedules are properly managed when provider-school assignments change

## User Stories

1. **As an admin**, I want to create a weekly schedule for a provider at a specific school, so that I can track when they provide services and enable automated alerts.

2. **As an admin**, I want to view all schedules for a provider across their assigned schools, so that I can see their complete service commitment.

3. **As an admin**, I want to see which providers are scheduled at a school on specific days, so that I can coordinate service coverage.

4. **As a provider**, I want to view my service schedules for each school, so that I know when I'm expected to be on-site.

5. **As the system**, I need to query provider schedules to determine when to send 10-minute reminder alerts before the first session of each day.

## Functional Requirements

### Schedule Management

1. Admins must be able to create a new service schedule for a provider at a specific assigned school.
2. The system must enforce that a provider can only have schedules created for schools where they are currently assigned (via `Location.assignedProviders`).
3. Each schedule must specify:
   - Provider ID (reference to User document)
   - School/Location ID (reference to Location document)
   - Day of week (Monday-Sunday)
   - Start time (HH:MM format, 24-hour)
   - End time (HH:MM format, 24-hour)
4. A provider can have multiple time blocks on the same day at the same school (e.g., 9:00-11:00 AM and 2:00-4:00 PM on Mondays).
5. Admins must be able to edit existing schedules (modify days/times).
6. Admins must be able to delete individual schedule entries.
7. When a provider is unassigned from a school (removed from `Location.assignedProviders`), all schedules for that provider-school combination must be automatically deleted.

### Schedule Display

8. Provider profile pages must display all schedules across all assigned schools, organized by school.
9. School detail pages must display schedules for all providers assigned to that school, organized by provider.
10. Schedule displays should show the data in a clear weekly calendar format or grouped list (by day).
11. The schedule display should indicate the school name and provider name for context.

### Data Storage

12. Schedules must be stored in a Firestore collection named `schedules`.
13. Each schedule document must include:
    - `providerId` (string, User UID)
    - `locationId` (string, Location document ID)
    - `dayOfWeek` (number, 0=Sunday, 1=Monday, ..., 6=Saturday)
    - `startTime` (string, "HH:MM" format)
    - `endTime` (string, "HH:MM" format)
    - `createdAt` (timestamp)
    - `updatedAt` (timestamp)
    - `createdBy` (string, admin User UID)
14. The collection must support querying by `providerId`, `locationId`, and `dayOfWeek` for alert generation.

## Non-Goals (Out of Scope)

1. **Conflict detection** - No validation to prevent overlapping time slots for the same provider (future enhancement).
2. **Booking/reservation system** - Schedules are informational only, not bookable time slots.
3. **Check-in integration** - Schedules are independent of actual check-in/check-out tracking (separate feature).
4. **Provider self-service** - Only admins can create/edit schedules in this version.
5. **Recurring exceptions** - No support for one-time schedule changes or holiday exceptions.
6. **Historical tracking** - Deleted schedules are not archived; they are permanently removed.
7. **Notifications** - The alert/notification system is a separate future feature.

## Design Considerations

### UI Components

- **Schedule Creation Form**: Use existing Radix UI components (Dialog, Select, TimePicker if available, or text inputs for time).
- **Schedule Display**: Use a table or card-based layout grouped by day of week.
- **Time Format**: Display times in 12-hour format with AM/PM for user-friendliness, but store in 24-hour format.
- **Integration Points**:
  - Provider profile page (`src/app/(app)/providers/[id]/page.tsx` or similar)
  - School detail page (`src/app/(app)/locations/[id]/page.tsx` or similar)
  - New schedule management component (e.g., `src/components/schedules/ScheduleManager.tsx`)

### Accessibility

- Ensure all form inputs have proper labels
- Time inputs should be keyboard-accessible
- Schedule displays should be screen-reader friendly with proper semantic HTML

## Technical Considerations

### Firebase Integration

1. **Firestore Collection**: Create a new `schedules` collection with composite indexes for efficient querying:
   - `providerId` + `locationId`
   - `locationId` + `dayOfWeek`
   - `providerId` + `dayOfWeek`
2. **Security Rules**: Only admins can read/write schedules; providers can read their own schedules.
3. **Data Service**: Create `src/lib/services/scheduleService.ts` following the pattern of `locationService.ts` and `assignmentService.ts`.

### Alert System Integration

4. The schedule data structure should support efficient queries like:
   - "Get all providers scheduled on a specific day of week"
   - "Get the earliest start time for a provider on a given day"
   - "Check if a provider has any schedules today"
5. Consider adding a helper function to calculate alert times (e.g., `getFirstSessionAlertTime(providerId, dayOfWeek)`).

### Assignment Cascade

6. Implement a Firestore trigger or client-side logic to delete schedules when `Location.assignedProviders` is updated to remove a provider.
7. Alternative: Use a soft-delete approach with an `isActive` flag if historical data might be needed later.

## Success Metrics

1. **Functionality**: Admins can successfully create, edit, and delete schedules for 100% of provider-school assignments.
2. **Data Integrity**: Schedule queries return accurate results for alert generation with <1% error rate.
3. **Performance**: Schedule displays load in <2 seconds on provider and school pages.
4. **Adoption**: At least 80% of active providers have at least one schedule defined within 30 days of feature launch.
5. **Enablement**: The alert system (future feature) can reliably query schedule data to send timely notifications.

## Open Questions

1. **Time Zone Handling**: Should schedules be stored in a specific time zone (e.g., school's local time zone) or UTC? How should the UI handle time zone display?
2. **Bulk Import**: Would admins benefit from a CSV import feature for creating multiple schedules at once?
3. **Schedule Templates**: Should there be a way to copy/duplicate schedules across weeks or schools?
4. **Validation Logic**: While conflict detection is out of scope, should we validate that `endTime` > `startTime` for each entry?
5. **Mobile Experience**: How should schedule creation/editing work on mobile devices? Should there be a simplified mobile UI?
6. **Analytics**: Should we track which days/times are most common for provider scheduling to inform future resource planning?
