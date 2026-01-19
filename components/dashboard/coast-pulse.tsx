"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Activity,
  Wind,
  Waves,
  MapPin,
  Radio,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Camera,
  Thermometer,
  Droplets,
  Plus,
  MoreVertical,
  Flag,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/utils/time-formatters";
import { QuickCheckinSheet } from "../intel/quick-checkin-sheet";
import { PhotoModal } from "../intel/photo-modal";
import { EmojiRatingDisplay } from "../intel/emoji-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { IntelEmojiRating } from "@/types/database";

/**
 * Source type for Coast Pulse items
 */
type SourceType = "local" | "cdip" | "ndbc" | "forecast" | "intel" | "wind" | "tide";

/**
 * Coast Pulse item from API
 */
interface CoastPulseItem {
  id: string;
  source: {
    name: string;
    type: SourceType;
    credibility: number;
  };
  message: string;
  timestamp: string;
  location?: {
    lat: number;
    lon: number;
    distanceKm: number;
  };
  trend?: "up" | "down" | "stable";
  photoUrl?: string;
  emoji_rating?: IntelEmojiRating;
}

/**
 * Summary data from API
 */
interface CoastPulseSummary {
  waveHeight: string | null;
  windSpeed: string | null;
  tideHeight: string | null;
  waterTemp: string | null;
  trend: "improving" | "stable" | "declining" | null;
  lastUpdated: string;
}

/**
 * API response structure
 */
interface CoastPulseResponse {
  success: boolean;
  data: {
    items: CoastPulseItem[];
    summary: CoastPulseSummary;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

/**
 * Source badge configuration
 */
const SOURCE_CONFIG: Record<
  SourceType,
  { label: string; colorClass: string; icon: React.ReactNode }
> = {
  local: {
    label: "LOCAL",
    colorClass: "text-green-400 bg-green-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  cdip: {
    label: "CDIP",
    colorClass: "text-blue-400 bg-blue-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  ndbc: {
    label: "NOAA",
    colorClass: "text-cyan-400 bg-cyan-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
  forecast: {
    label: "FCST",
    colorClass: "text-purple-400 bg-purple-400/10",
    icon: <MapPin className="h-3 w-3" />,
  },
  intel: {
    label: "USER",
    colorClass: "text-orange-400 bg-orange-400/10",
    icon: <Radio className="h-3 w-3" />,
  },
  wind: {
    label: "WIND",
    colorClass: "text-sky-400 bg-sky-400/10",
    icon: <Wind className="h-3 w-3" />,
  },
  tide: {
    label: "TIDE",
    colorClass: "text-teal-400 bg-teal-400/10",
    icon: <Waves className="h-3 w-3" />,
  },
};

/**
 * Get trend icon component
 */
function getTrendIcon(trend?: "up" | "down" | "stable") {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-3 w-3 text-green-400" />;
    case "down":
      return <TrendingDown className="h-3 w-3 text-red-400" />;
    default:
      return <Minus className="h-3 w-3 text-gray-400" />;
  }
}

/**
 * Get summary trend indicator
 */
function getSummaryTrendIndicator(
  trend: "improving" | "stable" | "declining" | null
) {
  if (!trend) return null;

  switch (trend) {
    case "improving":
      return (
        <span className="flex items-center gap-0.5 text-green-400">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
      );
    case "declining":
      return (
        <span className="flex items-center gap-0.5 text-red-400">
          <TrendingDown className="h-3.5 w-3.5" />
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-0.5 text-gray-400">
          <Minus className="h-3.5 w-3.5" />
        </span>
      );
  }
}

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

  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Ref for intersection observer sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

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
        ? `/api/coast-pulse?lat=${lat}&lon=${lon}&limit=8&before=${encodeURIComponent(cursor)}`
        : `/api/coast-pulse?lat=${lat}&lon=${lon}&limit=8`;

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
      } else {
        // Replace items (first page or refresh)
        setItems(json.data.items || []);
        setSummary(json.data.summary || null);
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

  // Fetch initial data and reset state on location change
  useEffect(() => {
    if (lat != null && lon != null) {
      // Reset pagination state on location change
      setItems([]);
      setSummary(null);
      setHasMore(true);
      setNextCursor(null);
      setLoadMoreError(false);
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]); // fetchData intentionally excluded to prevent double fetch

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
        rootMargin: "200px", // Trigger 200px before reaching bottom
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

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

  // Don't render if no coordinates provided
  if (lat == null || lon == null) {
    return null;
  }

  return (
    <div
      className="bg-[#1e1e1e] rounded-2xl p-4 space-y-4"
      data-testid="coast-pulse-section"
    >
      {/* Header with Live indicator and Add button */}
      <div className="flex items-center justify-between">
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
      {!loading && !error && summary && (summary.waveHeight || summary.windSpeed || summary.tideHeight || summary.waterTemp) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 bg-[#2a2a2a] rounded-lg px-3 py-2">
          {summary.waveHeight && (
            <span className="flex items-center gap-1">
              <Waves className="h-3.5 w-3.5 text-blue-400" />
              {summary.waveHeight}
            </span>
          )}
          {summary.windSpeed && (
            <span className="flex items-center gap-1">
              <Wind className="h-3.5 w-3.5 text-cyan-400" />
              {summary.windSpeed}
            </span>
          )}
          {summary.tideHeight && (
            <span className="flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-teal-400" />
              {summary.tideHeight}
            </span>
          )}
          {summary.waterTemp && (
            <span className="flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5 text-orange-400" />
              {summary.waterTemp}
            </span>
          )}
          {getSummaryTrendIndicator(summary.trend)}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="relative pl-6" role="list">
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
        <div className="flex flex-col items-center justify-center py-6 gap-3">
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
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-sm text-gray-400">No nearby data available</p>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && items.length > 0 && (
        <div className="relative pl-6" role="list">
          {/* Orange vertical line */}
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-[#f97316]" />

          {items.map((item) => {
            const config = SOURCE_CONFIG[item.source.type] || SOURCE_CONFIG.local;

            return (
              <div
                key={item.id}
                className="relative pb-4 last:pb-0 animate-in fade-in duration-300"
              >
                {/* Timeline dot */}
                <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#f97316] border-[3px] border-[#1e1e1e]" />

                {/* Content */}
                <div className="space-y-1">
                  {/* Source line with badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.colorClass}`}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                    <p className="text-xs font-medium text-gray-400 truncate max-w-[180px]">
                      {item.source.name}
                    </p>

                    {/* Overflow menu for intel items */}
                    {item.source.type === "intel" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="ml-auto p-1 hover:bg-white/10 rounded">
                            <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#2a2a2a] border-white/10">
                          <DropdownMenuItem
                            onClick={() => handleReport(item.id.replace("intel-", ""))}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Flag className="w-3.5 h-3.5 mr-2" />
                            Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Message with emoji rating if present */}
                  <div className="flex items-start gap-2">
                    {item.emoji_rating && (
                      <EmojiRatingDisplay rating={item.emoji_rating} />
                    )}
                    <p className="text-sm text-white leading-snug flex-1">
                      {item.message}
                    </p>
                    {item.trend && getTrendIcon(item.trend)}
                  </div>

                  {/* Photo thumbnail */}
                  {item.photoUrl && (
                    <button
                      onClick={() => setPhotoModal({ open: true, url: item.photoUrl!, caption: item.message })}
                      className="mt-2 relative w-12 h-12"
                    >
                      <Image
                        src={item.photoUrl}
                        alt="Intel photo"
                        fill
                        className="rounded-lg object-cover hover:opacity-80 transition-opacity"
                        sizes="48px"
                      />
                    </button>
                  )}

                  {/* Timestamp and distance */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{formatTimeAgo(new Date(item.timestamp))}</span>
                    {item.location && item.location.distanceKm > 0 && (
                      <>
                        <span>·</span>
                        <span>{Math.round(item.location.distanceKm * 0.621371)} mi away</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel and loading states */}
      {!loading && !error && items.length > 0 && (
        <>
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

          {/* End of feed message */}
          {!hasMore && !loadingMore && (
            <p className="text-center text-xs text-gray-500 py-4">
              You&apos;ve reached the beginning
            </p>
          )}

          {/* Invisible sentinel for intersection observer */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />
        </>
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
