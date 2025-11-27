/** @type {import('next').NextConfig} */
const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
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
    unoptimized: true, // Must be true for static export

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

module.exports = withBundleAnalyzer(withSerwist(nextConfig));
