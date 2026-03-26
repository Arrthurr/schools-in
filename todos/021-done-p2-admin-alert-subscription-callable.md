---
status: pending
priority: p2
issue_id: "021"
tags: [code-review, agent-native, cloud-functions]
---

## Problem Statement

Admin alert opt-in and opt-out are handled entirely by browser push APIs in `src/components/admin/AdminDashboard.tsx` (lines 179–250). An agent cannot use `Notification.permission` or `PushManager.subscribe` — there is no callable Cloud Function equivalent. This means `checkLateProviders` sends alerts via a subscription system that only the UI can manage.

## Findings

- **File**: `src/components/admin/AdminDashboard.tsx:179` (enable), `:236` (disable)
- **Source**: Agent-native reviewer (P2)

## Proposed Solution

Add a callable Cloud Function `manageAdminAlertSubscription`:
```ts
// Action: "save" stores the subscription; "remove" deletes it
exports.manageAdminAlertSubscription = onCall({ ... }, async (request) => {
  const { action, subscription } = request.data;
  // validate, then write/delete users/{uid}/pushSubscriptions/adminAlerts
});
```

The UI calls this function instead of writing directly to Firestore. An agent can call the same function.

## Acceptance Criteria

- [ ] `manageAdminAlertSubscription` callable Cloud Function exists
- [ ] UI `AdminDashboard.tsx` delegates to the callable instead of direct Firestore writes
- [ ] An agent can subscribe/unsubscribe an admin by calling the function

## Work Log

- 2026-03-25: Identified by agent-native reviewer in ce-review of PR #101
