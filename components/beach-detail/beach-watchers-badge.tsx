"use client";

import { useCallback, useMemo } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  STICKER_PILL_BASE,
  STICKER_ROTATIONS,
} from "@/lib/ui/sticker-pill";

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
    // Past-tense copy. The underlying query counts distinct viewers
    // over the last 7 days — some of those sessions ended days ago, so
    // "watching" (present-continuous) would fib liveness. A compact
    // past-tense tally with an explicit window reads as honest social
    // proof and matches Quiver's "data is sacred" brand stance.
    return `${watchers} surfers · last 7 days`;
  }, [watchers, minThreshold]);

  if (error || (!loading && !label)) return null;

  // Reserve space during fetch so the attribution cluster doesn't pop
  // in when the count lands. Same size + shape as the rendered pill,
  // just zero opacity — no CLS, no flicker.
  if (loading) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          STICKER_PILL_BASE,
          STICKER_ROTATIONS.watchers,
          "opacity-0 select-none transition-opacity duration-200",
          // Override the base text color so the placeholder doesn't
          // leak the Charming Orange under any screen reader that
          // inspects computed styles.
          "[&]:text-transparent [&]:border-transparent",
          className
        )}
      >
        <Eye className="h-3 w-3 opacity-0" aria-hidden="true" />
        <span>000 surfers · last 7 days</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        STICKER_PILL_BASE,
        STICKER_ROTATIONS.watchers,
        "transition-opacity duration-200",
        className
      )}
      data-testid="beach-watchers-badge"
      aria-label={label!}
    >
      <Eye className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
