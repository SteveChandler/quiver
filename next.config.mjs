import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable compression for better performance
  compress: true,

  // Performance optimizations
  swcMinify: true,

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
            value: "origin-when-cross-origin",
          },
        ],
      },
      // Aggressive caching for static assets
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
      // API route caching
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=120",
          },
        ],
      },
    ];
  },
  images: {
    // CRITICAL FIX: Enable image optimization in production
    unoptimized: false,

    // Performance optimizations for images
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 86400, // 24 hours

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
    optimizePackageImports: ["@radix-ui/react-icons", "lucide-react"],

    // Enable server components optimizations
    serverComponentsExternalPackages: ["@supabase/supabase-js"],

    // Enable external directory support
    externalDir: true,
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
  webpack: (config) => {
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

  // Add performance budgets
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
