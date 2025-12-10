---
name: m365-group-based-login-and-assignments
overview: Enhance login to use Microsoft 365 groups for admin/provider role detection and automatic school assignments, then route users to the correct dashboard with assigned schools populated.
todos:
  - id: cloud-fn-m365-sync
    content: Implement the syncUserFromM365 Cloud Function to call Microsoft Graph, set user role from DMDL Office membership, and synchronize locations.assignedProviders based on school group membership.
    status: completed
  - id: frontend-login-integration
    content: Integrate the new syncUserFromM365 callable into the Microsoft login flow and ensure routing uses the updated role.
    status: completed
  - id: locations-name-normalization
    content: Normalize Firestore locations.name values so they exactly match Microsoft 365 school group displayName values for all schools.
    status: in_progress
  - id: auth-flow-tests
    content: Add unit and E2E tests verifying group-based role assignment, routing, and assigned school population on the dashboard.
    status: in_progress
  - id: coverage-and-ci
    content: Raise Jest coverage back to >=70% (currently ~38% global); focus on auth/login, dashboard assignments, and sync edge cases.
    status: completed
  - id: e2e-validation
    content: Run Cypress login/admin/provider routing flows headless after coverage issues are resolved.
    status: pending
---

## Microsoft 365 Group-Based Login & School Assignment Plan

### 1. Backend: Cloud Function to sync user from Microsoft 365

- **New callable function**: Add a new `onCall` HTTPS function in `functions/src/index.ts` (e.g. `syncUserFromM365`) that:
- Requires Firebase Authentication (`request.auth` must be present).
- Accepts minimal input (e.g. `{ email: string }`), or uses `auth.token.email` if present.
- Uses the Microsoft Graph API to fetch all groups the user is a member of.
- **Graph client setup**:
- Configure environment/secrets for Microsoft app registration:
- **Required**: tenant ID, client ID, client secret.
- **Required**: `DMDL_OFFICE_GROUP_ID` (or name) for the admin group.
- Implement a small helper in the functions code to:
- Acquire an app-only access token via client credentials (`https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`).
- Call Graph (e.g. `GET /v1.0/users/{userPrincipalName}/memberOf?$select=id,displayName`) and normalize group results to `{ id, displayName }`.
- **Admin/provider determination (Outcome 1)**:
- In `syncUserFromM365`, check whether any returned group matches the configured `DMDL Office` group (by ID or displayName, depending on config).
- Compute `role = "admin"` if member, else `"provider"`.
- Update the Firestore `users/{uid}` document (using the Admin SDK) with the correct `role` and `updatedAt`, leaving the rest of the schema intact.
- Return `{ role }` in the callable response for the client to consume.

### 2. Backend: Derive provider school assignments from groups (Outcome 2)

- **Group-to-location mapping policy**:
- Treat **each Microsoft 365 group that represents a school** as mapped to a Firestore `locations` document where `locations.name === group.displayName` (Option 1).
- Non-school groups (like `DMDL Office`) are ignored for assignments.
- **Location matching logic**:
- Extract the set of school group names from the user’s group membership (excluding `DMDL Office`).
- Query Firestore via the Admin SDK to find matching locations:
- Because there are ~22 schools, simplest approach is to fetch all active `locations` once and filter in memory on `location.name === group.displayName` to avoid `in` query limits.
- Build the list of `matchedLocationIds` from these comparisons.
- **Assignment synchronization**:
- For each matched location ID, ensure the `users/{uid}` is present in `location.assignedProviders`:
- Use `arrayUnion(uid)` for add operations.
- (Optional but recommended) For locations where the user is **currently assigned** but **no longer in a corresponding group**, remove the provider:
- Read the user’s currently assigned locations (via Admin SDK query on `assignedProviders` containing `uid`).
- For any such location not in `matchedLocationIds`, call `arrayRemove(uid)`.
- Return the list of assigned schools to the client (e.g. `{ role, assignedLocations: [{ id, name }] }`) for logging/UX if needed.

### 3. Frontend: Integrate the sync function into the login flow

- **Auth service integration**:
- In `src/lib/firebase/auth.ts`, add a client-side helper that calls the callable function (e.g. `syncUserFromM365()`), using `firebase/functions`.
- This helper should:
- Require the user to be signed in (use the current `auth` instance).
- Call the callable `syncUserFromM365` with the signed-in user’s email (if needed) and await completion.
- Return the `{ role, assignedLocations }` payload to the caller.
- **Login form flow update** (`src/components/auth/LoginForm.tsx`):
- In `handleMicrosoftSignIn`:
- After `signInWithMicrosoft()` resolves, but **before** `waitForUserDocument` and routing:
- Call `syncUserFromM365()` and wait for it to complete.
- Then call `waitForUserDocument(result.user.uid)` as currently implemented; this should now see a `users` document with the correct `role` field coming from the backend function.
- Keep the existing `waitForAuthStatePropagation()` call to ensure downstream hooks see the correct auth state.
- Leave the routing logic largely unchanged:
- If `redirectTo` is absent, read `userDoc.role` and route to `/admin` if `"admin"`, otherwise `/dashboard`.
- If `redirectTo` is present, just route there after sync+propagation.

### 4. Ensure dashboard and provider views use Firestore assignments

- **Provider dashboard** (`src/app/dashboard/page.tsx`):
- Confirm the dashboard already loads assigned schools using `getAssignedLocations(user.uid)` from `locationService`, which queries `locations` by `assignedProviders`.
- No major logic changes should be required; once `assignedProviders` is populated by the Cloud Function, the existing dashboard’s `SchoolList` and metrics will show the correct schools.
- **Other provider views** (e.g. `src/app/dashboard/schools/page.tsx` and `SchoolList` / `SchoolDetailView` components):
- Verify these components rely on `locationService` / `getAssignedLocations` or related helpers (not the legacy `schoolService`), updating any remaining legacy usage if necessary.
- Ensure the check-in flow (session start callable) already verifies `location.assignedProviders` contains the provider ID, so newly-synced assignments allow check-in as intended.

### 5. Data consistency: Align Firestore `locations` with Microsoft 365 group names

- Status: Script exists at `scripts/normalize-location-names.js`; production data still needs verification and execution.
- **Audit existing locations**:
- Export or list all documents in the `locations` collection and their `name` fields.
- Obtain the list of Microsoft 365 school group `displayName` values from your tenant.
- Create a simple mapping table (e.g. CSV) to check for exact matches and mismatches.
- **Normalize names (Option 1)**:
- For any mismatched entries (e.g. `"HOPE Excel Academy"` vs `"Hope Excel"`), choose a single canonical text that matches the Microsoft 365 `displayName`.
- Update the corresponding Firestore `locations.name` fields either:
- Directly via the Firestore console, or
- With a one-time admin script (Node script using Firebase Admin SDK in `scripts/` or a temporary function) to batch-update names.
- After normalization, verify that every school locations document has a corresponding Microsoft 365 group with exactly the same `displayName`.

### 6. Testing and validation

- Current results (this branch): `npm run lint` ✅; `npm test -- --runInBand` ❌ because global coverage thresholds (branches/functions/lines/statements ~38-66% vs 70% required). All suites otherwise pass.
- Action: Add focused tests (auth/login, dashboard assignments, sync fallback/error paths) to raise coverage to threshold. Re-run full Jest suite after additions.
- Action: After unit coverage is fixed, run `npm run test:e2e:headless` for login/admin/provider routing flows.
- **Unit / integration tests**:
- Add tests for the new Cloud Function logic (using the Firebase Functions emulator) to validate:
- Admin vs provider role assignment when the user is / isn’t in `DMDL Office`.
- Correct `locations.assignedProviders` updates when group names match and no changes when they don’t.
- Add or extend Jest tests in `src/lib/firebase/auth.test.ts` and `src/components/auth/LoginForm.test.tsx` to assert that:
- `handleMicrosoftSignIn` calls the sync helper after sign-in.
- Routing respects `role` as returned by the user document.
- **End-to-end validation**:
- Using Cypress and/or manual tests:
- Sign in as a user only in provider school groups: verify they land on `/dashboard` and see their assigned schools.
- Sign in as a user in `DMDL Office`: verify they land on `/admin` and have admin access.
- Remove a user from a school group and re-login: verify their assignments update (if removal is implemented).

### 7. Configuration and deployment

- **Configuration**:
- Document required environment variables for the Cloud Function (tenant, client ID/secret, `DMDL Office` group identifier) in your deployment notes.
- Ensure these secrets are set in your Firebase Functions environment before deployment.
- **Deployment**:
- Deploy updated Cloud Functions.
- Deploy updated frontend.
- Run smoke tests on staging (if available) before promoting to production.

### 8. Runtime and build hygiene

- Functions runtime must target Node 20 (Firebase-supported). `functions/package.json` updated accordingly.
- Keep `functions/lib` build artifacts out of git (already gitignored) to avoid lint failures; build during deployment instead.

### Implementation Todos

- **cloud-fn-m365-sync**: Implement the `syncUserFromM365` Cloud Function with Microsoft Graph integration and Firestore updates for user role and `locations.assignedProviders`.
- **frontend-login-integration**: Wire the new sync function into `signInWithMicrosoft` / `LoginForm` so login waits for role+assignment sync before routing.
- **locations-name-normalization**: Audit and normalize `locations.name` values to exactly match Microsoft 365 school group `displayName` values.
- **auth-flow-tests**: Add/update unit and E2E tests to cover the new group-based admin/provider routing and school assignment behavior.
- **coverage-and-ci**: Add coverage-focused tests to satisfy the 70% global thresholds; rerun `npm test` until green.
- **e2e-validation**: Execute Cypress login/admin/provider routing flows headless after coverage is resolved.
