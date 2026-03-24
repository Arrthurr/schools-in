---
status: done
priority: p2
issue_id: "019"
tags: [code-review, security, logging, pr-97]
dependencies: []
---

# Admin Notes Error Catch Block: Add `appLogger` + Sanitise Firestore Message in UI

## Problem Statement

Two related issues in `AdminSessionNotes.tsx` `loadSessions` catch block:

**1. No logging:** The catch block sets error state but never logs via `appLogger`:

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : "Failed to load session notes";
  setError(message);
}
```

**2. Raw Firestore error rendered to DOM:** The raw `err.message` from a Firestore exception is rendered directly in the UI. Firestore errors can contain internal project details (e.g., `"The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/schools-in-check/..."`). The full URL contains the project ID and collection/field structure. While the page is admin-only, this text is in the DOM — visible in screenshots, screen-shares, and browser extensions.

The fallback branch (`"Failed to load session notes"`) also silently discards non-`Error` rejections.

## Findings

- **TypeScript Reviewer:** "No `appLogger.error` call in the catch block for the main query failure."
- **Security Sentinel:** Flagged as **Medium** — "Raw Firestore error messages can contain internal details that are operationally useful to an attacker: missing index URLs (which encode collection names and field paths), the project ID, and structured query payloads." Recommends logging full `err.message` via `appLogger` and rendering a sanitised message.
- **Learnings Researcher:** Confirmed pattern — documented solution references `HttpsError` usage for Cloud Function errors; same principle applies here: log internally, surface safely.

## Proposed Solutions

### Option A: Log + sanitise (Recommended)
```typescript
} catch (err) {
  appLogger.error("AdminSessionNotes: failed to load sessions", { err });
  const message = err instanceof Error ? err.message : "Failed to load session notes";
  setError(message);
}
```
For the UI render, replace the raw `{error}` with a fixed string and add a "check browser console" affordance:
```tsx
<p className="font-medium">Failed to load session notes</p>
<p className="text-sm text-muted-foreground mt-1">
  Check the browser console or Firebase logs for details.
</p>
```
- **Pros:** Full error captured in logs; no internal details in DOM; admin gets actionable guidance
- **Cons:** Admin can't read the error without opening DevTools
- **Effort:** Small
- **Risk:** None

### Option B: Log + show sanitised message for known errors
Map known Firestore error codes to friendly strings, fall back to generic message:
```typescript
function friendlyFirestoreError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("index")) return "A database index is missing. Contact support.";
    if (err.message.includes("permission")) return "Permission denied. Check your admin role.";
  }
  return "Failed to load session notes";
}
```
- **Pros:** Friendly + actionable for known errors
- **Cons:** More code; brittle string matching
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A. Admin-only page; the log is the right place for raw details. The UI just needs to not expose project internals.

## Technical Details

- **File:** `src/components/admin/AdminSessionNotes.tsx:160–162` (catch) and `~195–196` (render)
- **Import needed:** `appLogger` from `@/lib/logging/appLogger`
- Update test at `AdminSessionNotes.test.tsx:235–236` to assert on the sanitised string, not raw Firestore message

## Acceptance Criteria

- [ ] `appLogger.error(...)` called inside the catch block
- [ ] UI renders a fixed string rather than raw `err.message`
- [ ] Test updated to assert on sanitised error UI, not raw Firestore error text
- [ ] TypeScript clean

## Work Log

- 2026-03-24: Identified by TypeScript Reviewer and Security Sentinel (Medium) during PR #97 review
