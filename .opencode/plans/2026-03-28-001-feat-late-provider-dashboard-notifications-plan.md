---
title: "feat: Add dashboard notifications for late providers"
type: feat
status: active
date: 2026-03-28
origin: user-request (admin notification consistency)
---

# feat: Add Dashboard Notifications for Late Providers

## Overview

Extend the existing `checkLateProviders` Cloud Function to create dashboard notifications in addition to push notifications. Late provider alerts should follow the same pattern as provider session notes - populating the admin notification area via Firestore documents while maintaining existing push notification behavior.

## Problem Frame

The `checkLateProviders` Cloud Function (implemented per `2026-03-24-001-feat-late-provider-admin-alerts-plan.md`) currently only sends browser push notifications to admins when providers are 15 minutes late to their scheduled sessions. These notifications do not populate the admin dashboard's notification area, creating an inconsistent user experience:

- Provider notes notifications (added via `updateSessionNote`) appear in the admin dashboard notification bell AND trigger push notifications
- Late provider notifications only trigger push notifications

Admins expect to see late provider alerts in the same persistent notification interface where they view session notes.

## Requirements Trace

- **R1**: Late provider alerts must create Firestore notification documents in `users/{adminId}/notifications`
- **R2**: Dashboard notifications must follow the same fan-out pattern as session note notifications
- **R3**: Existing push notification behavior must be preserved
- **R4**: NotificationBell component must handle the new `late_provider` notification type
- **R5**: Clicking a late provider notification should navigate to `/admin/schedules` (not `/admin/notes`)

## Scope Boundaries

- **In scope**: Cloud Function modification, type definition update, NotificationBell routing update
- **Out of scope**: Modifying the `latenessAlerts` deduplication collection (push-only behavior remains)
- **Out of scope**: New UI designs for notification display (re-use existing notification item rendering)

## Context & Research

### Relevant Code and Patterns

**Working Pattern: Session Notes Notifications**
- File: `functions/src/index.ts` lines 1697-1831 (`updateSessionNote` callable)
- Pattern: Query all admins → Batch write notification docs to each admin's `notifications` subcollection
- Deterministic document ID: `session_note_${sessionId}`
- Fan-out to ALL admins via `db.batch()`

**Current Late Provider Implementation**
- File: `functions/src/index.ts` lines 1140-1246 (`checkLateProviders` scheduled function)
- File: `functions/src/lateProviderOrchestration.ts` lines 190-239 (`dispatchAdminPushAlerts`)
- Current behavior: Queries admins → Sends push to `pushSubscriptions/adminAlerts`
- **Gap**: No Firestore notification documents created

**Dashboard Notification UI**
- File: `src/components/ui/NotificationBell.tsx` - Displays notifications, handles click navigation
- File: `src/lib/hooks/useNotifications.ts` - Subscribes to `users/{userId}/notifications`
- File: `src/lib/firebase/types.ts` - `AppNotification` interface (currently only supports `type: "session_note"`)
- All notifications currently navigate to `/admin/notes` on click

### Institutional Learnings

None directly applicable to notification patterns. The codebase demonstrates a preference for Firestore-based notification persistence alongside push notifications where appropriate (session notes).

## Key Technical Decisions

- **Dashboard notification timing**: Create notification documents AFTER writing `latenessAlerts` dedup docs but BEFORE or alongside push notifications. This mirrors the session note pattern where notification creation is best-effort and does not block the main operation.

- **Notification document ID**: Use deterministic ID `late_provider_${scheduleId}_${dateKey}` to prevent duplicates if the function retries. This follows the `session_note_${sessionId}` pattern.

- **Navigation target**: Late provider notifications should navigate to `/admin/schedules` (where schedules are managed) rather than `/admin/notes`. This is the logical destination for admin follow-up action.

- **Notification type naming**: Use `type: "late_provider"` to distinguish from `session_note` and enable future notification routing logic.

## Open Questions

### Resolved During Planning

- **Q**: Should we also update the `latenessAlerts` collection to track dashboard notification status?
  - **A**: No - `latenessAlerts` is specifically for push deduplication and is working correctly. Dashboard notifications use the same per-admin subcollection pattern as session notes, which provides its own deduplication via deterministic IDs.

- **Q**: What happens if a late provider notification and a session note notification fire for the same provider around the same time?
  - **A**: They will be separate notification documents with different types and IDs. Both will appear in the notification bell. This is acceptable - they represent different events.

### Deferred to Implementation

- Exact format of the `notePreview` or equivalent field for late provider notifications (implementation detail - should contain provider name, location, scheduled time)

## Implementation Units

- [ ] **Unit 1: Add late_provider type to AppNotification interface**

**Goal**: Extend the type system to support late provider notifications

**Requirements**: R4

**Dependencies**: None

**Files:**
- Modify: `src/lib/firebase/types.ts`
- Test: Existing type tests (if any), or add to `src/lib/firebase/__tests__/types.test.ts` if it exists

**Approach:**
- Extend the `AppNotification` interface to include `type: "late_provider"`
- Add fields specific to late provider notifications: `providerName`, `locationName`, `scheduledTime`, `minutesLate`
- Ensure the new type is a discriminated union with session_note

**Patterns to follow:**
- Existing `AppNotification` interface at `src/lib/firebase/types.ts`

**Test scenarios:**
- Happy path: TypeScript compiles with new notification type
- Edge case: Ensure `type` discriminator enables proper type narrowing

**Verification:**
- `npx tsc --noEmit` passes with no type errors

- [ ] **Unit 2: Create dashboard notifications in checkLateProviders Cloud Function**

**Goal**: Extend the Cloud Function to create Firestore notification documents

**Requirements**: R1, R2, R3

**Dependencies**: Unit 1

**Files:**
- Modify: `functions/src/index.ts` (within `checkLateProviders` function)
- Modify: `functions/src/lateProviderOrchestration.ts` (add `dispatchAdminDashboardAlerts` helper)
- Test: `functions/src/__tests__/lateProviderOrchestration.test.ts` (if exists), or add new tests

**Approach:**
- In `checkLateProviders`, after identifying late providers and writing dedup docs, add batch creation of notification documents
- Create helper function `dispatchAdminDashboardAlerts` in `lateProviderOrchestration.ts` that:
  1. Accepts array of late provider info + admins snapshot
  2. Builds batch writes for each admin's `notifications` subcollection
  3. Uses deterministic IDs: `late_provider_${scheduleId}_${dateKey}`
  4. Returns promise for batch commit
- Call this helper alongside (or before) `dispatchAdminPushAlerts`
- Handle errors gracefully (don't fail push notifications if dashboard creation fails)

**Technical design:**
```typescript
// In lateProviderOrchestration.ts
export async function dispatchAdminDashboardAlerts(
  db: admin.firestore.Firestore,
  adminsSnapshot: admin.firestore.QuerySnapshot,
  lateProviders: LateProviderInfo[],
  todayDateKey: string
): Promise<void> {
  const batch = db.batch();
  
  for (const adminDoc of adminsSnapshot.docs) {
    for (const provider of lateProviders) {
      const notifRef = db
        .collection("users")
        .doc(adminDoc.id)
        .collection("notifications")
        .doc(`late_provider_${provider.scheduleId}_${todayDateKey}`);
      
      batch.set(notifRef, {
        id: notifRef.id,
        type: "late_provider",
        sessionId: provider.sessionId || null,
        providerId: provider.providerId,
        providerName: provider.providerName,
        locationName: provider.locationName,
        scheduledTime: provider.scheduledTime,
        minutesLate: provider.minutesLate,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
  
  await batch.commit();
}
```

**Patterns to follow:**
- `updateSessionNote` batch write pattern in `functions/src/index.ts` lines 1720-1780
- Same error handling approach (failures logged but don't break main flow)

**Test scenarios:**
- Happy path: Dashboard notifications created for all admins when late providers found
- Edge case: Multiple late providers → multiple notification docs per admin
- Error path: Firestore batch write failure logged but doesn't prevent push notifications
- Integration scenario: Notification docs appear in admin's notification stream within seconds

**Verification:**
- Firebase emulator test: `checkLateProviders` creates notification documents
- Unit test: `dispatchAdminDashboardAlerts` builds correct batch operations

- [ ] **Unit 3: Update NotificationBell to handle late_provider type**

**Goal**: Enable the UI to display late provider notifications and navigate appropriately

**Requirements**: R4, R5

**Dependencies**: Unit 1

**Files:**
- Modify: `src/components/ui/NotificationBell.tsx`
- Test: `src/components/ui/__tests__/NotificationBell.test.tsx` (if exists)

**Approach:**
- Update notification rendering logic to handle `type: "late_provider"`
- Display provider name, location name, and lateness info in the notification item
- On click: Navigate to `/admin/schedules` instead of `/admin/notes` for late_provider type
- Maintain existing "mark as read" behavior

**Technical design:**
```typescript
// In NotificationBell notification click handler
const handleNotificationClick = (notification: AppNotification) => {
  markAsRead(notification.id);
  
  if (notification.type === "late_provider") {
    router.push("/admin/schedules");
  } else {
    router.push("/admin/notes");
  }
};
```

**Patterns to follow:**
- Existing notification click handling in NotificationBell
- Existing router usage pattern in the codebase

**Test scenarios:**
- Happy path: Clicking late_provider notification navigates to /admin/schedules
- Happy path: Clicking session_note notification still navigates to /admin/notes
- Edge case: Notification item displays provider name, location, and lateness

**Verification:**
- Browser/E2E test: Click late provider notification → lands on schedules page
- Visual verification: Notification displays correct information

## System-Wide Impact

- **Interaction graph**: `checkLateProviders` function now writes to `users/{uid}/notifications` in addition to push subscriptions. Same read path via `useNotifications` hook.
- **Error propagation**: Dashboard notification creation failures are logged but don't cascade to push notifications (best-effort pattern).
- **State lifecycle**: Notification documents persist until explicitly marked as read or cleaned up by admin (same as session notes).
- **API surface parity**: No new client-facing APIs. Existing `useNotifications` hook automatically picks up new notification type.

## Risks & Dependencies

- **Risk**: Firestore batch write limits (500 operations). With N late providers and M admins, batch size = N × M. Mitigation: Most deployments have few admins (<10) and few late providers per run. If scale increases, implement chunked batching.
- **Risk**: Notification document growth if admins never clear notifications. Mitigation: Same as existing session notes - no automatic cleanup currently implemented. Future enhancement could add TTL.
- **Dependency**: Unit 1 must be merged before Unit 2 and 3 to maintain type safety.

## Documentation / Operational Notes

- Update Cloud Functions table in `docs/agents/architecture.md` to note dual notification behavior (push + dashboard)
- No Firestore index changes required (subcollection queries already supported by existing indexes)

## Sources & References

- **Related plan:** `docs/plans/2026-03-24-001-feat-late-provider-admin-alerts-plan.md` (completed - push-only implementation)
- **Pattern reference (session notes):** `functions/src/index.ts` lines 1697-1831
- **Pattern reference (notification bell):** `src/components/ui/NotificationBell.tsx`
- **Type definitions:** `src/lib/firebase/types.ts`
