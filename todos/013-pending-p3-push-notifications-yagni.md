---
status: done
priority: p3
issue_id: "013"
tags: [code-review, simplicity, yagni]
dependencies: []
---

# Web Push Notifications for Session Notes May Be YAGNI

## Problem Statement

The `updateSessionNote` Cloud Function includes ~30 lines of VAPID initialization, push subscription lookups, and web-push sending. The in-app `NotificationBell` with real-time `onSnapshot` already provides immediate notification when admins open the app. Session notes are not time-critical — admins browse them at their convenience.

Push adds: VAPID secret management, extra Firestore reads per admin per note update, error handling for push failures, and `secrets` declaration on the Cloud Function.

## Proposed Solutions

Remove push notification logic from `updateSessionNote`. Keep the in-app notification system. Add push later if there's demonstrated need.

- **Effort:** Small (removal)
- **Risk:** Low

## Resources

- `functions/src/index.ts` — updateSessionNote push notification section
- Code Simplicity Reviewer flagged as YAGNI
