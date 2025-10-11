# Task List: Microsoft Authentication Integration

## Relevant Files

- `src/lib/firebase/auth.ts` - Core Firebase authentication service; will add Microsoft auth provider and `signInWithMicrosoft` function
- `src/lib/firebase/auth.test.ts` - Unit tests for Firebase auth utilities; will add tests for Microsoft authentication
- `src/components/auth/LoginForm.tsx` - Login form component; will add Microsoft sign-in button and handler
- `src/components/auth/LoginForm.test.tsx` - Unit tests for LoginForm; will add tests for Microsoft button rendering and interaction
- `cypress/e2e/microsoft-auth.cy.ts` - New E2E test file for Microsoft authentication flow
- `cypress/support/commands.js` - Cypress custom commands; may need to extend for Microsoft auth mocking

### Notes

- Unit tests should be run with `npm test` or `npm test -- path/to/test/file.test.ts`
- E2E tests should be run with `npm run test:e2e` or `npm run test:e2e:headless`
- Follow existing patterns in `signInWithGoogle` for consistency
- The `createUserDocument` helper function will handle Microsoft users automatically with default "provider" role
- Microsoft authentication uses `OAuthProvider` from Firebase Auth with provider ID `microsoft.com`
- Microsoft is already configured in Firebase Auth and Entra tenant (prerequisite complete)

## Tasks

- [x] 1.0 Add Microsoft OAuth Provider to Firebase Authentication Service
  - [x] 1.1 Import `OAuthProvider` from `firebase/auth` in `src/lib/firebase/auth.ts`
  - [x] 1.2 Create a new Microsoft OAuth provider instance with provider ID `microsoft.com`
  - [x] 1.3 Create `signInWithMicrosoft` async function that uses `signInWithPopup` with the Microsoft provider
  - [x] 1.4 Call `createUserDocument` within `signInWithMicrosoft` to ensure Firestore document creation (following the `signInWithGoogle` pattern)
  - [x] 1.5 Export the `signInWithMicrosoft` function for use in components
  - [x] 1.6 Verify TypeScript types are correct (should return `Promise<UserCredential>`)

- [x] 2.0 Implement Microsoft Sign-In Button in LoginForm Component
  - [x] 2.1 Import `signInWithMicrosoft` from `@/lib/firebase/auth` in `LoginForm.tsx`
  - [x] 2.2 Create `handleMicrosoftSignIn` async function following the same pattern as `handleGoogleSignIn`
  - [x] 2.3 Add performance tracking with `performance.now()` for start time and login time
  - [x] 2.4 Implement error handling that sets the error state and announces to screen readers
  - [x] 2.5 Implement role-based redirect logic (admin → /admin, provider → /dashboard)
  - [x] 2.6 Add the same 100ms delay for Firestore document availability as Google sign-in
  - [x] 2.7 Add Microsoft sign-in button in the JSX, positioned **above** the Google sign-in button
  - [x] 2.8 Use `LoadingButton` component with outline variant and proper styling classes
  - [x] 2.9 Set button text to "Sign in with Microsoft" with proper `aria-label`
  - [x] 2.10 Connect the button's `onClick` handler to `handleMicrosoftSignIn`
  - [x] 2.11 Share the same `loading` state between all authentication buttons
  - [x] 2.12 Set `loadingText` to "Connecting..." for consistency

- [x] 3.0 Add Authorization Check for Unauthorized Microsoft Accounts
  - [x] 3.1 Update `handleMicrosoftSignIn` to check if user document exists after authentication
  - [x] 3.2 If user document doesn't exist or user doesn't have proper access, throw a custom error
  - [x] 3.3 Set custom error message to "Your account is not authorized." for unauthorized accounts
  - [x] 3.4 Ensure the error is caught and displayed in the Alert component
  - [x] 3.5 Add screen reader announcement for authorization errors using the `announce` function
  - [x] 3.6 Consider edge case: If `userDoc` is null, treat as unauthorized and show the error message

- [ ] 4.0 Create Unit Tests for Microsoft Authentication
  - [x] 4.1 Add `OAuthProvider` to the mock imports in `src/lib/firebase/auth.test.ts`
  - [x] 4.2 Create a new `describe` block for `signInWithMicrosoft` tests
  - [x] 4.3 Write test: "calls signInWithPopup with Microsoft provider" - verify correct provider and auth object
  - [x] 4.4 Write test: "creates user document after successful sign-in" - verify `createUserDocument` is called
  - [x] 4.5 Write test: "throws error when Microsoft sign-in fails" - mock rejection and verify error handling
  - [x] 4.6 Write test: "returns UserCredential on successful authentication" - verify return type and value
  - [x] 4.7 Update `LoginForm.test.tsx` to mock `signInWithMicrosoft` function
  - [x] 4.8 Write test: "renders Microsoft sign-in button" - verify button exists with correct text
  - [x] 4.9 Write test: "Microsoft button appears above Google button" - verify DOM order
  - [x] 4.10 Write test: "calls signInWithMicrosoft when button clicked" - simulate click and verify function call
  - [x] 4.11 Write test: "shows error message for unauthorized accounts" - mock authorization failure
  - [x] 4.12 Write test: "disables all buttons during Microsoft sign-in" - verify loading state
  - [x] 4.13 Run tests with `npm test -- src/lib/firebase/auth.test.ts` and verify all pass
  - [x] 4.14 Run tests with `npm test -- src/components/auth/LoginForm.test.tsx` and verify all pass

- [ ] 5.0 Create E2E Tests for Microsoft Authentication Flow
  - [ ] 5.1 Create new file `cypress/e2e/microsoft-auth.cy.ts`
  - [ ] 5.2 Add TypeScript reference comment `/// <reference types="cypress" />`
  - [ ] 5.3 Create main describe block: "Microsoft Authentication Flow"
  - [ ] 5.4 Write test: "should display Microsoft sign-in button on login page" - verify button visibility and position
  - [ ] 5.5 Write test: "should successfully sign in with Microsoft account" - mock successful auth flow
  - [ ] 5.6 Write test: "should redirect to dashboard after Microsoft provider sign-in" - verify role-based redirect
  - [ ] 5.7 Write test: "should redirect to admin dashboard for Microsoft admin users" - test admin redirect
  - [ ] 5.8 Write test: "should show 'Your account is not authorized' for unauthorized Microsoft accounts" - mock auth failure
  - [ ] 5.9 Write test: "should handle Microsoft popup cancellation gracefully" - user closes popup
  - [ ] 5.10 Write test: "should show loading state during Microsoft authentication" - verify spinner and disabled state
  - [ ] 5.11 Write test: "should announce Microsoft sign-in success to screen readers" - verify aria-live region
  - [ ] 5.12 Write test: "should announce Microsoft sign-in errors to screen readers" - verify assertive announcement
  - [ ] 5.13 Add helper function in `cypress/support/commands.js` to mock Microsoft authentication if needed
  - [ ] 5.14 Run E2E tests with `npm run test:e2e` and verify all pass
  - [ ] 5.15 Test on both desktop and mobile viewports to ensure responsive behavior

