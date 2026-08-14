"use client";

import { useCallback, useMemo } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { suppressSmallActivitySignals } from "@/lib/analytics/real-activity-signals";
import {
  STICKER_PILL_BASE,
  STICKER_ROTATIONS,
} from "@/lib/ui/sticker-pill";

interface BeachWatchersBadgeProps {
  beachId: string;
  /** Minimum signal count required to render. Defaults to 5 — avoids
   *  "1 surfer checked this spot" sadness on rarely-viewed beaches
   *  while still surfacing social proof on the long tail. */
  minThreshold?: number;
  className?: string;
}

interface ViewCountResponse {
  watchers: number;
  recentChecks: number;
  loggedSessions: number;
}

/**
 * Aggregate activity signals on beach detail pages. Each signal is rendered
 * only when its measured count clears `minThreshold`.
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

  const visible = suppressSmallActivitySignals({
    watchers: data?.watchers ?? 0,
    recentChecks: data?.recentChecks ?? 0,
    loggedSessions: data?.loggedSessions ?? 0,
  }, minThreshold);

  const label = useMemo(() => {
    const labels: string[] = [];
    if (visible.watchers !== null) labels.push(`${visible.watchers} surfers are watching this spot`);
    if (visible.recentChecks !== null) labels.push(`checked ${visible.recentChecks} times this week`);
    if (visible.loggedSessions !== null) labels.push(`${visible.loggedSessions} sessions logged this month`);
    return labels.length > 0 ? labels.join(" · ") : null;
  }, [visible.loggedSessions, visible.recentChecks, visible.watchers]);

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
        <span>000 surfers are watching this spot</span>
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
