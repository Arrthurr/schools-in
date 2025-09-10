# Task List: Provider Location-Based Check-In / Check-Out

## Relevant Files

- `package.json` - Next.js project configuration with dependencies for PWA, Firebase, Tailwind CSS, shadcn/ui, ESLint 9, and next-pwa plugin
- `.gitignore` - Comprehensive Git ignore patterns for Next.js, Firebase, PWA, and development files
- `next.config.js` - Next.js configuration with next-pwa plugin, service worker, and caching strategies
- `tailwind.config.js` - Tailwind CSS configuration with brand colors and custom design tokens
- `eslint.config.mjs` - ESLint 9 flat configuration with Next.js and TypeScript rules
- `.vscode/settings.json` - VS Code settings for ESLint integration and auto-formatting
- `jest.config.js` - Jest configuration for unit testing with Next.js and TypeScript
- `jest.setup.js` - Jest setup file with mocks and test environment configuration
- `src/lib/test-utils.tsx` - Custom testing utilities and render functions
- `cypress.config.js` - Cypress configuration for E2E testing with Next.js
- `cypress/support/e2e.js` - Cypress E2E test support file with global configuration
- `cypress/support/commands.js` - Custom Cypress commands and utilities including geolocation mocking, session state checks, and mobile testing helpers
- `cypress/support/e2e.ts` - TypeScript declarations for custom Cypress commands with comprehensive type safety
- `cypress/e2e/homepage.cy.js` - E2E tests for homepage functionality and responsive design
- `cypress/e2e/navigation.cy.js` - E2E tests for navigation, routing, and performance
- `cypress/e2e/ui-components.cy.js` - E2E tests for UI components and visual styling
- `cypress/fixtures/example.json` - Test data fixtures for E2E testing
- `firebase.config.js` - Firebase SDK configuration and initialization
- `firebase.json` - Firebase project configuration with Firestore, Hosting, Storage, and emulator settings
- `.firebaserc` - Firebase project aliases and environment configuration
- `firestore.rules` - Firestore security rules for role-based access control
- `firestore.indexes.json` - Firestore database indexes for query optimization
- `storage.rules` - Firebase Storage security rules for file access control
- `.github/workflows/firebase-hosting-pull-request.yml` - GitHub Actions workflow for Firebase Hosting deployment
- `lib/firebase/auth.ts` - Firebase Authentication service and utilities
- `lib/firebase/firestore.ts` - Firestore database service and CRUD operations
- `lib/firebase/firestore.test.ts` - Unit tests for Firestore operations
- `lib/utils/location.ts` - GPS utilities and location validation functions
- `lib/utils/location.test.ts` - Unit tests for location utilities
- `lib/utils/session.ts` - Session management utilities and business logic
- `lib/utils/session.test.ts` - Unit tests for session utilities
- `lib/utils.ts` - Utility functions including className merging (cn) for shadcn/ui
- `lib/hooks/useAuth.ts` - Custom React hook for authentication state management
- `lib/hooks/useLocation.ts` - Custom React hook for GPS location handling
- `lib/hooks/useSession.ts` - Custom React hook for session management
- `components.json` - shadcn/ui configuration file
- `components/ui/button.tsx` - shadcn/ui Button component
- `components/ui/card.tsx` - shadcn/ui Card components (Card, CardHeader, CardTitle, CardDescription, CardContent)
- `components/ui/input.tsx` - shadcn/ui Input component for forms
- `components/ui/label.tsx` - shadcn/ui Label component for form labels
- `components/ui/form.tsx` - shadcn/ui Form components for form handling
- `components/ui/badge.tsx` - shadcn/ui Badge component for status indicators
- `src/components/ui/status-badge.tsx` - Reusable status badge component with icons, colors, and descriptions for session status indicators
- `components/ui/alert.tsx` - shadcn/ui Alert component for notifications
- `components/ui/dialog.tsx` - shadcn/ui Dialog components for modals
- `components/ui/sheet.tsx` - shadcn/ui Sheet component for slide-out panels
- `components/ui/table.tsx` - shadcn/ui Table components for data display
- `components/auth/LoginForm.tsx` - Login form with Google OAuth and email/password options
- `components/auth/LoginForm.test.tsx` - Unit tests for LoginForm component
- `components/auth/ProtectedRoute.tsx` - Route protection wrapper component
- `src/components/provider/SchoolList.tsx` - Provider dashboard school list component with search, distance calculation, and check-in functionality
- `src/components/provider/SchoolList.test.tsx` - Unit tests for SchoolList component
- `src/components/provider/SchoolDetailView.tsx` - Detailed school information view with location data, GPS coordinates, and check-in options
- `src/components/provider/SchoolDetailView.test.tsx` - Unit tests for SchoolDetailView component
- `src/components/provider/CheckInButton.tsx` - Enhanced check-in/check-out component with GPS validation, comprehensive error handling, session timer integration, and confirmation dialogs for check-in/out actions with location verification and session summary display
- `src/components/provider/SessionStatus.tsx` - Current session status display component with timer, controls, and session information
- `src/components/provider/SessionStatus.test.tsx` - Unit tests for SessionStatus component
- `src/lib/services/schoolService.ts` - Service layer for school data operations, distance calculations, and assignments
- `src/app/dashboard/schools/page.tsx` - Dedicated schools management page showcasing list and detail views
- `src/components/provider/SessionTimerDisplay.tsx` - Reusable session timer component that displays live session duration with real-time updates, supports both active and completed sessions, and provides compact and full display modes
- `src/components/provider/SessionTimerDisplay.test.tsx` - Unit tests for the SessionTimerDisplay component covering basic rendering, compact mode, and completed session handling
- `src/lib/utils/location.ts` - Enhanced GPS utilities with accuracy support and improved location validation functions
- `src/lib/utils/location.test.ts` - Unit tests for enhanced location utilities and GPS functions
- `src/lib/hooks/useSession.ts` - Enhanced session management hook with improved user authentication, auto-loading, and duration calculation for session completion
- `src/components/provider/SessionHistory.tsx` - Provider session history display component with table view, school name resolution, session details, and modal detail view
- `src/components/provider/SessionHistory.test.tsx` - Unit tests for SessionHistory component covering loading, error, empty states, and data display
- `src/components/provider/SessionDetailModal.tsx` - Modal component displaying comprehensive session details including status, time, location, and user information
- `src/components/provider/SessionDetailModal.test.tsx` - Unit tests for SessionDetailModal component covering rendering, data display, and user interactions
- `src/components/admin/AdminDashboard.tsx` - Comprehensive admin dashboard component with statistics cards, recent activity feed, quick actions, and active session alerts
- `src/components/admin/AdminNavigation.tsx` - Admin navigation component with sidebar layout, mobile support, breadcrumbs, and consistent navigation across admin pages
- `src/components/admin/SchoolForm.tsx` - School creation and editing form component with geocoding support, GPS validation, and comprehensive form handling
- `src/components/admin/SchoolForm.test.tsx` - Unit tests for SchoolForm component covering form validation, submission, and user interactions
- `src/components/ui/textarea.tsx` - shadcn/ui Textarea component for multi-line text input forms
- `components/admin/SchoolManager.tsx` - Admin school management interface
- `components/admin/SchoolManager.test.tsx` - Unit tests for SchoolManager component
- `src/components/admin/SessionReports.tsx` - Comprehensive session reporting dashboard component with filtering, summary statistics, and session data table
- `src/components/admin/SessionReports.test.tsx` - Unit tests for SessionReports component (module resolution issue to be fixed separately)
- `components/admin/SessionReports.test.tsx` - Unit tests for SessionReports component
- `app/layout.tsx` - Root layout with PWA manifest, viewport configuration, and global providers
- `app/page.tsx` - Landing/login page
- `app/dashboard/page.tsx` - Provider dashboard page
- `app/admin/page.tsx` - Admin dashboard page
- `app/admin/schools/page.tsx` - Comprehensive school management page with CRUD operations, search filtering, and modal forms
- `src/app/admin/reports/page.tsx` - Updated reports page to use the new SessionReports component
- `app/api/sessions/route.ts` - API route for session CRUD operations
- `app/api/sessions/route.test.ts` - Unit tests for sessions API
- `app/api/locations/route.ts` - API route for location/school CRUD operations
- `app/api/locations/route.test.ts` - Unit tests for locations API
- `public/manifest.json` - Enhanced PWA manifest with shortcuts, categories, and complete configuration
- `public/sw.js` - Service worker placeholder (auto-generated by next-pwa)
- `public/icon-192.png` - PWA icon 192x192 (placeholder)
- `public/icon-512.png` - PWA icon 512x512 (placeholder)
- `src/components/layout/ClientLayout.tsx` - Enhanced client layout with PWA components integration
- `src/components/pwa/PWAInstallPrompt.tsx` - PWA installation prompt component with user experience optimization
- `src/components/pwa/PWAInstallPrompt.test.tsx` - Unit tests for PWA installation prompt component
- `src/components/pwa/PWAUpdatePrompt.tsx` - PWA update notification component for service worker updates
- `src/components/pwa/PWAStatus.tsx` - PWA status indicator showing online/offline and installation status
- `cypress/e2e/provider-flow.cy.ts` - Comprehensive E2E tests for provider check-in/check-out flow covering success scenarios, location validation, error handling, mobile responsiveness, accessibility, and performance
- `cypress/e2e/admin-flow.cy.ts` - Comprehensive E2E tests for admin management workflows including dashboard, school management, provider management, session reporting, bulk operations, error handling, mobile responsiveness, accessibility, and performance testing
- `jest.config.js` - Jest configuration for unit tests
- `cypress.config.js` - Cypress configuration for E2E tests
- `docs/design-system.md` - Comprehensive design system documentation with brand colors, component guidelines, and implementation notes for consistent UI/UX

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npm test` to run Jest unit tests. Use `npm run test:e2e` to run Cypress E2E tests.
- Firebase emulators should be used for local development and testing.

## Tasks

- [x] 1.0 Project Setup and Infrastructure

  - [x] 1.1 Initialize Next.js 14+ project with TypeScript and App Router
  - [x] 1.2 Install and configure Tailwind CSS v4 with brand colors (#154690)
  - [x] 1.3 Set up shadcn/ui component library
  - [x] 1.4 Configure ESLint 9 with Next.js and TypeScript rules
  - [x] 1.5 Set up Jest for unit testing with React Testing Library
  - [x] 1.6 Configure Cypress for E2E testing
  - [x] 1.7 Initialize Git repository with proper .gitignore
  - [x] 1.8 Create basic project structure and folder organization

- [x] 2.0 Firebase Configuration and Authentication

  - [x] 2.1 Set up Firebase project and obtain configuration keys
  - [x] 2.2 Install Firebase SDK and configure initialization
  - [x] 2.3 Set up Firebase Authentication with Google OAuth provider
  - [x] 2.4 Configure email/password authentication
  - [x] 2.5 Create Firebase Auth service utilities
  - [x] 2.6 Set up Firebase emulators for local development
  - [x] 2.7 Configure Firebase security rules for Authentication

- [x] 3.0 Database Schema and Firestore Setup

  - [x] 3.1 Design and implement Firestore collections structure (locations, users, sessions)
  - [x] 3.2 Create Firestore service layer with CRUD operations
  - [x] 3.3 Set up Firestore security rules for role-based access
  - [x] 3.4 Implement data validation and sanitization utilities
  - [x] 3.5 Create database seeding scripts for development/testing
  - [x] 3.6 Set up Firestore indexes for query optimization

- [x] 4.0 Core Location Services and GPS Utilities

  - [x] 4.1 Implement GPS coordinate fetching with browser Geolocation API
  - [x] 4.2 Create distance calculation utilities (Haversine formula)
  - [x] 4.3 Build location validation logic for school radius checking
  - [x] 4.4 Handle location permission requests and error states
  - [x] 4.5 Implement location accuracy and timeout handling
  - [x] 4.6 Create location service abstraction for testing

- [x] 5.0 User Authentication and Role Management

  - [x] 5.1 Create login form component with Google OAuth and email/password
  - [x] 5.2 Implement user registration flow
  - [x] 5.3 Build role-based access control system (Provider/Admin)
  - [x] 5.4 Create protected route wrapper component
  - [x] 5.5 Implement user profile management
  - [x] 5.6 Add logout functionality and session management
  - [x] 5.7 Create authentication state management hooks

- [x] 6.0 Provider Dashboard and School List

  - [x] 6.1 Create provider dashboard layout and navigation
  - [x] 6.2 Implement school list component with assigned locations
  - [x] 6.3 Add school search and filtering functionality
  - [x] 6.4 Create school detail view with location information
  - [x] 6.5 Implement responsive design for mobile and desktop
  - [x] 6.6 Add current session status display

- [x] 7.0 Check-In/Check-Out Functionality

  - [x] 7.1 Create check-in button component with GPS validation
  - [x] 7.2 Implement check-in flow with location verification
  - [x] 7.3 Create check-out functionality with session completion
  - [x] 7.4 Add loading states and user feedback during GPS operations
  - [x] 7.5 Implement error handling for failed location checks
  - [x] 7.6 Create session timer and duration tracking
  - [x] 7.7 Add confirmation dialogs for check-in/out actions

- [x] 8.0 Session History and Management

  - [x] 8.1 Create session history component for providers
  - [x] 8.2 Implement pagination for session lists
  - [x] 8.3 Add session filtering by date range and school
  - [x] 8.4 Create session detail view with full information
  - [x] 8.5 Implement session duration calculations and display
  - [x] 8.6 Add session status indicators (active, completed, error)

- [x] 9.0 Admin Panel and School Management

  - [x] 9.1 Create admin dashboard with navigation and overview
  - [x] 9.2 Implement school creation and editing forms
  - [x] 9.3 Add school list management with CRUD operations
  - [x] 9.4 Create user management interface for role assignment
  - [x] 9.5 Implement school-to-provider assignment functionality
  - [x] 9.6 Add school location validation and GPS coordinate setting
  - [x] 9.7 Create bulk operations for school management

- [x] 10.0 Admin Reporting and Data Export

  - [x] 10.1 Create session reporting dashboard with filters
  - [x] 10.2 Implement date range, provider, and school filtering
  - [x] 10.3 Add CSV export functionality for session data
  - [x] 10.4 Create attendance summary reports
  - [x] 10.5 Implement session correction and force-close features
  - [x] 10.6 Add data visualization charts for session analytics
  - [x] 10.7 Create automated report scheduling (future enhancement)

- [x] 11.0 PWA Configuration and Offline Support

  - [x] 11.1 Configure Next.js PWA plugin and manifest
  - [x] 11.2 Create service worker for offline functionality
  - [x] 11.3 Implement offline data caching strategy
  - [x] 11.4 Add offline queue for check-in/out actions
  - [x] 11.5 Create sync mechanism for when connectivity returns
  - [x] 11.6 Add offline status indicators and user messaging
  - [x] 11.7 Test PWA installation and offline scenarios

- [ ] 12.0 UI/UX Implementation and Styling

  - [x] 12.1 Apply brand colors and design system throughout app
  - [x] 12.2 Implement responsive layouts for all screen sizes
  - [x] 12.3 Create consistent component styling with Tailwind
  - [x] 12.4 Add loading states, skeletons, and micro-interactions
  - [x] 12.5 Implement accessibility features (WCAG 2.1 AA compliance)
  - [x] 12.6 Create error states and empty states for all components
  - [x] 12.7 Add brand asset integration when provided

- [ ] 13.0 Testing Suite (Unit and E2E)

  - [x] 13.1 Write unit tests for all utility functions and services
  - [ ] 13.2 Create component tests for all React components
    - [x] StatusBadge component tests (`src/components/ui/__tests__/status-badge.test.tsx`)
  - [x] Textarea component tests (`src/components/ui/__tests__/textarea.test.tsx`)
  - [x] 13.3 Implement API route testing with mocked Firebase
  - [x] 13.4 Write E2E tests for provider check-in/out flow
  - [x] 13.5 Create E2E tests for admin management workflows
  - [ ] 13.6 Add performance and accessibility testing
  - [ ] 13.7 Set up CI/CD pipeline with automated testing

- [ ] 14.0 Error Handling and Edge Cases

  - [ ] 14.1 Implement comprehensive error boundaries
  - [ ] 14.2 Add GPS permission denied handling
  - [ ] 14.3 Handle network connectivity issues
  - [ ] 14.4 Implement session timeout and cleanup logic
  - [ ] 14.5 Add validation for edge cases (multiple sessions, location drift)
  - [ ] 14.6 Create user-friendly error messages and recovery options
  - [ ] 14.7 Add logging and monitoring for production issues

- [ ] 15.0 Performance Optimization and Deployment
  - [ ] 15.1 Optimize bundle size and implement code splitting
  - [ ] 15.2 Add image optimization and lazy loading
  - [ ] 15.3 Implement caching strategies for Firebase data
  - [ ] 15.4 Configure production Firebase environment
  - [ ] 15.5 Set up deployment pipeline (Firebase Hosting)
  - [ ] 15.6 Add performance monitoring and analytics
  - [ ] 15.7 Conduct final testing and user acceptance testing
