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
  {
    // Public buoy reading for the native beach screen: no user data, so shared
    // caches may store it. Applies to 404s too, so a beach gains its row within
    // minutes of the catalogue or a station coming online.
    source: "/api/beaches/:id/buoy",
    headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }],
  },
];
