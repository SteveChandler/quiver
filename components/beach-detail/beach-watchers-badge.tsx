"use client";

import { useCallback, useMemo } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface BeachWatchersBadgeProps {
  beachId: string;
  /** Minimum watcher count required to render. Defaults to 5 — avoids
   *  "1 surfer watching" sadness and short-tail noise on rarely-viewed
   *  beaches. */
  minThreshold?: number;
  className?: string;
}

interface ViewCountResponse {
  watchers: number;
}

/**
 * Social-proof badge showing "{n} surfers watching this week" on beach
 * detail pages. Renders only when the 7d distinct-viewer count clears
 * `minThreshold`. Silent-fail on fetch error — the badge is an
 * enhancement, not a load-bearing element.
 *
 * Data source: `/api/beaches/[id]/view-count` (GET, anonymous-accessible,
 * 5min edge cache). Uses `useDataFetcher` with a stable cacheKey so a
 * single SSR-hydrate + client-fetch pair covers both the hero mount and
 * any re-render.
 *
 * Plan: abstract-exploring-phoenix (Commit C).
 */
export function BeachWatchersBadge({
  beachId,
  minThreshold = 5,
  className,
}: BeachWatchersBadgeProps) {
  const fetchViewCount = useCallback(async () => {
    const res = await fetch(`/api/beaches/${beachId}/view-count`);
    if (!res.ok) throw new Error(`view-count ${res.status}`);
    return (await res.json()) as ViewCountResponse;
  }, [beachId]);

  const { data, loading, error } = useDataFetcher<ViewCountResponse>(
    fetchViewCount,
    {
      cacheKey: `beach-view-count:${beachId}`,
      cacheTTL: 5 * 60 * 1000, // 5 min — match server-side Cache-Control
    }
  );

  const watchers = data?.watchers ?? 0;

  const label = useMemo(() => {
    if (watchers < minThreshold) return null;
    // Intentionally no exact-count precision — "47 surfers" feels honest,
    // whereas "47.3 surfers" or "47/week" would read as engineering noise.
    return `${watchers} surfers watching this week`;
  }, [watchers, minThreshold]);

  if (loading || error || !label) return null;

  return (
    <span
      className={cn(
        // Sticker aesthetic: slight rotation, asymmetric corners,
        // Charming Orange copy on a subtle muted pill.
        "inline-flex items-center gap-1 px-2 py-0.5",
        "rounded-[6px_4px_6px_4px]",
        "bg-[#F78E42]/10 border border-[#F78E42]/25",
        "text-[11px] font-medium text-[#F78E42]",
        "rotate-[-1deg]",
        "whitespace-nowrap",
        className
      )}
      data-testid="beach-watchers-badge"
      aria-label={label}
    >
      <Eye className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
