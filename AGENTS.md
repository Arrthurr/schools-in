# AGENTS.md - Development Guide for schools-in

## Commands

- **Dev (Next.js)**: `npm run dev` (runs on `http://localhost:3000`)
- **Dev with Firebase emulators**: `npm run dev:firebase` (runs emulators + `npm run dev`)
- **Build (static export)**: `npm run build`
  - `next.config.js` sets `output: "export"`, so `npm run build` produces the `out/` directory used by Firebase Hosting.
  - `npm run export` exists but is generally redundant when `output: "export"` is enabled.
- **Production build**: `npm run production:build` (sets `NEXT_PUBLIC_APP_ENV=production`)
- **Staging build**: `npm run staging:build` (sets `NEXT_PUBLIC_APP_ENV=staging`)
- **Start (server)**: `npm run start` (for non-static Next server usage; Firebase Hosting serves `out/`)
- **Lint**: `npm run lint` (primary) or `npm run lint:fix`
  - `npm run lint:next` exists (Next.js lint wrapper), but the repo’s main lint is flat-config ESLint.
- **Unit tests**: `npm test`
  - **Watch**: `npm run test:watch`
  - **CI (coverage + junit)**: `npm run test:ci`
- **E2E (Cypress)**:
  - **Interactive**: `npm run test:e2e`
  - **Headless**: `npm run test:e2e:headless`
  - **With dev server (local/CI)**: `npm run test:e2e:dev` / `npm run test:e2e:ci`
  - **Performance**: `npm run test:performance`
  - **Accessibility**: `npm run test:a11y`
- **Lighthouse CI**:
  - **Direct**: `npm run lighthouse`
  - **Local (starts dev server)**: `npm run lighthouse:local`
- **Bundle analysis**: `npm run analyze` (enables `@next/bundle-analyzer`)
- **Firebase rules tests (emulator-backed)**: `npm run test:firestore-rules` / `npm run test:storage-rules`
- **Firebase emulators**:
  - **All**: `npm run firebase:emulators`
  - **Auth/Firestore/Storage**: `npm run firebase:emulators:ui`
- **Deploy**:
  - **Everything**: `npm run firebase:deploy`
  - **Hosting only**: `npm run firebase:deploy:hosting`
  - **Rules only**: `npm run firebase:deploy:rules`
  - **Production (script)**: `npm run firebase:deploy:production` (see `scripts/deploy-production.sh`)
  - **Production dry-run**: `npm run firebase:deploy:dry-run`
  - **Staging channel**: `npm run firebase:deploy:staging`
- **Rollback (Hosting)**:
  - **Interactive**: `npm run firebase:rollback`
  - **Emergency (auto previous)**: `npm run firebase:rollback:emergency`
- **Deployment status utilities**: `npm run deployment:status` (invokes `HostingManager.monitorDeployment()`; primarily useful in-browser since it short-circuits when `window` is undefined)
- **Seed Firestore**: `npm run db:seed` (runs `scripts/seed-firestore.ts` via `ts-node`)
- **Node versions**: App supports `>=18.17.0`, but Firebase Functions require Node `20`; use Node 20 for functions deploys/emulators.

## Architecture

- **Architecture**: Next.js 14 + TypeScript, App Router, PWA support, **static export** (`output: "export"`)
- **Hosting**: Firebase Hosting with static site deployment
- **Database**: Firebase Firestore with collections: users, system, sessions, locations
- **Caching**: Multi-layer caching (Memory → Session → Local → IndexedDB) with SSR-safe initialization
- **Geofencing**: Adaptive strategy detection (Periodic Sync, Wake Lock, Polling) with background support
- **Service worker / PWA**: Serwist (`@serwist/next`) with source at `src/app/sw.ts` and output at `public/sw.js`
- **Images**: `next.config.js` uses `images.unoptimized: true` (required for static export); formats include WebP/AVIF
- **UI**: Radix UI components with Tailwind CSS, shadcn/ui components
- **Auth**: Microsoft Authentication only with cached user data and role-based access
- **Maps**: Google Maps integration with @vis.gl/react-google-maps for geolocation and navigation
- **Testing**: Jest + React Testing Library (unit), Cypress (e2e), Lighthouse CI (performance)
- **State**: React hooks, cached Firebase data, offline-capable storage
- **Deployment**: Firebase Hosting static export with Firestore backend
- **Monitoring**: Firebase Performance Monitoring + Web Vitals tracking

## Static Export Constraints (Important)

- **Static output**: Routes must be compatible with `output: "export"` (no runtime server rendering).
- **Type-checking on build**: `next.config.js` sets `typescript.ignoreBuildErrors: true`.
  - The project is still TypeScript-`strict` (see `tsconfig.json`), but **a successful `npm run build` does not guarantee type safety**.
  - When you need a hard type-check locally/CI, run `npx tsc --noEmit`.

## Performance Optimizations

- **Caching System**: `src/lib/cache/` - Multi-layer Firebase data caching with 70-90% hit rates, SSR-safe initialization
- **Image Optimization**: `src/components/ui/optimized-image.tsx` - WebP/AVIF with lazy loading, SSR guards
- **Lazy Loading**: `src/lib/hooks/useLazyLoading.ts` - Intersection Observer-based loading
- **Bundle Optimization**: Code splitting, tree shaking, static asset caching
- **Offline Support**: IndexedDB persistence, service worker caching, PWA features with client-side initialization
- **Background Sync**: `src/lib/pwa/periodicBackgroundSync.ts` - Background geofence checks for Chrome/Edge
- **Wake Lock**: Prevents device sleep during auto check-in/out countdowns
- **Static Export**: All pages pre-rendered for optimal performance and CDN distribution

## PWA Meta Tags

- Include both of the following for broad mobile support and to silence deprecation warnings:

  - `<meta name="apple-mobile-web-app-capable" content="yes">` (iOS legacy/Apple-specific; still emitted via `appleWebApp` in Next metadata)
  - `<meta name="mobile-web-app-capable" content="yes">` (standard for other browsers)

- Implementation details:
  - `src/app/layout.tsx` adds the standard tag via Next.js Metadata API using `other: { 'mobile-web-app-capable': 'yes' }`.
  - `src/app/layout.tsx` also sets `appleWebApp.capable = true`, which emits the Apple tag.
  - `src/app/head.tsx` ensures the standard tag is present during app routes rendering as a fallback.

## Production Environment

- **Configuration**: `.env.production` - Production environment variables
- **Security Rules**: Enhanced Firestore and Storage rules with role-based access
- **Hosting Config**: `firebase.json` - Optimized headers and caching strategies for static export
- **Monitoring**: Real-time health checks, performance metrics, error tracking
- **Deployment**: Firebase Hosting static export with composite Firestore indexes
- **Live URL**: `https://schools-in-check.web.app`

## Local Firebase Emulator Ports

From `firebase.json`:

- **Auth**: 9099
- **Functions**: 5001
- **Firestore**: 8080
- **Hosting**: 5000

## Deploy / Rollback Notes

- **Production deploy script**: `scripts/deploy-production.sh`
  - Validates `.env.production`, validates rules, runs unit tests, builds `out/`, then deploys Firestore + Storage + Hosting.
  - Supports `--dry-run` and `--skip-tests`.
- **Rollback script**: `scripts/rollback-deployment.sh`
  - Requires `jq` and `curl` available on PATH.
  - Supports `FORCE_ROLLBACK=true` to skip confirmation and `emergency` mode.

## Key Utilities

- **Location Services**:
  - `src/lib/services/locationService.ts` - **USE THIS**: Real Firestore location queries (getAssignedLocations, calculateDistance, isWithinRadius)
  - `src/lib/services/assignmentService.ts` - Admin assignment operations (updates Location.assignedProviders)
  - `src/lib/services/cachedUserService.ts` - User operations with caching
- **Hooks**:
  - `src/lib/hooks/useCachedAuth.ts` - Enhanced auth with user data caching
  - `src/lib/hooks/useCachedSession.ts` - Session management with real-time sync
  - `src/lib/hooks/useAutoGeofenceCheck.ts` - Main geofence detection loop with adaptive strategy
  - `src/lib/hooks/useGeofenceStrategy.ts` - Capability-based strategy selector
  - `src/lib/hooks/useAutoCheckoutReminder.ts` - Countdown and toast notifications for auto-actions
  - `src/lib/hooks/useConnectivityRestoration.ts` - Handles syncing when coming back online
  - `src/lib/hooks/useEnhancedOfflineQueue.ts` - Prioritized offline action queue
  - `src/lib/hooks/useLazyLoading.ts` - Lazy loading with Intersection Observer
  - `src/lib/hooks/useLocation.ts` - Geolocation and location services
- **Google Maps Components**:
  - `src/components/maps/GoogleMap.tsx` - Main Google Maps component
  - `src/components/maps/LocationPicker.tsx` - Interactive location selection
  - `src/components/maps/NavigationButton.tsx` - "Get Directions" functionality
- **PWA Capabilities**:
  - `src/lib/pwa/capabilities.ts` - Browser feature detection and strategy assignment
  - `src/lib/pwa/periodicBackgroundSync.ts` - Chrome/Android background geofence registration
  - `src/lib/pwa/pushReminders.ts` - Push subscription helpers (admin alerts)
  - `src/components/pwa/PWAStatus.tsx` - PWA installation and status indicators
  - `src/components/pwa/PWAInstallPrompt.tsx` - Custom install prompt
  - `src/components/pwa/PWAUpdatePrompt.tsx` - Service worker update notifications
- **Image Components**:
  - `src/components/ui/optimized-image.tsx` - `OptimizedImage` + `OptimizedAvatar` (SSR guards + fallbacks)
  - `src/components/ui/lazy-image.tsx` - `LazyImage` (advanced lazy loading with placeholders)
  - `src/components/ui/avatar.tsx` - Radix `Avatar` primitives (simple UI wrapper)
- **Performance Monitoring**:
  - `src/lib/performance/webVitals.ts` - Core Web Vitals tracking
  - `src/lib/firebase/productionConfig.ts` - Firebase Performance Monitoring setup (production config)
- **SSR Safety**: All client-only modules (cache, offline) safely initialized post-hydration

## Code Style

- **Imports**: Use `@/` for src imports, group external/internal imports
- **Components**: PascalCase, functional components with TypeScript
- **Utils**: `cn()` for className merging (clsx + tailwind-merge)
- **Types**: Exported from `src/lib/firebase/types.ts`
- **Error handling**: Try/catch with proper TypeScript error types
- **Naming**: camelCase for variables/functions, SCREAMING_SNAKE_CASE for constants
- **Locations**: Use `locationService` (`getAssignedLocations`, `calculateDistance`) - `Location.assignedProviders` is single source of truth
- **Images**: Use `OptimizedImage` or `LazyImage` instead of `<img>` tags
- **Performance**: Prefer cached hooks (`useCachedAuth`, `useCachedSession`) for better performance
- **Maps**: Use `@vis.gl/react-google-maps` components for Google Maps integration
- **Testing**: Write tests for all new components and utilities
- **Accessibility**: Include proper ARIA labels and semantic HTML (see `docs/design-system.md` and `docs/responsive-design-system.md`)

## Recent Updates (as of December 2025)

- **Adaptive Geofencing Strategy**: Implemented 4-tier detection strategy in `useGeofenceStrategy.ts`:
  1. `periodic-sync`: Best (Chrome/Android) - uses Service Worker Periodic Background Sync.
  2. `visibility-wakelock`: Good (Safari iOS) - uses Page Visibility + Wake Lock API.
  3. `visibility-polling`: Fallback (Firefox) - uses visibility-based foreground polling.
  4. `manual-only`: Last resort - manual check-in/out only.
- **Advanced PWA Capabilities**: Added `capabilities.ts` for fine-grained browser detection (Wake Lock, Periodic Sync, Push, etc.).
- **Reliability Enhancements**: Added `useAutoCheckoutReminder` for visual countdowns and `useConnectivityRestoration` for robust offline-to-online syncing.
- **Data Model Fix**: Migrated to `Location.assignedProviders` as single source of truth; removed `User.assignedSchools`.
- **Google Maps Integration**: Enhanced with `@vis.gl/react-google-maps` for better performance and native-like mapping experiences.
- **Enhanced Testing Infrastructure**: Expanded test suite with Cypress E2E testing and comprehensive accessibility testing.

## Key Dependencies

### Core Framework

- **Next.js**: ^14.2.0 (App Router, TypeScript, Static Export)
- **React**: ^18.3.0 with React DOM
- **TypeScript**: ^5.5.0 with comprehensive type checking
- **Tailwind CSS**: ^3.4.17 with Tailwind Animate

### Firebase & Backend

- **Firebase**: ^12.2.1 (Auth, Firestore, Storage, Hosting)
- **Firebase Admin**: ^13.5.0 (Server-side operations)
- **Firebase Rules Testing**: ^5.0.0 (Security rules validation)

### UI Components

- **Radix UI**: Complete component library (Dialog, Dropdown, Select, etc.)
- **Lucide React**: ^0.542.0 (Icon library)
- **Class Variance Authority**: ^0.7.1 (Component variants)
- **React Hook Form**: ^7.62.0 with Zod validation

### Maps & Geolocation

- **@vis.gl/react-google-maps**: ^1.5.5 (Google Maps integration)
- **@types/google.maps**: ^3.58.1 (TypeScript definitions)

### Testing Infrastructure

- **Jest**: ^30.1.3 with React Testing Library
- **Cypress**: ^15.1.0 (E2E testing)
- **Lighthouse CI**: ^1.10.0 (Performance auditing)
- **axe-core**: ^4.10.2 (Accessibility testing)
- **Coverage**: Jest with 70% threshold requirements

### Performance & PWA

- **serwist**: ^9.2.3 (Progressive Web App) + `@serwist/next` ^9.2.3
- **Bundle Analyzer**: ^15.5.2 (Bundle size analysis)
- **Web Vitals**: ^5.1.0 (Performance monitoring)
- **IDB**: ^8.0.3 (IndexedDB for offline storage)

## Testing Strategy

### Test Coverage Requirements

- **Unit Tests**: 70% minimum coverage (branches, functions, lines, statements)
- **E2E Tests**: Critical user flows and cross-browser compatibility
- **Performance Tests**: Core Web Vitals monitoring (LCP ≤ 2.5s, FID ≤ 100ms, CLS ≤ 0.1)
- **Accessibility Tests**: WCAG 2.1 AA compliance (≥ 95% Lighthouse score)
- **Security Tests**: Firebase rules validation and vulnerability scanning

### Test Execution

- **Local Development**: `npm test` (Jest), `npm run test:e2e` (Cypress)
- **CI/CD Pipeline**: Automated testing on PR and main branch
- **Performance Monitoring**: Lighthouse CI with performance budgets
- **Accessibility Auditing**: axe-core integration with Cypress

## System Tools

- **Github CLI**: `gh`
- **Firebase CLI**: `firebase`
- **Homebrew**: `brew`
