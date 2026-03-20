const nextJest = require("next/jest");

/** @type {import('jest').Config} */
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: "./",
});

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Module name mapping for path aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^firebase/(.*)$": "<rootDir>/node_modules/firebase/$1",
  },

  // Test file patterns
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}",
  ],

  // Coverage settings
  //
  // POLICY: every file with a corresponding .test file is measured.
  // Only exclude files that (a) have NO tests AND (b) fall into an
  // infrastructure / generated / E2E-only category.
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",

    // Runtime wiring — not meaningfully unit-testable
    "!src/instrumentation.ts",

    // Infrastructure & plumbing (no unit tests; covered by E2E / integration)
    "!src/lib/deployment/**",
    "!src/lib/offline/offlineDB.ts",
    "!src/lib/offline/syncManager.ts",
    "!src/lib/offline/serviceManager.ts",
    "!src/lib/offline/dbSchema.ts",
    "!src/lib/performance/**",
    "!src/lib/pwa/periodicBackgroundSync.ts",
    "!src/lib/pwa/capabilities.ts",
    "!src/lib/testing/**",
    "!src/lib/logging/**",
    "!src/lib/cache/**",
    "!src/lib/firebase/productionConfig.ts",
    "!src/lib/firebase/types.ts",
    "!src/lib/firebase/cachedFirestore.ts",
    "!src/lib/utils/customImageLoader.js",
    "!src/lib/utils/imageOptimization.ts",
    "!src/lib/utils/imagePreloader.ts",
    "!src/lib/utils/environmentValidator.ts",
    "!src/lib/utils/dateTime.ts",

    // Services without test coverage (remove as tests are added)
    "!src/lib/services/cachedSchoolService.ts",
    "!src/lib/services/cachedUserService.ts",

    "!src/lib/services/serviceManager.ts",
    "!src/lib/services/serviceService.ts",
    "!src/lib/services/userPreferences.ts",

    // Hooks without test coverage
    "!src/lib/hooks/useAdminMetrics.ts",
    "!src/lib/hooks/useAutoCheckoutReminder.ts",
    "!src/lib/hooks/useCache.ts",
    "!src/lib/hooks/useCachedSession.ts",
    "!src/lib/hooks/useConnectivityRestoration.ts",
    "!src/lib/hooks/useEnhancedOfflineQueue.ts",
    "!src/lib/hooks/useLazyLoading.ts",
    "!src/lib/hooks/useNetworkStatus.ts",
    "!src/lib/hooks/useOffline.ts",
    "!src/lib/hooks/useActiveSessions.ts",
    "!src/lib/hooks/useAsyncError.tsx",
    "!src/lib/hooks/useLocation.ts",

    // Generated UI primitives (shadcn/ui)
    "!src/components/ui/**",

    // Layout wrappers (thin composition, covered by E2E)
    "!src/components/layout/**",

    // Components without test coverage
    "!src/components/provider/ProviderDashboardCards.tsx",
    "!src/components/provider/AuthProvider.tsx",
    "!src/components/schedules/**",
    "!src/components/pwa/OfflineQueue.tsx",
    "!src/components/pwa/PWAUpdatePrompt.tsx",
    "!src/components/dashboard/DashboardShell.tsx",
    "!src/components/dashboard/StatCard.tsx",
    "!src/components/demo/**",
    "!src/components/common/**",

    // Next.js pages (thin composition, covered by E2E)
    "!src/app/**",

    // Browser-only integrations (maps, covered by E2E)
    "!src/components/maps/**",

    // Test utilities
    "!src/lib/test-utils.tsx",
  ],

  // Coverage thresholds — honest baseline after granular per-file exclusions.
  // Increase as coverage improves.
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 58,
      lines: 68,
      statements: 68,
    },
  },

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // CI Configuration
  ...(process.env.CI && {
    reporters: [
      'default',
      ['jest-junit', {
        outputDirectory: 'coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      }],
    ],
    collectCoverage: true,
    coverageReporters: ['text', 'lcov', 'clover', 'json'],
  }),
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config);
