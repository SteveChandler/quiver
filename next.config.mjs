import { createRequire } from "node:module";
import withPWA from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";
import { isCacheableForecastApiPath } from "./config/forecast-api-cache-rules.mjs";

const require = createRequire(import.meta.url);

// Validate environment variables at build time
// Note: This validation runs inline instead of importing from a TS file
// to avoid ESM/TypeScript import issues in next.config.mjs
const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  // Required variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is required");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }

  // Optional but recommended
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY not set - admin operations will fail"
    );
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL not set - OAuth redirects may not work correctly"
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn("⚠️  Environment Configuration Warnings:");
    warnings.forEach((w) => console.warn(`   • ${w}`));
  }

  // Handle errors
  if (errors.length > 0) {
    const msg = [
      "❌ Environment Configuration Errors:",
      ...errors.map((e) => `   • ${e}`),
      "",
      "💡 Setup: Copy .env.example to .env.local and fill in your values",
      "   See docs/SUPABASE_SETUP.md for detailed instructions",
    ].join("\n");

    if (process.env.NODE_ENV === "development") {
      throw new Error(msg);
    } else {
      console.error(msg);
    }
  }
};

validateEnvironment();

// Extract Supabase project ID from URL for image patterns
const getSupabaseHostname = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      return url.hostname;
    } catch (error) {
      console.warn("Invalid NEXT_PUBLIC_SUPABASE_URL:", error);
    }
  }
  return null;
};

const supabaseHostname = getSupabaseHostname();

// Determine if we're in production mode for PWA and caching purposes.
// On Vercel, NODE_ENV is always "production" for both preview and production deployments,
// so we use VERCEL_ENV to distinguish between them.
const isProd =
  process.env.VERCEL_ENV === "production" ||
  (process.env.NODE_ENV === "production" && !process.env.VERCEL_ENV);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose VERCEL_ENV to client-side code for PWA/preview detection
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },

  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  // Enable compression for better performance
  compress: true,

  // Empty turbopack config silences the Next.js 16 "webpack config without
  // turbopack config" error when @ducanh2912/next-pwa is wrapping nextConfig
  // but `withSentryConfig` is gated off (Preview deploys). Sentry's wrapper
  // injects its own turbopack config in Production, so this is only
  // load-bearing when the Sentry gate is closed.
  turbopack: {},

  // External packages for server components (moved from experimental)
  serverExternalPackages: ["@supabase/supabase-js", "geo-tz", "firebase-admin"],

  // Power pack optimizations
  poweredByHeader: false, // Remove X-Powered-By header
  reactStrictMode: true, // Better development experience

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "geolocation=(self)",
          },
          // Performance headers
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Security headers that don't impact performance
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      // Aggressive caching for static assets
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            // In dev, prevent cached chunks from causing hydration mismatches during local iteration.
            value: isProd
              ? "public, max-age=31536000, immutable"
              : "no-store, max-age=0",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },
      // Cache optimization for images
      {
        source: "/images/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=3600",
          },
          {
            key: "Vary",
            value: "Accept, Accept-Encoding",
          },
        ],
      },
      // API route caching — default blanket.
      //
      // `private` (not `public`) because many /api/* routes return per-user
      // data (follow status, likedByMe enrichment, friends feed, etc.) and
      // this header applies to ALL matching routes, overriding any route-
      // level Cache-Control the handler sets. Shared caches (CDN, corporate
      // proxy) MUST NOT store these responses or they leak user A's state
      // to user B. Browsers / NSURLCache can still cache within session.
      //
      // Routes that are intentionally public and benefit from shared caches
      // (OG images, forecasts) should set `Cache-Control: public, ...`
      // explicitly — but be aware that header precedence is a Next.js-
      // version-dependent behavior, so prefer moving truly-cacheable routes
      // to a more specific source pattern here if you need CDN caching.
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, max-age=60, stale-while-revalidate=120",
          },
        ],
      },
      {
        source: "/api/forecasts/current",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/api/sessions/public",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/settings",
        destination: "/profile?openSettings=true",
        permanent: false, // 302 for flexibility
      },
    ];
  },

  images: {
    // CRITICAL FIX: Enable image optimization in production
    unoptimized: false,

    // Performance optimizations for images
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 86400, // 24 hours

    // Allow image proxy with query strings (Next.js 16+ requirement)
    localPatterns: [
      {
        pathname: "/api/image-proxy",
      },
      {
        pathname: "/**", // Allow all static images from /public
      },
    ],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "staticmap.openstreetmap.de",
        pathname: "/staticmap.php",
      },
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "maps.geoapify.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "live.staticflickr.com",
        pathname: "/**",
      },
      // Openverse sources (Wikimedia Commons, WordPress, etc.)
      {
        protocol: "https",
        hostname: "api.openverse.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.files.wordpress.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i1.wp.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i2.wp.com",
        pathname: "/**",
      },
      // Camera thumbnails (HDOnTap snapshots + YouTube + Surfline)
      {
        protocol: "https",
        hostname: "storage.hdontap.com",
        pathname: "/wowza_stream_thumbnails/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "camstills.cdn-surfline.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.earthcam.com",
        pathname: "/cams/includes/image.php",
      },
      {
        protocol: "https",
        hostname: "images.squarespace-cdn.com",
        pathname: "/content/v1/5ca78ffcd745624ff5378568/**",
      },
      {
        protocol: "https",
        hostname: "static-1.redstone.net",
        pathname: "/images/cameras/**",
      },
      // Add specific Supabase hostname if available
      ...(supabaseHostname
        ? [
            {
              protocol: "https",
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Fallback patterns for Supabase storage
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
    // Security for SVGs
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    // Enable performance optimizations (removed optimizeCss due to critters dependency)
    optimizePackageImports: [
      "@radix-ui/react-icons",
      "lucide-react",
      "recharts",
      "zod",
      "react-hook-form",
    ],

    // Enable external directory support
    externalDir: true,

    // Server Actions configuration for file uploads
    // Supports 5 photos × 10MB (pre-compression) + FormData overhead
    serverActions: {
      bodySizeLimit: '60mb',
    },
  },

  // Reduce bundle size by rewriting common libs to per-module imports
  modularizeImports: {
    lodash: {
      transform: "lodash/{{member}}",
    },
    "date-fns": {
      transform: "date-fns/{{member}}",
    },
  },

  // Webpack configuration for externals and bundle analyzer
  webpack: (config, { isServer }) => {
    // CRITICAL FIX: Configure externals for @resvg/resvg-js
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push({
        "@resvg/resvg-js": "@resvg/resvg-js",
      });
    }

    // Resolve alias optimizations
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize bundle size
      "react/jsx-runtime.js": "react/jsx-runtime",
    };

    // geo-tz is resolved at runtime via serverExternalPackages
    // (no CopyPlugin needed — saves 69 MB per server compilation)

    // Add bundle analyzer in development
    if (process.env.ANALYZE === "true") {
      config.plugins.push(
        new (require("webpack-bundle-analyzer").BundleAnalyzerPlugin)({
          analyzerMode: "static",
          openAnalyzer: false,
          reportFilename: "bundle-analyzer-report.html",
        })
      );
    }

    return config;
  },

  // Dev server page caching — keep more pages in memory to reduce recompilation
  onDemandEntries: {
    maxInactiveAge: 120 * 1000,
    pagesBufferLength: 10,
  },
};

/**
 * Determines if a beach API path should use StaleWhileRevalidate caching.
 * Only caches public read-only endpoints. Excludes:
 * - Authenticated endpoints (/favorites, /favorite/toggle)
 * - Mutation endpoints
 * - Frequently-changing feeds (/sessions)
 *
 * @param {string} pathname - The URL pathname
 * @returns {boolean} Whether to cache with StaleWhileRevalidate
 */
const isPublicBeachApiPath = (pathname) => {
  if (!pathname.startsWith("/api/beaches")) return false;

  // Exclude authenticated and mutation endpoints
  if (pathname === "/api/beaches/favorites") return false;
  if (pathname.includes("/favorite/toggle")) return false;
  if (pathname.includes("/sessions")) return false;

  // Whitelist safe public GET routes
  const publicPaths = [
    "/api/beaches",
    "/api/beaches/featured",
    "/api/beaches/search",
    "/api/beaches/nearby",
  ];
  if (publicPaths.includes(pathname)) return true;

  // Allow /api/beaches/:id and /api/beaches/:id/sources
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 3) return true;
  if (parts.length === 4 && parts[3] === "sources") return true;

  return false;
};

// Configure PWA with Workbox
const pwaConfig = withPWA({
  dest: "public",
  disable: !isProd,
  // IMPORTANT:
  // Disable next-pwa's auto-registration so runtime code can decide whether
  // to register/unregister based on hostname (e.g. never register on localhost).
  register: false,
  skipWaiting: true,
  // Exclude files that don't exist or shouldn't be precached
  buildExcludes: [
    /app-build-manifest\.json$/,
    /middleware-manifest\.json$/,
    /build-manifest\.json$/,
    /react-loadable-manifest\.json$/,
    /server\/middleware-manifest\.json$/,
  ],
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    // Forecast API - NetworkFirst with 3s timeout (fresh data priority, short cache for offline).
    // Source-backed current conditions can trigger refreshes and must never be cached.
    {
      urlPattern: ({ url }) => isCacheableForecastApiPath(url.pathname),
      handler: "NetworkFirst",
      options: {
        cacheName: "forecast-api",
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 60 * 30, // 30 minutes - respects anti-stale-data policy
        },
      },
    },
    // Beach API (PUBLIC ONLY) - StaleWhileRevalidate for fast back/forward
    {
      urlPattern: ({ url }) => isPublicBeachApiPath(url.pathname),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "beaches-api",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
    // Buoy API - NetworkFirst with short cache
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/api/buoys"),
      handler: "NetworkFirst",
      options: {
        cacheName: "buoy-api",
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 15, // 15 minutes (real-time data)
        },
      },
    },
    // Images - StaleWhileRevalidate (serve fast, update in background)
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
    // Static assets - CacheFirst (immutable assets)
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/_next/static"),
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
  ],
});

// Sentry options — only applied to Production builds.
// Skipping the entire wrap on Preview deployments removes ~19–20s of
// post-compile sourcemap bundling that runs even when dryRun is true.
// See `turbopack: {}` above — required to silence the Next.js 16 webpack
// config warning when this gate is closed.
const sentryOptions = {
  org: "quiver-z4",

  project: "javascript-nextjs",

  // Local builds/dev often don't have SENTRY_AUTH_TOKEN; avoid noisy warnings + uploads.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  dryRun: !process.env.SENTRY_AUTH_TOKEN || process.env.VERCEL_ENV !== "production",

  // Suppress verbose source map listing in build logs (saves ~220 log events on Vercel)
  silent: true,

  // Reduced source map upload for faster builds (set to true for prettier stack traces)
  widenClientFileUpload: false,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Disable automatic middleware instrumentation to reduce bundle size
  autoInstrumentMiddleware: false,

  // Exclude heavy Replay artifacts from the initial bundle
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },

  // Enables automatic instrumentation of Vercel Cron Monitors.
  automaticVercelMonitors: false,
};

export default isProd
  ? withSentryConfig(pwaConfig(nextConfig), sentryOptions)
  : pwaConfig(nextConfig);
