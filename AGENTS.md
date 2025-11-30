# AGENTS.md - Development Guide for schools-in

## Commands

- **Build**: `npm run build` (Next.js build for static export)
- **Production Build**: `npm run production:build` (optimized production build)
- **Staging Build**: `npm run staging:build` (staging environment build)
- **Lint**: `npm run lint` or `npm run lint:fix` (ESLint with TypeScript)
- **Test**: `npm test` (Jest with React Testing Library)
- **Test single file**: `npm test -- path/to/file.test.ts`
- **Test watch mode**: `npm run test:watch`
- **Test CI**: `npm run test:ci` (Jest with coverage and CI reporting)
- **E2E tests**: `npm run test:e2e` (Cypress)
- **E2E headless**: `npm run test:e2e:headless` (Cypress headless mode)
- **Performance tests**: `npm run test:performance` (Cypress performance testing)
- **Accessibility tests**: `npm run test:a11y` (Cypress accessibility testing)
- **Lighthouse**: `npm run lighthouse:local` (Lighthouse CI performance auditing)
- **Bundle analysis**: `npm run analyze` (Bundle analyzer with Next.js)
- **Firebase Rules Tests**: `npm run test:firestore-rules` and `npm run test:storage-rules`
- **Dev with Firebase**: `npm run dev:firebase` (concurrently runs Firebase emulators + Next.js dev)
- **Deploy**: `npx firebase deploy --only firestore,hosting` (deploy Firestore + static hosting)
- **Deploy Production**: `npm run firebase:deploy:production` (full production deployment)
- **Deploy Staging**: `npm run firebase:deploy:staging` (staging channel deployment)
- **Rollback**: `npm run firebase:rollback` (interactive rollback utility)
- **Emergency Rollback**: `npm run firebase:rollback:emergency` (one-click rollback)
- **Deployment Status**: `npm run deployment:status` (check deployment health)

## Architecture

- **Framework**: Next.js 14 with TypeScript, App Router, PWA support, Static Export
- **Hosting**: Firebase Hosting with static site deployment
- **Database**: Firebase Firestore with collections: users, system, sessions, locations
- **Caching**: Multi-layer caching (Memory → Session → Local → IndexedDB) with SSR-safe initialization
- **Images**: Next.js Image optimization with lazy loading and WebP/AVIF support
- **UI**: Radix UI components with Tailwind CSS, shadcn/ui components
- **Auth**: Microsoft Authentication only with cached user data and role-based access
- **Maps**: Google Maps integration with @vis.gl/react-google-maps for geolocation and navigation
- **Testing**: Jest + React Testing Library (unit), Cypress (e2e), Lighthouse CI (performance)
- **State**: React hooks, cached Firebase data, offline-capable storage
- **Deployment**: Firebase Hosting static export with Firestore backend
- **Monitoring**: Firebase Performance Monitoring + Web Vitals tracking

## Performance Optimizations

- **Caching System**: `src/lib/cache/` - Multi-layer Firebase data caching with 70-90% hit rates, SSR-safe initialization
- **Image Optimization**: `src/components/ui/optimized-image.tsx` - WebP/AVIF with lazy loading, SSR guards
- **Lazy Loading**: `src/lib/hooks/useLazyLoading.ts` - Intersection Observer-based loading
- **Bundle Optimization**: Code splitting, tree shaking, static asset caching
- **Offline Support**: IndexedDB persistence, service worker caching, PWA features with client-side initialization
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
- **Live URL**: https://schools-in-check.web.app

## Key Utilities

- **Location Services**:
  - `src/lib/services/locationService.ts` - **USE THIS**: Real Firestore location queries (getAssignedLocations, calculateDistance, isWithinRadius)
  - `src/lib/services/assignmentService.ts` - Admin assignment operations (updates Location.assignedProviders)
  - `src/lib/services/cachedUserService.ts` - User operations with caching
- **Hooks**:
  - `src/lib/hooks/useCachedAuth.ts` - Enhanced auth with user data caching
  - `src/lib/hooks/useCachedSession.ts` - Session management with real-time sync
  - `src/lib/hooks/useLazyLoading.ts` - Lazy loading with Intersection Observer
  - `src/lib/hooks/useOfflineQueue.ts` - Offline action queue management
  - `src/lib/hooks/useLocation.ts` - Geolocation and location services
- **Google Maps Components**:
  - `src/components/maps/GoogleMap.tsx` - Main Google Maps component
  - `src/components/maps/LocationPicker.tsx` - Interactive location selection
  - `src/components/maps/NavigationButton.tsx` - "Get Directions" functionality
- **PWA Components**:
  - `src/components/pwa/PWAStatus.tsx` - PWA installation and status indicators
  - `src/components/pwa/PWAInstallPrompt.tsx` - Custom install prompt
  - `src/components/pwa/PWAUpdatePrompt.tsx` - Service worker update notifications
- **Image Components**:
  - `OptimizedImage` - Main optimized image component with SSR guards
  - `OptimizedAvatar` - User avatar with fallbacks
  - `LazyImage` - Advanced lazy loading with placeholders
- **Performance Monitoring**:
  - `src/lib/performance/webVitals.ts` - Core Web Vitals tracking
  - `src/components/dev/PerformanceMonitor.tsx` - Development performance dashboard
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
- **Accessibility**: Include proper ARIA labels and semantic HTML (see `src/AGENTS.md` for detailed UI/UX rules)

## Recent Updates (as of October 2025)

- **Data Model Fix**: Migrated to `Location.assignedProviders` as single source of truth; removed `User.assignedSchools`; created `locationService.ts` with Firestore queries
- **UI Migration**: All provider components now use real Firestore data via `locationService` instead of mock `schoolService`
- **Auth Fix**: Registration and Google sign-in now automatically create Firestore user documents with default `provider` role
- **Security Rules**: Simplified to use only `Location.assignedProviders` for access control; removed assignments collection fallback
- **School Import**: 22 schools imported to Firestore with proper GeoPoint fields and metadata
- **Google Maps Integration**: Added comprehensive Google Maps support with `@vis.gl/react-google-maps` for geolocation, navigation, and interactive location selection
- **Enhanced Testing Infrastructure**: Expanded test suite with Cypress E2E testing, Lighthouse CI performance auditing, and comprehensive accessibility testing with axe-core
- **PWA Features**: Complete Progressive Web App implementation with service worker, offline support, install prompts, and update notifications

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

- **serwist**: ^1.2.0 (Progressive Web App)
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
