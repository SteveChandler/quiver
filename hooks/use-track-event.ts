/**
 * useTrackEvent Hook
 *
 * React hook for tracking implicit user events (beach views, discovery interactions, etc.)
 * Uses a fire-and-forget approach with client-side debouncing to prevent overwhelming the API.
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
import * as AuthContext from "@/context/auth-context";
import type { ImplicitEventType, EventMetadata } from "@/types/implicit-preferences";
import { getVisitorId } from "@/lib/utils/visitor-id";
import { captureClientPostHogEvent } from "@/lib/posthog-client";

interface TrackEventOptions {
  /** The beach ID to associate with this event (optional for some event types) */
  beachId?: string;
  /** Event-specific metadata */
  metadata?: EventMetadata;
  /** Time in milliseconds to debounce duplicate events (default: 1000ms) */
  debounceMs?: number;
}

function wasEventRecorded(responseBody: unknown): boolean {
  if (!responseBody || typeof responseBody !== "object") return false;

  const envelope = responseBody as Record<string, unknown>;
  const result =
    envelope.data && typeof envelope.data === "object"
      ? (envelope.data as Record<string, unknown>)
      : envelope;

  if (result.ok !== true) return false;
  if (result.skipped === true) return false;
  return (
    result.status !== "tracking_disabled" &&
    result.status !== "bot_filtered"
  );
}

/**
 * Hook for tracking implicit user events
 *
 * Features:
 * - User or anonymous-session attribution
 * - Client-side debouncing to prevent duplicate events
 * - Fire-and-forget approach (doesn't block UI)
 * - Uses fetch keepalive to survive page navigation
 * - Graceful error handling (tracking failures never break the app)
 */
export function useTrackEvent() {
  const useAuthForTracking =
    AuthContext.useOptionalAuth ?? AuthContext.useAuth;
  const auth = useAuthForTracking();
  const user = auth?.user;
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

        if (!response.ok) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[useTrackEvent] Failed to track ${eventType}: HTTP ${response.status}`
            );
          }
          return;
        }

        const responseBody: unknown = await response.json();
        if (!wasEventRecorded(responseBody)) return;

        captureClientPostHogEvent(eventType, {
          ...(beachId ? { beach_id: beachId } : {}),
          ...metadata,
        });
      } catch (error) {
        // Log errors in development for debugging, but never break the app
        if (process.env.NODE_ENV === "development") {
          console.warn("[useTrackEvent] Tracking error:", error);
        }
      }
    },
    [user?.id]
  );

  return { track };
}
