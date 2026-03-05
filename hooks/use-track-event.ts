/**
 * useTrackEvent Hook
 *
 * React hook for tracking implicit user events (beach views, discovery interactions, etc.)
 * Uses a fire-and-forget approach with client-side debouncing to prevent overwhelming the API.
 *
 * @see docs/plans/2026-01-25-implicit-preference-learning-design.md
 *
 * @example
 * ```tsx
 * const { track } = useTrackEvent();
 *
 * // Track a beach view
 * track('beach_view', {
 *   beachId: 'beach-123',
 *   metadata: { duration_ms: 5000, referrer: 'discovery' }
 * });
 *
 * // Track discovery click
 * track('discovery_click', {
 *   beachId: 'beach-456',
 *   metadata: { position: 0, score_shown: 95, alternatives_count: 5 }
 * });
 * ```
 */

"use client";

import { useCallback, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import type { ImplicitEventType, EventMetadata } from "@/types/implicit-preferences";
import { getVisitorId } from "@/lib/utils/visitor-id";

interface TrackEventOptions {
  /** The beach ID to associate with this event (optional for some event types) */
  beachId?: string;
  /** Event-specific metadata */
  metadata?: EventMetadata;
  /** Time in milliseconds to debounce duplicate events (default: 1000ms) */
  debounceMs?: number;
}

/**
 * Hook for tracking implicit user events
 *
 * Features:
 * - Automatic user authentication check (no tracking for guests)
 * - Client-side debouncing to prevent duplicate events
 * - Fire-and-forget approach (doesn't block UI)
 * - Uses fetch keepalive to survive page navigation
 * - Graceful error handling (tracking failures never break the app)
 */
export function useTrackEvent() {
  const { user } = useAuth();
  const lastFired = useRef<Map<string, number>>(new Map());

  const track = useCallback(
    async (
      eventType: ImplicitEventType,
      { beachId, metadata = {}, debounceMs = 1000 }: TrackEventOptions = {}
    ) => {
      // Debounce duplicate events
      const key = `${eventType}-${beachId ?? "no-beach"}`;
      const now = Date.now();
      const lastTime = lastFired.current.get(key) ?? 0;

      if (now - lastTime < debounceMs) return;
      lastFired.current.set(key, now);

      // Fire and forget - don't block UI
      try {
        const response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            beachId,
            metadata,
            viewportWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
            ...(user?.id ? {} : { sessionId: getVisitorId() }),
          }),
          keepalive: true, // Survives page navigation
        });

        // Log non-OK responses in development for debugging
        if (!response.ok && process.env.NODE_ENV === "development") {
          console.warn(
            `[useTrackEvent] Failed to track ${eventType}: HTTP ${response.status}`
          );
        }
      } catch (error) {
        // Log errors in development for debugging, but never break the app
        if (process.env.NODE_ENV === "development") {
          console.warn("[useTrackEvent] Network error:", error);
        }
      }
    },
    [user?.id]
  );

  return { track };
}
