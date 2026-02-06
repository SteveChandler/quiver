"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  RefreshCw,
  Plus,
} from "lucide-react";
import { WaveBackground } from "@/components/ui/wave-background";
// import { ParticleBackground } from "@/components/ui/particle-background"; // Kept for easy rollback
import { QuickCheckinSheet } from "../intel/quick-checkin-sheet";
import { PhotoModal } from "../intel/photo-modal";
import { useCoastPulseRealtime } from "@/hooks/use-coast-pulse-realtime";
import type { IntelPostPayload, SessionPayload } from "@/types/coast-pulse-realtime";
import { toast } from "sonner";
import type { IntelEmojiRating } from "@/types/database";
import { CACHE, PAGINATION, REALTIME, OBSERVER } from "@/lib/constants/coast-pulse";
import { CoastPulseTimelineItem } from "./coast-pulse/CoastPulseTimelineItem";
import { CoastPulseSummaryBar } from "./coast-pulse/CoastPulseSummaryBar";
import type { CoastPulseItem, CoastPulseSummary, CoastPulseResponse } from "./coast-pulse/types";

interface CoastPulseProps {
  /** Latitude for fetching nearby data */
  lat?: number;
  /** Longitude for fetching nearby data */
  lon?: number;
}

/**
 * CoastPulse - Aggregated live coast updates from multiple sources
 *
 * Displays real-time updates from local buoys, CDIP, NDBC, forecasts,
 * and user intel in a timeline format with source badges.
 *
 * @example
 * ```tsx
 * <CoastPulse lat={32.75} lon={-117.25} />
 * ```
 */
export function CoastPulse({ lat, lon }: CoastPulseProps) {
  const [items, setItems] = useState<CoastPulseItem[]>([]);
  const [summary, setSummary] = useState<CoastPulseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ open: boolean; url: string; caption?: string } | null>(null);

  // Visibility state for lazy loading - defer API calls until near viewport
  const [isVisible, setIsVisible] = useState(false);
  const visibilityRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [hasPaginated, setHasPaginated] = useState(false); // Track if user has loaded additional pages

  // Realtime state
  const [nearbyBeachIds, setNearbyBeachIds] = useState<string[]>([]);
  const [pendingIntelIds, setPendingIntelIds] = useState<string[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isAtTopRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ref for intersection observer sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to detect when component is near viewport
  useEffect(() => {
    const element = visibilityRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: OBSERVER.VISIBILITY_MARGIN }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fetchData = useCallback(async (cursor?: string) => {
    if (lat == null || lon == null) return;

    // Validate coordinates before API call
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.warn("CoastPulse: Invalid coordinates", { lat, lon });
      setError(true);
      setLoading(false);
      return;
    }

    // Set appropriate loading state
    if (cursor) {
      setLoadingMore(true);
      setLoadMoreError(false);
    } else {
      setLoading(true);
      setError(false);
    }

    try {
      const url = cursor
        ? `/api/coast-pulse?lat=${lat}&lon=${lon}&limit=${PAGINATION.DEFAULT_LIMIT}&before=${encodeURIComponent(cursor)}`
        : `/api/coast-pulse?lat=${lat}&lon=${lon}&limit=${PAGINATION.DEFAULT_LIMIT}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const json: CoastPulseResponse = await response.json();

      if (!json.success || !json.data) {
        throw new Error("Invalid response");
      }

      if (cursor) {
        // Append new items
        setItems(prev => [...prev, ...(json.data.items || [])]);
        setHasPaginated(true); // Mark that user has loaded additional pages
      } else {
        // Replace items (first page or refresh)
        setItems(json.data.items || []);
        setSummary(json.data.summary || null);

        // Capture nearbyBeachIds for realtime subscriptions
        if (json.data.nearbyBeachIds?.length) {
          setNearbyBeachIds(json.data.nearbyBeachIds);
        }

        // Populate seenIds for deduplication
        const newSeen = new Set<string>();
        for (const item of json.data.items || []) {
          newSeen.add(item.id);
        }
        seenIdsRef.current = newSeen;
        setPendingIntelIds([]);
      }

      setHasMore(json.data.hasMore ?? false);
      setNextCursor(json.data.nextCursor ?? null);
    } catch (err) {
      console.error("Failed to fetch coast pulse data:", err);
      if (!cursor) {
        setError(true);
      } else {
        // Load more error - show retry option
        setLoadMoreError(true);
      }
      // On load more error, keep existing items
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lat, lon]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    fetchData(nextCursor);
  }, [fetchData, loadingMore, hasMore, nextCursor]);

  // Fetch initial data and reset state on location change (only when visible)
  useEffect(() => {
    if (lat != null && lon != null && isVisible) {
      // Reset pagination state on location change
      setItems([]);
      setSummary(null);
      setHasMore(true);
      setNextCursor(null);
      setLoadMoreError(false);
      setHasPaginated(false);
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, isVisible]); // fetchData intentionally excluded to prevent double fetch

  // Live polling - refresh data periodically (only when visible)
  useEffect(() => {
    if (lat == null || lon == null || !isVisible) return;

    const intervalId = setInterval(() => {
      // Only refresh first page (don't reset pagination state)
      // This keeps user's scroll position while updating with new data
      fetchData();
    }, CACHE.CLIENT_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, isVisible]); // fetchData intentionally excluded to prevent re-creating interval

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      {
        rootMargin: OBSERVER.INFINITE_SCROLL_MARGIN,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  // Scroll listener to detect if user is at top
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isAtTopRef.current = container.scrollTop < REALTIME.SCROLL_TOP_THRESHOLD_PX;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Realtime callbacks
  const handleRealtimeIntel = useCallback((payload: IntelPostPayload) => {
    const itemId = `intel-${payload.id}`;
    if (seenIdsRef.current.has(itemId)) return;
    seenIdsRef.current.add(itemId);

    const newItem: CoastPulseItem = {
      id: itemId,
      source: {
        name: "Surfer",
        type: "intel",
        credibility: 50, // Base credibility, actual value computed by API
      },
      message: payload.description || "New check-in",
      timestamp: payload.created_at,
      location: payload.latitude && payload.longitude
        ? { lat: payload.latitude, lon: payload.longitude, distanceKm: 0 }
        : undefined,
      photoUrl: payload.photo_url || undefined,
      emoji_rating: (payload.emoji_rating as IntelEmojiRating) || undefined,
    };

    if (isAtTopRef.current) {
      // User is at top - prepend immediately
      setItems(prev => [newItem, ...prev]);
    } else {
      // User has scrolled down - show "New posts" pill
      setPendingIntelIds(prev => [...prev, itemId]);
    }
  }, []);

  const handleConditionsChanged = useCallback(() => {
    if (lat == null || lon == null) return;
    // Fetch lightweight summary endpoint
    fetch(`/api/coast-pulse/summary?lat=${lat}&lon=${lon}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.summary) {
          setSummary(json.summary);
        }
      })
      .catch(() => { /* silently fail, polling will catch up */ });
  }, [lat, lon]);

  const handleSessionEvent = useCallback((payload: SessionPayload) => {
    const beachName = payload.beach_name || "a nearby beach";
    toast(`Someone checked in at ${beachName}`);
  }, []);

  // Realtime subscriptions
  useCoastPulseRealtime({
    nearbyBeachIds,
    onIntelPost: handleRealtimeIntel,
    onConditionsChanged: handleConditionsChanged,
    onSessionEvent: handleSessionEvent,
  });

  // Handle "New posts" pill click - scroll to top and prepend pending items
  const handleNewPostsPillClick = useCallback(() => {
    setPendingIntelIds([]);
    fetchData(); // Refetch first page to get all new posts
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchData]);

  const handleReport = useCallback(async (postId: string) => {
    try {
      const response = await fetch(`/api/intel/${postId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Inappropriate content" }),
      });

      if (response.ok) {
        toast.success("Report submitted. Thank you!");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to report");
      }
    } catch {
      toast.error("Failed to report post");
    }
  }, []);

  const handlePhotoClick = useCallback((url: string, caption?: string) => {
    setPhotoModal({ open: true, url, caption });
  }, []);

  // Don't render if no coordinates provided
  if (lat == null || lon == null) {
    return null;
  }

  return (
    <div
      ref={(node) => {
        // Both refs need the same element:
        // - containerRef: for scroll position detection (realtime updates)
        // - visibilityRef: for IntersectionObserver (lazy loading)
        containerRef.current = node;
        visibilityRef.current = node;
      }}
      className="relative bg-[#1e1e1e] rounded-2xl p-4 space-y-4 overflow-hidden"
      data-testid="coast-pulse-section"
    >
      {/* Ambient wave background */}
      <WaveBackground
        layerCount={3}
        color="white"
        maxOpacity={0.15}
        speed={1}
      />

      {/* Header with Live indicator and Add button */}
      <div className="relative z-10 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Activity className="text-[#f97316]" size={16} />
          Live Coast Pulse
        </h3>
        <div className="flex items-center gap-2">
          {/* Add Check-in Button */}
          <button
            onClick={() => setCheckinOpen(true)}
            className="w-7 h-7 rounded-full bg-[#f97316] hover:bg-[#ea580c] flex items-center justify-center transition-colors"
            aria-label="Add check-in"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
          {/* Live Indicator */}
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
              Live
            </span>
          </span>
        </div>
      </div>

      {/* Summary Section */}
      {!loading && !error && summary && (
        <CoastPulseSummaryBar summary={summary} />
      )}

      {/* New posts pill */}
      {pendingIntelIds.length > 0 && (
        <div className="relative z-10 flex justify-center">
          <button
            onClick={handleNewPostsPillClick}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#f97316] rounded-full hover:bg-[#ea580c] transition-colors shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
          >
            {pendingIntelIds.length} new {pendingIntelIds.length === 1 ? "post" : "posts"}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="relative z-10 pl-6" role="list">
          {/* Orange vertical line */}
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-[#f97316]" />

          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative pb-4 last:pb-0 animate-pulse">
              {/* Timeline dot */}
              <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#f97316] border-[3px] border-[#1e1e1e]" />

              {/* Skeleton content */}
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-gray-700 rounded" />
                <div className="h-4 w-40 bg-gray-700 rounded" />
                <div className="h-2.5 w-16 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="relative z-10 flex flex-col items-center justify-center py-6 gap-3">
          <p className="text-sm text-gray-400">Unable to load coast data</p>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#f97316] rounded-full hover:bg-[#ea580c] transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="relative z-10 flex flex-col items-center justify-center py-6">
          <p className="text-sm text-gray-400">No nearby data available</p>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && items.length > 0 && (
        <div className="relative z-10 pl-6" role="list">
          {/* Orange vertical line */}
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-[#f97316]" />

          {items.map((item) => (
            <CoastPulseTimelineItem
              key={item.id}
              item={item}
              onReport={handleReport}
              onPhotoClick={handlePhotoClick}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel and loading states */}
      {!loading && !error && items.length > 0 && (
        <div className="relative z-10">
          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce" />
              </div>
            </div>
          )}

          {/* Load more error with retry button */}
          {loadMoreError && !loadingMore && (
            <div className="flex flex-col items-center py-4 gap-2">
              <p className="text-xs text-gray-500">Failed to load more</p>
              <button
                onClick={loadMore}
                className="text-xs text-[#f97316] font-medium px-3 py-1 rounded-full border border-[#f97316] hover:bg-[#f97316]/10 transition-colors"
              >
                Tap to retry
              </button>
            </div>
          )}

          {/* End of feed message - only show after user has scrolled to load more */}
          {!hasMore && !loadingMore && hasPaginated && (
            <p className="text-center text-xs text-gray-500 py-4">
              No older updates
            </p>
          )}

          {/* Invisible sentinel for intersection observer */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />
        </div>
      )}

      {/* Quick Check-in Sheet */}
      <QuickCheckinSheet
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        onSuccess={fetchData}
      />

      {/* Photo Modal */}
      {photoModal && (
        <PhotoModal
          open={photoModal.open}
          onOpenChange={(open) => setPhotoModal(open ? photoModal : null)}
          photoUrl={photoModal.url}
          caption={photoModal.caption}
        />
      )}
    </div>
  );
}

export default CoastPulse;
