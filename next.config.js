const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-stylesheets",
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/firebaseapp\.com/,
      handler: "NetworkFirst",
      options: {
        cacheName: "firebase-api",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
    {
      urlPattern: /\/api\//,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
    // Image caching
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // Avatar and profile images
    {
      urlPattern: /^https:\/\/.*\.googleusercontent\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "google-profile-images",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
        },
      },
    },
    // Firebase Storage images
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com/,
      handler: "CacheFirst",
      options: {
        cacheName: "firebase-images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ],
  disable: process.env.NODE_ENV === "development",
});

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig = {
  experimental: {
    typedRoutes: true,
  },

  // Disable type checking for build
  typescript: {
    ignoreBuildErrors: true,
  },

  // Force dynamic rendering for problematic pages
  staticPageGenerationTimeout: 1000,

  // Firebase Hosting configuration: attempt static export for marketing/root pages only
  // We'll still try an export build; problematic auth-protected routes will be marked dynamic.
  output: "export",
  trailingSlash: true,
  images: {
    // Enable optimization in development, disable for static export in production
    unoptimized: false, // Keep optimization on

    // Image formats supported
    formats: ["image/webp", "image/avif"],

    // Allowed domains for external images
    domains: [
      "firebaseapp.com",
      "firebaseusercontent.com",
      "googleapis.com",
      "googleusercontent.com",
    ],

    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for responsive images
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Loader configuration
    loader: "default", // Use default loader
    loaderFile: undefined,

    // Minimize layout shift
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Performance optimizations
  swcMinify: true,
};

module.exports = withSentryConfig(
  withBundleAnalyzer(withPWA(nextConfig)),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,
    org: "your-org-slug",
    project: "your-project-slug",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  }
);
