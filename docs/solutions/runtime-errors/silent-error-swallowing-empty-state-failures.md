---
title: Admin session notes table silently empty due to swallowed Firestore errors and premature setSessions ordering
category: runtime-errors
problem_type: silent_error_swallowing
component: AdminSessionNotes
date: 2026-03-24
tags: firestore, error-handling, react, admin, session-notes, data-loading, try-finally, appLogger
severity: high
related_files:
  - src/components/admin/AdminSessionNotes.tsx
  - src/components/admin/AdminSessionNotes.test.tsx
  - docs/agents/architecture.md
---

# Admin session notes table silently empty due to swallowed Firestore errors and premature `setSessions` ordering

## Problem

The admin page at `/admin/notes` showed "No session notes found." even after providers saved notes at `/provider/notes`. The table was genuinely empty — not a display bug — because the Firestore query was either throwing silently (missing composite index) or the component's async chain was blocking state updates.

**Observable symptom:** Admin refreshes `/admin/notes`; table shows "No session notes found." regardless of whether any notes exist in Firestore.

## Root Causes

Four independent defects compounded to produce the same symptom:

### 1. `try/finally` without `catch` — query errors silently discarded

```ts
// BEFORE: any Firestore error (missing index, rules failure, network) is swallowed
try {
  const snapshot = await getDocs(q);
  // ...
  setSessions(newSessions);
} finally {
  setLoading(false);   // always runs; sessions stays []
}
```

When the Firestore composite index `hasNotes ASC + updatedAt DESC` had not been deployed, `getDocs(q)` threw. The `finally` set `loading` to `false`, and the component rendered its empty-state message. No error was visible anywhere.

### 2. `setSessions` gated behind `await loadNames()` — hydration failure blocks render

```ts
// BEFORE: if loadNames() throws, setSessions() never runs
await loadNames(newSessions);   // secondary enrichment
setSessions(newSessions);       // never reached on hydration failure
```

Even if the primary query succeeded, a failure in name hydration (looking up `displayName` for user IDs and location names) prevented sessions from ever being set.

### 3. `loadNames().catch(() => {})` — silent swallow without logging

```ts
// Later refactored to fire-and-forget, but initial swallow was silent
loadNames(newSessions).catch(() => {});
```

No `appLogger` call. A rules regression silently denying the `users` or `locations` batch query would be invisible — table would show "Loading..." permanently with no log entry.

### 4. Raw `err.message` rendered in the UI

```ts
setError(err instanceof Error ? err.message : "Failed to load session notes");
```
```tsx
<p>{error}</p>  // Firestore error URLs expose project ID and collection structure
```

Firestore exceptions include URLs like `console.firebase.google.com/v1/r/project/schools-in-check/...`, exposing internal project details in the DOM.

### 5. Duplicate error-state header (secondary)

The error early-return duplicated the `<h1>` and Retry button already present in the normal render path, creating two maintenance points for the same layout.

## Solution

### Fix 1 — Add catch block with `appLogger.error` and error state

```ts
// AFTER
try {
  const snapshot = await getDocs(q);
  // ...
  setSessions(newSessions);
} catch (err) {
  appLogger.error("AdminSessionNotes: failed to load sessions", { err });
  setError("Failed to load session notes");
} finally {
  setLoading(false);
}
```

Add `error: string | null` state, render an error card with a Retry button when set.

### Fix 2 — Set primary state before optional enrichment

```ts
// AFTER: setSessions runs immediately; hydration is fire-and-forget
setSessions(newSessions);
loadNames(newSessions).catch((err) => {
  appLogger.warn("AdminSessionNotes: failed to hydrate display names", { err });
});
```

Sessions render immediately with "Loading..." placeholders for names. Names fill in asynchronously. A hydration failure is logged but does not blank the table.

### Fix 3 — Log all errors; show generic string in UI

```ts
// AFTER: raw error only in logs
appLogger.error("AdminSessionNotes: failed to load sessions", { err });
setError("Failed to load session notes");
```

```tsx
<p className="font-medium">Failed to load session notes</p>
<p className="text-sm text-muted-foreground mt-1">
  Check the browser console or Firebase logs for details.
</p>
```

### Fix 4 — Collapse duplicate error-state header

```tsx
// AFTER: single return, conditional button label and body
return (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold tracking-tight">Session Notes</h1>
      <Button onClick={() => loadSessions()} variant="outline" size="sm">
        <RefreshCw className="h-4 w-4 mr-2" />
        {error ? "Retry" : "Refresh"}
      </Button>
    </div>
    {error ? (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          <p className="font-medium">Failed to load session notes</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check the browser console or Firebase logs for details.
          </p>
        </CardContent>
      </Card>
    ) : (
      <>
        {/* table + dialog */}
      </>
    )}
  </div>
);
```

### Deployment prerequisite

The admin query requires a composite Firestore index. Before deploying code changes:

```bash
firebase deploy --only firestore:indexes
# or
npm run firebase:deploy:rules
```

Verify in Firebase Console → Firestore → Indexes that `hasNotes ASC + updatedAt DESC` status is "Enabled" (indexes take 1–5 minutes to build after deployment).

## Prevention & Best Practices

### Async State Management Checklist

When writing async data-loading logic in React components, verify each of the following before merging:

- [ ] Every `try` block has an explicit `catch` — never rely on `finally` alone to handle errors
- [ ] `catch` blocks call `appLogger.error(...)` with the error object
- [ ] `catch` blocks set an error state variable so the UI can render a user-facing message
- [ ] Primary state (`setSessions`, `setData`, etc.) is set **before** any optional enrichment or side-effects
- [ ] Optional enrichment (name hydration, secondary lookups) is wrapped in its own error handler so it cannot block the primary render
- [ ] User-facing error strings are generic — no `err.message` or stack traces in UI
- [ ] `.catch(() => {})` is never used — every catch handler logs, updates state, or both

### Anti-patterns to avoid

**setState gated behind an await that can fail:**

```ts
// BAD
await loadNames(sessions);   // secondary enrichment that can throw
setSessions(sessions);       // unreachable on failure
```

```ts
// GOOD
setSessions(sessions);       // primary state set immediately
loadNames(sessions).catch((err) => {
  appLogger.warn("Component: name hydration failed", { err });
});
```

**Silent swallowing:**

```ts
// BAD
someQuery().catch(() => {});

// GOOD
someQuery().catch((err) => {
  appLogger.error("Component: query failed", { err });
  setError("Failed to load data.");
});
```

**Raw error in UI:**

```tsx
// BAD — may expose internal Firestore details
{error && <p>{error.message}</p>}

// GOOD
{error && <p>Failed to load. Check console for details.</p>}
```

**try/finally with no catch:**

```ts
// BAD — any thrown error propagates; component left in blank/loading state
try {
  const data = await fetchData();
  setData(data);
} finally {
  setLoading(false);
}

// GOOD
try {
  const data = await fetchData();
  setData(data);
} catch (err) {
  appLogger.error("Component: fetchData failed", { err });
  setError("Something went wrong. Please try again.");
} finally {
  setLoading(false);
}
```

### PR review checklist addition

> **Async error handling** — confirm that: (1) every `try` has a `catch` with an `appLogger.error` call and a state update; (2) optional enrichment steps (`await` calls such as name hydration) are in their own `try/catch` so they cannot block the primary `setState`; (3) no `.catch(() => {})` silent swallows exist; (4) no raw `err.message` values are rendered in JSX.

## Related Documentation

- [`docs/solutions/database-issues/firestore-query-patterns-for-admin-list-views.md`](../database-issues/firestore-query-patterns-for-admin-list-views.md) — Composite index design, `hasNotes` boolean-flag query pattern, batched ID lookups (`documentId() in [...]`), and `HttpsError` conventions. The canonical companion document for the Firestore query side of this bug.
- [`docs/agents/architecture.md`](../../agents/architecture.md) (line 227) — Canonical session query specification, required `hasNotes ASC + updatedAt DESC` composite index, and note on the 500-char truncation limit in `updateSessionNote`.
- [`docs/firebase-caching-guide.md`](../../firebase-caching-guide.md) — Preferred cached services (`locationService`, `cachedUserService`) for display-name resolution; the recommended alternative to raw `getDoc` loops in `loadNames`.
- [`docs/plans/2026-03-24-001-fix-admin-session-notes-visibility-plan.md`](../../plans/2026-03-24-001-fix-admin-session-notes-visibility-plan.md) — Full problem statement and acceptance criteria for this fix.
