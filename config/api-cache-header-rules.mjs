export const EXPERIMENT_API_CACHE_CONTROL = "private, no-store, no-cache, must-revalidate";

// Ordered as Next applies them: the final matching Cache-Control header wins.
export const apiCacheHeaderRules = [
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
    source: "/api/v1/experiments/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: EXPERIMENT_API_CACHE_CONTROL,
      },
    ],
  },
];
