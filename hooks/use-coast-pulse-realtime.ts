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

// Supabase Realtime `in.` filter caps at 100 values (Postgres ANY limit).
const REALTIME_IN_FILTER_MAX = 100;

// Poll enhanced_forecasts changes every 5 minutes instead of realtime.
// Rationale: forecasts update once per cron run (not user-driven), and realtime
// subscriptions for this table consumed 93% of total DB time (REALTIME_OPTIMIZATION_GUIDE.md).
const FORECAST_POLL_MS = 5 * 60 * 1000;

/**
 * Subscribes to Supabase Realtime channels for Coast Pulse updates.
 *
 * 2 channels (previously 3):
 * - intel: INSERT on intel_posts, server-side filtered by beach_id=in.(...)
 * - sessions: INSERT on sessions, server-side filtered by beach_id=in.(...)
 *
 * enhanced_forecasts is intentionally NOT subscribed via realtime.
 * It polls onConditionsChanged every 5 minutes instead.
 * See docs/REALTIME_OPTIMIZATION_GUIDE.md for the DB cost rationale.
 *
 * Filters: Supabase Realtime supports `in.` with up to 100 values.
 * We cap the list at REALTIME_IN_FILTER_MAX; callers should pass nearby IDs only.
 */
export function useCoastPulseRealtime({
  nearbyBeachIds,
  onIntelPost,
  onConditionsChanged,
  onSessionEvent,
}: UseCoastPulseRealtimeOptions) {
  const supabase = useMemo(() => createClient(), []);

  // Callback refs prevent resubscription when callbacks change identity
  const onIntelPostRef = useRef(onIntelPost);
  const onConditionsChangedRef = useRef(onConditionsChanged);
  const onSessionEventRef = useRef(onSessionEvent);

  // Debounce timer ref for session events
  const sessionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // isStale promoted to ref so cleanup reliably gates in-flight async callbacks
  // (a `let` captured in a closure can't be observed by callbacks after re-renders)
  const isStaleRef = useRef(false);

  useEffect(() => {
    onIntelPostRef.current = onIntelPost;
  }, [onIntelPost]);

  useEffect(() => {
    onConditionsChangedRef.current = onConditionsChanged;
  }, [onConditionsChanged]);

  useEffect(() => {
    onSessionEventRef.current = onSessionEvent;
  }, [onSessionEvent]);

  // Stable channel key from sorted, capped beach IDs
  const channelKey = useMemo(() => {
    if (nearbyBeachIds.length === 0) return "";
    const sorted = [...nearbyBeachIds].sort();
    return sorted.join(",").slice(0, 50);
  }, [nearbyBeachIds]);

  // --- 5-minute poll for forecast/conditions changes ---
  // clearInterval is the authoritative cleanup here; no need for isStaleRef guard
  // since the interval itself is torn down on unmount.
  useEffect(() => {
    if (!channelKey || nearbyBeachIds.length === 0) return;

    const interval = setInterval(() => {
      onConditionsChangedRef.current();
    }, FORECAST_POLL_MS);

    return () => {
      clearInterval(interval);
    };
    // channelKey already encodes the full beach-id set; nearbyBeachIds.length
    // can't change without channelKey changing, so the lint hint is wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);

  // --- Realtime channels: intel_posts + sessions ---
  useEffect(() => {
    if (!channelKey || nearbyBeachIds.length === 0) return;

    isStaleRef.current = false;

    // Cap to Supabase's max for in. filter
    const filteredIds = nearbyBeachIds.slice(0, REALTIME_IN_FILTER_MAX);
    const beachFilter = `beach_id=in.(${filteredIds.join(",")})`;

    // Retain a Set for O(1) client-side cross-check (guards non-indexed rows)
    const beachIdSet = new Set(nearbyBeachIds);
    const channels: RealtimeChannel[] = [];

    // Channel 1: Intel posts (immediate callback)
    const intelChannel = supabase
      .channel(`coast-pulse-intel-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "intel_posts",
          filter: beachFilter,
        },
        (payload: RealtimePostgresInsertPayload<Record<string, any>>) => {
          if (isStaleRef.current) return;
          const record = payload.new;
          // Secondary client-side guard for IDs beyond the cap
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

    // Channel 2: Sessions (debounced)
    const sessionChannel = supabase
      .channel(`coast-pulse-sessions-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sessions",
          filter: beachFilter,
        },
        (payload: RealtimePostgresInsertPayload<Record<string, any>>) => {
          if (isStaleRef.current) return;
          const record = payload.new;
          // Secondary client-side guard for IDs beyond the cap
          if (record.beach_id && !beachIdSet.has(record.beach_id)) return;

          if (sessionDebounceRef.current) clearTimeout(sessionDebounceRef.current);
          sessionDebounceRef.current = setTimeout(() => {
            if (isStaleRef.current) return;
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
      isStaleRef.current = true;
      if (sessionDebounceRef.current) {
        clearTimeout(sessionDebounceRef.current);
        sessionDebounceRef.current = null;
      }
      // Remove channels directly — supabase.removeChannel() returns a Promise
      // and is safe to call immediately. The previous setTimeout wrapper caused
      // a cleanup leak: the delay meant channels persisted past component unmount.
      channels.forEach((channel) => {
        supabase.removeChannel(channel).catch(() => {
          // Silently ignore — channel may already be closed by the server
        });
      });
    };
  }, [supabase, channelKey, nearbyBeachIds]);
}
