"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import type { IntelPostPayload, SessionPayload } from "@/types/coast-pulse-realtime";
import { REALTIME } from "@/lib/constants/coast-pulse";

interface UseCoastPulseRealtimeOptions {
  nearbyBeachIds: string[];
  onIntelPost: (payload: IntelPostPayload) => void;
  onConditionsChanged: () => void;
  onSessionEvent: (payload: SessionPayload) => void;
}

/**
 * Subscribes to Supabase Realtime channels for Coast Pulse updates.
 *
 * 3 channels:
 * - intel: INSERT on intel_posts (immediate callback)
 * - forecasts: INSERT on enhanced_forecasts (debounced)
 * - sessions: INSERT on sessions (debounced)
 *
 * Uses beach_id Set for O(1) client-side filtering.
 */
export function useCoastPulseRealtime({
  nearbyBeachIds,
  onIntelPost,
  onConditionsChanged,
  onSessionEvent,
}: UseCoastPulseRealtimeOptions) {
  const supabase = useMemo(() => createClient(), []);

  // Callback refs to prevent resubscription when callbacks change
  const onIntelPostRef = useRef(onIntelPost);
  const onConditionsChangedRef = useRef(onConditionsChanged);
  const onSessionEventRef = useRef(onSessionEvent);

  // Debounce timer refs
  const forecastDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onIntelPostRef.current = onIntelPost;
  }, [onIntelPost]);

  useEffect(() => {
    onConditionsChangedRef.current = onConditionsChanged;
  }, [onConditionsChanged]);

  useEffect(() => {
    onSessionEventRef.current = onSessionEvent;
  }, [onSessionEvent]);

  // Stable channel key from sorted beach IDs
  const channelKey = useMemo(() => {
    if (nearbyBeachIds.length === 0) return "";
    const sorted = [...nearbyBeachIds].sort();
    return sorted.join(",").slice(0, 50);
  }, [nearbyBeachIds]);

  useEffect(() => {
    if (!channelKey || nearbyBeachIds.length === 0) return;

    // O(1) lookup set for filtering
    const beachIdSet = new Set(nearbyBeachIds);
    const channels: RealtimeChannel[] = [];
    let isStale = false;

    // Channel 1: Intel posts (immediate)
    const intelChannel = supabase
      .channel(`coast-pulse-intel-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intel_posts",
        },
        (payload: RealtimePostgresInsertPayload<Record<string, any>>) => {
          if (isStale) return;
          const record = payload.new;
          // Filter: must have beach_id in our set, or be geographically nearby (handled by caller)
          if (record.beach_id && !beachIdSet.has(record.beach_id)) return;

          const intelPayload: IntelPostPayload = {
            id: record.id,
            beach_id: record.beach_id,
            user_id: record.user_id,
            description: record.description || "",
            emoji_rating: record.emoji_rating,
            latitude: record.latitude,
            longitude: record.longitude,
            photo_url: record.photo_url,
            surf_conditions: record.surf_conditions,
            confirmations_count: record.confirmations_count || 0,
            created_at: record.created_at,
          };
          onIntelPostRef.current(intelPayload);
        }
      )
      .subscribe();
    channels.push(intelChannel);

    // Channel 2: Forecast/conditions changes (500ms debounce)
    const forecastChannel = supabase
      .channel(`coast-pulse-forecasts-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "enhanced_forecasts",
        },
        (payload: RealtimePostgresInsertPayload<Record<string, any>>) => {
          if (isStale) return;
          const record = payload.new;
          if (record.beach_id && !beachIdSet.has(record.beach_id)) return;

          if (forecastDebounceRef.current) clearTimeout(forecastDebounceRef.current);
          forecastDebounceRef.current = setTimeout(() => {
            if (!isStale) onConditionsChangedRef.current();
            forecastDebounceRef.current = null;
          }, REALTIME.FORECAST_DEBOUNCE_MS);
        }
      )
      .subscribe();
    channels.push(forecastChannel);

    // Channel 3: Sessions (debounced)
    const sessionChannel = supabase
      .channel(`coast-pulse-sessions-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sessions",
        },
        (payload: RealtimePostgresInsertPayload<Record<string, any>>) => {
          if (isStale) return;
          const record = payload.new;
          if (record.beach_id && !beachIdSet.has(record.beach_id)) return;

          if (sessionDebounceRef.current) clearTimeout(sessionDebounceRef.current);
          sessionDebounceRef.current = setTimeout(() => {
            if (isStale) return;
            const sessionPayload: SessionPayload = {
              id: record.id,
              beach_id: record.beach_id,
              beach_name: record.beach_name || null,
              status: record.status || null,
              arrival_time: record.arrival_time || record.created_at,
            };
            onSessionEventRef.current(sessionPayload);
            sessionDebounceRef.current = null;
          }, REALTIME.SESSION_DEBOUNCE_MS);
        }
      )
      .subscribe();
    channels.push(sessionChannel);

    return () => {
      isStale = true;
      if (forecastDebounceRef.current) {
        clearTimeout(forecastDebounceRef.current);
        forecastDebounceRef.current = null;
      }
      if (sessionDebounceRef.current) {
        clearTimeout(sessionDebounceRef.current);
        sessionDebounceRef.current = null;
      }
      // Delayed cleanup to prevent WebSocket race conditions
      setTimeout(() => {
        channels.forEach((channel) => {
          supabase.removeChannel(channel).catch(() => {
            if (process.env.NODE_ENV === "development") {
              console.debug("Coast Pulse channel cleanup completed");
            }
          });
        });
      }, REALTIME.CLEANUP_DELAY_MS);
    };
  }, [supabase, channelKey, nearbyBeachIds]);
}
