---
title: "Firestore query patterns for admin list views: composite indexes, inequality filters, N+1 reads, and batch limits"
category: "database-issues"
date: "2026-03-23"
tags: ["firestore", "composite-index", "inequality-filter", "n+1-queries", "cloud-functions", "https-error", "batch-limit", "session-notes", "admin-notifications", "typescript"]
problem_type: "Firestore query design issues discovered during code review of admin list view with filtering and pagination"
component: "Admin session notes view, Cloud Functions, notification fan-out"
severity: "critical"
resolution_time: "2-4 hours"
---

# Firestore Query Patterns for Admin List Views

## Problem Symptoms

Code review of the admin session notes view (PR #95) surfaced several interconnected query issues:

- Admin notes page would crash at runtime with a Firestore error linking to index creation
- Notes displayed in alphabetical order by note text, not chronologically
- Up to 25+ sequential Firestore reads on every page load (N+1 pattern)
- Bulk write operation that would throw if admin count exceeded 500
- `where("__name__", "==", id)` queries used in place of direct document fetches

---

## Root Cause

### 1. Firestore Inequality Filter Forces Sort Order

Firestore requires that when using an inequality filter (`!=`, `not-in`, `>`, `<`, etc.), the **first `orderBy` must be on the filtered field**. This causes the desired chronological sort to become a secondary (effectively useless) sort:

```typescript
// This sorts alphabetically by note text first, updatedAt second
query(
  collection(db, "sessions"),
  where("notes", "!=", ""),
  orderBy("notes"),          // forced — cannot change
  orderBy("updatedAt", "desc") // secondary only
)
```

The fix is to restructure the query to use an **equality filter** instead, which imposes no sort constraint.

### 2. Missing or Incorrect Composite Index

Multi-field queries (multiple `where` clauses on different fields, or `where` + `orderBy` on different fields) require a composite index in `firestore.indexes.json`. Without it, the query throws at runtime. The runtime error message includes a direct link to create the missing index — useful for discovering the JSON structure, but the index must ultimately be committed to `firestore.indexes.json` before deployment.

### 3. N+1 Document Fetches

Resolving display names for list view rows (user names, location names) by calling `getDoc()` once per unique ID produces O(N) sequential reads.

---

## Solution

### Pattern: Use Boolean Flag to Decouple Filter from Sort

Instead of filtering on the data field itself (which forces its sort order), add a boolean `hasNotes` field set server-side:

```typescript
// Cloud Function — updateSessionNote
await sessionRef.update({
  notes: noteText,
  hasNotes: noteText.trim().length > 0,  // set alongside the data
  notesUpdatedAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
```

```typescript
// Query — equality filter, free to sort by any field
query(
  collection(db, "sessions"),
  where("hasNotes", "==", true),
  orderBy("updatedAt", "desc"),  // primary sort is now free
  limit(PAGE_SIZE + 1)
)
```

Add the corresponding composite index to `firestore.indexes.json`:

```json
{
  "collectionGroup": "sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "hasNotes", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

> **Note:** This pattern was already in place in `firestore.indexes.json` at lines 57-60 when the review ran — the boolean flag approach is the correct design.

### Pattern: Batch Document ID Lookups

Replace per-row `getDoc` calls with a single batched query using `documentId()`:

```typescript
import { documentId } from "firebase/firestore";

async function resolveNames(ids: string[], collection: string): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const nameMap = new Map<string, string>();

  for (let i = 0; i < unique.length; i += 30) { // Firestore "in" limit is 30
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, collection), where(documentId(), "in", chunk))
    );
    snap.forEach((doc) => nameMap.set(doc.id, doc.data().displayName ?? doc.id));
  }

  return nameMap;
}
```

Prefer routing through existing cached services (`locationService`, `cachedUserService`) when they exist.

### Pattern: Direct Document Fetch for Single ID

`where("__name__", "==", id)` routes through the query engine unnecessarily. For a single known document ID, always use `getDoc`:

```typescript
// BAD — query engine overhead for a direct lookup
const snap = await getDocs(
  query(collection(db, COLLECTIONS.LOCATIONS), where("__name__", "==", id))
);

// GOOD — direct fetch, lower latency and cost
const snap = await getDoc(doc(db, COLLECTIONS.LOCATIONS, id));
```

Use `where(documentId(), "in", [...])` only for batched multi-ID lookups.

### Pattern: Chunked Batch Writes

Firestore `writeBatch` has a hard 500-operation limit. Bulk operations must chunk:

```typescript
async function batchUpdate(db: Firestore, docs: QueryDocumentSnapshot[], update: Record<string, unknown>) {
  const BATCH_LIMIT = 500;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_LIMIT).forEach((doc) => batch.update(doc.ref, update));
    await batch.commit();
  }
}
```

### Pattern: Parallelize Independent Fan-out Reads

Sequential reads inside a `for` loop produce O(N) latency. Replace with `Promise.all`:

```typescript
// BAD — sequential O(N) latency
for (const admin of admins) {
  const snap = await db.collection("users").doc(admin.id).collection("pushSubscriptions").doc("adminAlerts").get();
  // ...
}

// GOOD — parallel O(1) latency
const snaps = await Promise.all(
  admins.map((admin) =>
    db.collection("users").doc(admin.id).collection("pushSubscriptions").doc("adminAlerts").get()
  )
);
```

### Cloud Function Error Handling

Throw `HttpsError` with gRPC codes — never raw `Error`. Raw errors serialize as `INTERNAL` and leak internal messages to clients:

```typescript
import { HttpsError } from "firebase-functions/v2/https";

// BAD
throw new Error("Session not found");

// GOOD
if (!context.auth) throw new HttpsError("unauthenticated", "Authentication required");
if (!session) throw new HttpsError("not-found", "Session not found");
if (session.userId !== uid) throw new HttpsError("permission-denied", "Cannot edit another user's session");
if (noteText.length > 500) throw new HttpsError("invalid-argument", "Note exceeds 500 characters");

// Unknown errors in catch block
throw new HttpsError("internal", "Failed to update session note");
```

---

## What Was Already Correct

- The `hasNotes` boolean + composite index pattern was already implemented in `firestore.indexes.json`
- All admin query indexes (`role ASC + createdAt DESC` for user fan-out, `hasNotes ASC + updatedAt DESC` for sessions) were present
- The `users/{uid}/notifications` subcollection query only needs a single-field index (auto-indexed by Firestore)
- Firestore rules for the notifications subcollection correctly restrict clients to `read` + `update` on the `read` field only

---

## Prevention

### Checklist for Any PR Introducing a New Firestore Query

- [ ] Inequality filters (`!=`, `not-in`, `>`, `<`)? Verify the first `orderBy` is on the filtered field AND that ordering is intentional
- [ ] Multi-field query? Confirm a composite index entry exists in `firestore.indexes.json`
- [ ] Name/label resolution in a list view? Use batched `documentId() in [...]` or a cached service — never `getDoc` in a loop
- [ ] Bulk write? Add a 500-op chunk guard
- [ ] Fan-out reads (per-user, per-admin)? Use `Promise.all` not sequential `await` in a loop
- [ ] Document ID lookup? Use `getDoc(doc(db, collection, id))`, never `where("__name__", "==")`
- [ ] Cloud Function errors? All paths throw `HttpsError` with correct gRPC code

### Rules to Add to Code Style Docs

Add to `docs/agents/code-style.md` or `docs/agents/firebase.md`:

1. **Inequality filter rule:** "If a query uses `!=` or `not-in`, restructure to use a boolean flag + equality filter. Inequality filters force `orderBy` on the filtered field."
2. **Index rule:** "Every new multi-field Firestore query must have a corresponding composite index entry in `firestore.indexes.json` before merge."
3. **N+1 rule:** "`getDoc` inside a loop is always wrong. Use `getDocs` with `documentId() in [...]`."
4. **Batch limit rule:** "Any `writeBatch` that could exceed 500 operations must chunk."
5. **Document ID rule:** "`where("__name__", "==", id)` is banned. Use `getDoc`."

### ESLint Rules to Consider

```json
// Ban console.* in src/ (already in CLAUDE.md, add to ESLint)
"no-console": "error"

// Ban __name__ string literal in queries
"no-restricted-syntax": [
  "error",
  { "selector": "Literal[value='__name__']", "message": "Use getDoc for document ID lookups, not where(__name__)" }
]
```

---

## Related Files

- `firestore.indexes.json` — composite index definitions (check here first)
- `src/components/admin/AdminSessionNotes.tsx` — admin list view with pagination
- `src/components/provider/SessionNotesList.tsx` — provider list view
- `functions/src/index.ts` — `updateSessionNote` callable, notification fan-out
- `src/lib/hooks/useNotifications.ts` — `onSnapshot` listener, `markAllAsRead`
- `docs/agents/firebase.md` — Firebase emulator ports and deploy commands
- `docs/firebase-caching-guide.md` — caching strategy patterns (cache invalidation for session writes)
- `docs/agents/architecture.md` — canonical session query paths (lines 225-230)
