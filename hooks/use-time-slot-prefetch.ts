"use client";

import type { TimeSlot } from "@/types/personalization";

interface UseTimeSlotPrefetchOptions {
  userLocation?: { lat: number; lon: number };
  radiusMiles?: number;
  horizonHours?: number;
  maxResults?: number;
  currentSlot: TimeSlot;
  enabled?: boolean;
}

/**
 * Compatibility no-op. Discovery recommendations must always come from a
 * fresh policy-gated response, so the former background recommendation
 * prefetch and localStorage persistence are intentionally disabled.
 */
export function useTimeSlotPrefetch(
  options: UseTimeSlotPrefetchOptions,
): void {
  void options;
}
