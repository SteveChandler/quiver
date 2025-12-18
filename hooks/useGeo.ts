"use client";

/**
 * @deprecated Prefer `useGeolocation` from `hooks/use-geolocation.ts`.
 *
 * This is a thin compatibility wrapper so existing imports don't break.
 * It intentionally does NOT auto-request location on mount (Home screen behavior).
 */
import { useGeolocation } from "@/hooks/use-geolocation";

export function useGeo() {
  return useGeolocation({ autoRequest: false });
}

