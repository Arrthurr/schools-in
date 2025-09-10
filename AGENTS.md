# AGENTS.md - Development Guide for schools-in

## Commands
- **Build**: `npm run build` (Next.js build)
- **Lint**: `npm run lint` or `npm run lint:fix` (ESLint with TypeScript)
- **Test**: `npm test` (Jest with React Testing Library)
- **Test single file**: `npm test -- path/to/file.test.ts`
- **Test watch mode**: `npm run test:watch`
- **E2E tests**: `npm run test:e2e` (Cypress)
- **Dev with Firebase**: `npm run dev:firebase` (concurrently runs Firebase emulators + Next.js dev)

## Architecture
- **Framework**: Next.js 14 with TypeScript, App Router, PWA support
- **Database**: Firebase Firestore with collections: users, sessions, locations
- **UI**: Radix UI components with Tailwind CSS, shadcn/ui components
- **Auth**: Firebase Auth
- **Testing**: Jest + React Testing Library (unit), Cypress (e2e)
- **State**: React hooks, local storage via IDB for offline support

## Code Style
- **Imports**: Use `@/` for src imports, group external/internal imports
- **Components**: PascalCase, functional components with TypeScript
- **Utils**: `cn()` for className merging (clsx + tailwind-merge)
- **Types**: Exported from `src/lib/firebase/types.ts`
- **Error handling**: Try/catch with proper TypeScript error types
- **Naming**: camelCase for variables/functions, SCREAMING_SNAKE_CASE for constants
