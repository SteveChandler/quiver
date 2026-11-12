export const EXPERIMENT_API_CACHE_CONTROL = "private, no-store, no-cache, must-revalidate";

// Ordered as Next applies them: the final matching Cache-Control header wins.
export const apiCacheHeaderRules = [
  {
    // Camera, image and native minimum-version routes set response-specific cache controls.
    source: "/api/((?!cam-resolve(?:/|$)|hls-proxy(?:/|$)|image-proxy(?:/|$)|beaches/[^/]+/sources(?:/|$)|v1/app/minimum-version(?:/|$)).*)",
    headers: [
      {
        key: "Cache-Control",
        value: "private, max-age=60, stale-while-revalidate=120",
      },
    ],
  },
  {
    source: "/api/cancellation-feedback",
    headers: [{ key: "Cache-Control", value: EXPERIMENT_API_CACHE_CONTROL }],
  },
  {
    source: "/api/v1/experiments/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: EXPERIMENT_API_CACHE_CONTROL,
      },
    ],
  },
];
