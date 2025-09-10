# AGENTS.md - Development Guide for schools-in

## Commands
- **Build**: `npm run build` (Next.js build)
- **Production Build**: `npm run production:build` (optimized production build)
- **Staging Build**: `npm run staging:build` (staging environment build)
- **Lint**: `npm run lint` or `npm run lint:fix` (ESLint with TypeScript)
- **Test**: `npm test` (Jest with React Testing Library)
- **Test single file**: `npm test -- path/to/file.test.ts`
- **Test watch mode**: `npm run test:watch`
- **E2E tests**: `npm run test:e2e` (Cypress)
- **Dev with Firebase**: `npm run dev:firebase` (concurrently runs Firebase emulators + Next.js dev)
- **Deploy Production**: `npm run firebase:deploy:production` (full production deployment)
- **Deploy Staging**: `npm run firebase:deploy:staging` (staging channel deployment)
- **Rollback**: `npm run firebase:rollback` (interactive rollback utility)
- **Emergency Rollback**: `npm run firebase:rollback:emergency` (one-click rollback)
- **Deployment Status**: `npm run deployment:status` (check deployment health)

## Architecture
- **Framework**: Next.js 14 with TypeScript, App Router, PWA support
- **Database**: Firebase Firestore with collections: users, sessions, locations
- **Caching**: Multi-layer caching (Memory → Session → Local → IndexedDB)
- **Images**: Next.js Image optimization with lazy loading and WebP/AVIF support
- **UI**: Radix UI components with Tailwind CSS, shadcn/ui components
- **Auth**: Firebase Auth with cached user data and role-based access
- **Testing**: Jest + React Testing Library (unit), Cypress (e2e)
- **State**: React hooks, cached Firebase data, offline-capable storage
- **Deployment**: GitHub Actions CI/CD with Firebase Hosting multi-environment pipeline
- **Monitoring**: Firebase Analytics, Performance Monitoring, Sentry error tracking

## Performance Optimizations
- **Caching System**: `src/lib/cache/` - Multi-layer Firebase data caching with 70-90% hit rates
- **Image Optimization**: `src/components/ui/optimized-image.tsx` - WebP/AVIF with lazy loading
- **Lazy Loading**: `src/lib/hooks/useLazyLoading.ts` - Intersection Observer-based loading
- **Bundle Optimization**: Code splitting, tree shaking, static asset caching
- **Offline Support**: IndexedDB persistence, service worker caching, PWA features

## Production Environment
- **Configuration**: `.env.production` - Production environment variables
- **Security Rules**: Enhanced Firestore and Storage rules with role-based access
- **Hosting Config**: `firebase.json` - Optimized headers and caching strategies  
- **Monitoring**: Real-time health checks, performance metrics, error tracking
- **Deployment**: Automated scripts with validation, testing, and rollback capabilities

## Key Utilities
- **Cached Services**: 
  - `src/lib/services/cachedUserService.ts` - User operations with caching
  - `src/lib/services/cachedSchoolService.ts` - School/location operations with caching
  - `src/lib/firebase/cachedFirestore.ts` - Cached Firestore wrapper
- **Hooks**:
  - `src/lib/hooks/useCachedAuth.ts` - Enhanced auth with user data caching
  - `src/lib/hooks/useCachedSession.ts` - Session management with real-time sync
  - `src/lib/hooks/useLazyLoading.ts` - Lazy loading with Intersection Observer
- **Image Components**:
  - `OptimizedImage` - Main optimized image component
  - `OptimizedAvatar` - User avatar with fallbacks
  - `LazyImage` - Advanced lazy loading with placeholders

## Code Style
- **Imports**: Use `@/` for src imports, group external/internal imports
- **Components**: PascalCase, functional components with TypeScript
- **Utils**: `cn()` for className merging (clsx + tailwind-merge)
- **Types**: Exported from `src/lib/firebase/types.ts`
- **Error handling**: Try/catch with proper TypeScript error types
- **Naming**: camelCase for variables/functions, SCREAMING_SNAKE_CASE for constants
- **Caching**: Use cached services (`CachedUserService`, `CachedSchoolService`) over direct Firestore
- **Images**: Use `OptimizedImage` or `LazyImage` instead of `<img>` tags
- **Performance**: Prefer cached hooks (`useCachedAuth`, `useCachedSession`) for better performance
