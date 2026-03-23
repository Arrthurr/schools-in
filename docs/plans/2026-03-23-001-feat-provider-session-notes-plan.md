---
title: "feat: Provider Session Notes"
type: feat
status: active
date: 2026-03-23
---

# feat: Provider Session Notes

## Overview

Allow providers to add an optional note (max 500 chars) to any session they own — during an active session, at checkout, or retroactively on past sessions. Notes explain early checkouts, missed check-ins, or other schedule deviations. Providers can see their own notes; admins see all notes aggregated on a dedicated notes page. Admins receive both in-app and push notifications when new notes are submitted.

## Problem Statement / Motivation

When a provider checks out early or skips a check-in due to an unforeseen event (e.g., cancelled session, school closure), there is no way to communicate the reason to admins within the app. Admins see unexplained short sessions or missing check-ins and must follow up externally. A session notes feature closes this communication gap directly in the session workflow.

## Proposed Solution

1. **New `updateSessionNote` Cloud Function** — validates ownership, enforces 500-char limit, writes with Admin SDK (avoids weakening Firestore security rules)
2. **Wire notes through the checkout flow** — pass `notes` through the full offline queue chain (`useSession` → `serviceManager` → `queueManager` → `actionQueue` → Cloud Function)
3. **Add `UPDATE_NOTE` offline queue action** — for mid-session and retroactive note operations
4. **Repurpose feedback routes** — `/provider/feedback` → provider's session notes list; `/admin/feedback` → admin view of all session notes across providers
5. **Remove Help & Feedback feature** — clean up `FeedbackForm`, `feedbackService`, `Feedback` type, and related Firestore rules
6. **Activate existing notification bell** — the Bell button already exists in both `AdminNavigation.tsx` (line 237) and `ProviderNavigation.tsx` (line 209) but has no functionality. Wire it up with a real-time notification listener and dropdown for admins.
7. **Web push for admins** — reuse existing VAPID/push infrastructure to notify admins of new notes

## Technical Considerations

### Architecture

- **Cloud Function (`updateSessionNote`)**: New callable function in `functions/src/index.ts`. Validates: authenticated user, session ownership (`session.userId === auth.uid`), provider role, note length ≤ 500 chars, trims whitespace. Writes `notes` and `notesUpdatedAt` to session doc. Triggers admin notification (both in-app and push).
- **Offline queue extension**: New `UPDATE_NOTE` action type in `QUEUE_ACTIONS`. Deduplicate by `sessionId` — only latest note text is kept when multiple offline edits occur on the same session.
- **Notification model**: New `notifications` subcollection under `users/{uid}` for in-app bell state. Cloud Function writes notification docs to all admin users when a note is submitted. Web push sent via existing `sendPushNotification` utility.
- **Existing Bell buttons**: `AdminNavigation.tsx:237-239` and `ProviderNavigation.tsx:209-210` already render a `<Bell>` icon button with no click handler. These will be enhanced with unread badge and dropdown.

### Performance

- Notes list pages use pagination (Firestore `orderBy('notesUpdatedAt', 'desc')` with `limit`/`startAfter`)
- Notification bell uses a real-time listener scoped to unread count only (`where('read', '==', false)`)
- No impact on geofencing or session check-in/out hot paths (notes are a separate write)

### Security

- Notes written exclusively via Cloud Function with Admin SDK — no client-side Firestore write rules needed
- Providers can only read notes on their own sessions (existing session read rules enforce `userId` match)
- Admin note aggregation page queries sessions with `notes != null` — admins already have read access to all sessions
- Note content sanitized server-side (trim, length cap); no HTML/markdown rendering (plain text only)

## System-Wide Impact

- **Interaction graph**: Provider submits note → `updateSessionNote` CF validates & writes session doc → CF writes notification to each admin's `users/{uid}/notifications` subcollection → CF sends web push to admins with active `adminAlerts` push subscriptions → Admin bell listener picks up new notification doc in real-time
- **Error propagation**: If `updateSessionNote` CF fails, client shows error toast. If offline, note is queued as `UPDATE_NOTE` action and replayed on reconnection. If push notification send fails, it fails silently (non-critical).
- **State lifecycle risks**: Offline queue deduplication by `sessionId` prevents stale note overwrites. Cloud Function is idempotent — replaying the same note text is a no-op in effect.
- **API surface parity**: `endSession` CF already accepts `notes` — the checkout flow just needs to pass it through the client chain. `startSession` CF also accepts `notes` but this is less relevant (notes at check-in are uncommon).

## Acceptance Criteria

### Functional Requirements

- [ ] Provider can add a note (≤ 500 chars) to an active session via session detail view
- [ ] Provider can add a note during the checkout flow (optional textarea in checkout confirmation)
- [ ] Provider can add/edit a note retroactively on any past session they own
- [ ] Provider can see their own notes on the session detail modal and on `/provider/feedback` (repurposed as "Session Notes")
- [ ] Admin can see all session notes from all providers on `/admin/feedback` (repurposed as "Session Notes")
- [ ] Existing Bell button in `AdminNavigation.tsx` shows unread badge and dropdown when notes arrive
- [ ] Admin receives a web push notification when a provider submits a new note (if push is enabled)
- [ ] Notes persist correctly when submitted offline and sync when connectivity returns
- [ ] The Help & Feedback feature is fully removed (routes repurposed, dead code cleaned up)

### Non-Functional Requirements

- [ ] Note writes enforce 500-char limit server-side in Cloud Function
- [ ] Note content is plain text only (no HTML/XSS risk)
- [ ] Offline queue deduplicates `UPDATE_NOTE` actions by `sessionId`
- [ ] Notes pages paginate (no unbounded queries)
- [ ] Notification bell uses real-time listener (not polling)

### Quality Gates

- [ ] `npx tsc --noEmit` passes
- [ ] All existing tests pass
- [ ] New unit tests for `updateSessionNote` Cloud Function
- [ ] New unit tests for offline queue `UPDATE_NOTE` action
- [ ] Coverage thresholds maintained (70% branches, 58% functions, 68% lines)

## Implementation Phases

### Phase 1: Data Layer & Cloud Function

**Files to create/modify:**

- `functions/src/index.ts` — Add `updateSessionNote` callable Cloud Function
- `functions/src/sessionLifecycle.ts` — Add `UpdateSessionNoteInput` type
- `src/lib/firebase/types.ts` — Add `notesUpdatedAt?: Timestamp` to `Session` interface; add `Notification` interface
- `firestore.rules` — Add read rules for `users/{uid}/notifications` subcollection

**Tasks:**

1. Add `notesUpdatedAt` field to `Session` type in `types.ts`
2. Create `Notification` type: `{ id, type: 'session_note', sessionId, providerId, providerName, locationName, notePreview, read: boolean, createdAt }`
3. Implement `updateSessionNote` Cloud Function:
   - Validate auth, provider role, session ownership
   - Trim and cap note at 500 chars
   - Write `notes` and `notesUpdatedAt` to session doc
   - Write notification doc to each admin user's `notifications` subcollection
   - Send web push to admins with active `adminAlerts` push subscriptions
4. Update `endSession` CF: change 1000-char limit to 500
5. Update `startSession` CF: add 500-char limit on notes
6. Add Firestore rules for `users/{uid}/notifications` — user can read/update their own notifications
7. Write unit tests for `updateSessionNote` CF

### Phase 2: Offline Queue Chain

**Files to modify:**

- `src/lib/offline/actionQueue.ts` — Add `UPDATE_NOTE` to `QUEUE_ACTIONS`, add `queueUpdateNote()` and `syncUpdateNote()`, add `notes` param to `queueCheckOut`/`syncCheckOut`
- `src/lib/offline/queueManager.ts` — Add `updateNote()` method, add `notes` param to `checkOut()`
- `src/lib/offline/serviceManager.ts` — Add `updateNote()` method, add `notes` param to `checkOut()`
- `src/lib/hooks/useSession.ts` — Add `updateNote()` method, add `notes` param to `checkOut()`

**Tasks:**

1. Add `UPDATE_NOTE` to `QUEUE_ACTIONS` enum in `actionQueue.ts`
2. Implement `queueUpdateNote(sessionId, userId, noteText)` — deduplicates by `sessionId`
3. Implement `syncUpdateNote()` — calls `updateSessionNote` Cloud Function
4. Add `notes?: string` parameter through the checkout chain:
   - `useSession.checkOut(sessionId, location, notes?)`
   - `serviceManager.checkOut(sessionId, userId, location, notes?)`
   - `queueManager.checkOut(sessionId, userId, location, notes?)`
   - `actionQueue.queueCheckOut(sessionId, userId, location, notes?)`
   - `actionQueue.syncCheckOut()` — pass notes to `endSession` CF
5. Add `updateNote(sessionId, noteText)` to `useSession` hook (calls `updateSessionNote` CF online, queues `UPDATE_NOTE` offline)
6. Write unit tests for new queue actions

### Phase 3: Provider UI

**Files to modify:**

- `src/components/provider/SessionDetailModal.tsx` — Add editable notes textarea (providers can add/edit notes on their own sessions)
- `src/app/provider/feedback/page.tsx` — Repurpose to "Session Notes" list page
- `src/components/provider/ProviderNavigation.tsx` — Update nav label from "Feedback" to "Notes", update icon from `MessageSquare` to `FileText`

**New files:**

- `src/components/provider/SessionNotesList.tsx` — List of provider's sessions with notes, with ability to add notes to sessions without them
- `src/components/provider/SessionNoteEditor.tsx` — Reusable textarea component (500-char limit with counter, save/cancel)

**Tasks:**

1. Create `SessionNoteEditor` component — `Textarea` with character counter, save/cancel buttons, loading state
2. Add `SessionNoteEditor` to `SessionDetailModal` — editable when provider owns the session
3. Add optional notes `Textarea` to checkout confirmation flow (inline in existing checkout UI)
4. Create `SessionNotesList` component — paginated list of provider's recent sessions with note status indicators
5. Repurpose `provider/feedback/page.tsx` to render `SessionNotesList`
6. Update `ProviderNavigation.tsx` — change "Feedback" label to "Notes", update icon to `FileText`, update description

### Phase 4: Admin UI & Notifications

**Files to modify:**

- `src/app/admin/feedback/page.tsx` — Repurpose to "Session Notes" admin view
- `src/components/admin/AdminNavigation.tsx` — Wire up existing Bell button (line 237-239) with unread badge and dropdown
- `src/components/provider/ProviderNavigation.tsx` — Optionally wire up provider Bell button (line 209-210) if provider-facing notifications are desired
- `src/components/admin/SessionReports.tsx` — Add notes indicator column to session table

**New files:**

- `src/components/admin/AdminSessionNotes.tsx` — Aggregated view of all session notes across providers, paginated, filterable by provider/location
- `src/components/ui/NotificationBell.tsx` — Wrapper component that enhances existing Bell buttons with unread badge, dropdown list of recent notifications, and mark-as-read
- `src/lib/hooks/useNotifications.ts` — Hook for real-time notification listener, unread count, mark-as-read

**Tasks:**

1. Create `useNotifications` hook — Firestore real-time listener on `users/{uid}/notifications` where `read == false`, provides `unreadCount`, `notifications[]`, `markAsRead(id)`, `markAllAsRead()`
2. Create `NotificationBell` component — enhances the existing Bell button markup with: unread count badge overlay, click-to-open dropdown, list of recent notifications with links to relevant sessions, "mark all as read" action
3. Replace the static Bell button in `AdminNavigation.tsx:237-239` with `NotificationBell`
4. Create `AdminSessionNotes` component — table of sessions with notes: provider name, location, session date, note preview, note timestamp. Click to expand full note. Filter by provider and location.
5. Repurpose `admin/feedback/page.tsx` to render `AdminSessionNotes`
6. Update `AdminNavigation.tsx` — change "Feedback" label to "Notes", update icon
7. Add notes indicator (icon/tooltip) to `SessionReports.tsx` session table

### Phase 5: Cleanup

**Files to delete/modify:**

- Delete `src/components/provider/FeedbackForm.tsx` (or equivalent feedback component)
- Delete `src/lib/services/feedbackService.ts`
- Remove `Feedback` interface from `src/lib/firebase/types.ts`
- Remove feedback collection rules from `firestore.rules`
- Remove any remaining feedback imports/references

**Tasks:**

1. Remove all feedback-related components, services, and types
2. Remove feedback Firestore rules
3. Search codebase for any remaining "feedback" references (nav links, help buttons, etc.)
4. Run `npx tsc --noEmit` to verify no broken imports
5. Run full test suite

## Alternative Approaches Considered

1. **Expand Firestore rules instead of Cloud Function** — Rejected: weakens the security boundary by allowing client-side writes to session docs. The Cloud Function approach keeps all session writes server-side, consistent with `startSession`/`endSession`.

2. **Separate `session_notes` Firestore collection** — Rejected: adds complexity. The `notes` field already exists on the `Session` type and Cloud Functions already handle it. A separate collection would require joins and complicate queries.

3. **Keep Help & Feedback alongside notes** — Rejected per user decision: feedback feature will be removed entirely. Routes are repurposed for notes.

4. **Build notification system from scratch** — Not needed: Bell buttons already exist in both `AdminNavigation.tsx` and `ProviderNavigation.tsx`, just without functionality. Web push infrastructure (VAPID keys, `sendPushNotification` utility) also exists.

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Offline note deduplication edge cases | Provider sees stale note after sync | Deduplicate by `sessionId`, keep only latest. Optimistic UI update. |
| Admin notification volume | Many notes = notification fatigue | Batch notifications if multiple notes come in within a short window. Bell dropdown is paginated. |
| Removing feedback feature | Providers lose bug report channel | Ensure alternative support channel exists (email, external form) |
| Character limit mismatch (500 vs existing 1000) | Existing notes > 500 chars get truncated on edit | Only enforce limit on new writes; display existing long notes in full |

## Success Metrics

- Providers use session notes on ≥ 20% of early-checkout sessions within first month
- Admin time spent following up on unexplained short sessions decreases
- No increase in support requests after feedback feature removal

## Sources & References

### Internal References

- Session type: `src/lib/firebase/types.ts:39-63` — `notes?: string` already defined
- Cloud Function `endSession`: `functions/src/index.ts:629-631` — already handles notes with 1000-char limit
- Cloud Function `startSession`: `functions/src/index.ts:498` — stores notes without limit
- Session detail modal: `src/components/provider/SessionDetailModal.tsx:233-246` — already displays notes read-only
- Admin session management: `src/components/admin/SessionManagement.tsx:757-764` — admin notes editing exists
- Offline queue: `src/lib/offline/actionQueue.ts:121-124` — `QUEUE_ACTIONS` enum (currently `CHECK_IN`, `CHECK_OUT` only)
- Admin Bell button: `src/components/admin/AdminNavigation.tsx:237-239` — exists, no functionality
- Provider Bell button: `src/components/provider/ProviderNavigation.tsx:209-210` — exists, no functionality
- Alert component: `src/components/ui/alert.tsx` — standard shadcn/ui Alert (not notification-related)
- Feedback routes: `src/app/provider/feedback/page.tsx`, `src/app/admin/feedback/page.tsx`
- Push notification utility: `functions/src/utils.ts` — `sendPushNotification`
- CSV export: `src/lib/utils/csv.ts:89` — already includes `notes` field
