"use client";

import { BeachWatchersBadge } from "@/components/beach-detail/beach-watchers-badge";
import { ShareBeachPill } from "@/components/beach-detail/share-beach-pill";
import { cn } from "@/lib/utils";

interface BeachAttributionClusterProps {
  beachId: string;
  beachSlug: string | null;
  beachName: string;
  className?: string;
}

/**
 * Social-attribution cluster rendered directly below the beach name.
 * Pairs the watchers badge (social proof) with the share pill (virality
 * affordance) as a matched sticker set. Opposite rotations convey
 * "peeled onto the surface, not styled as a button group."
 *
 * Why a cluster component: the watchers badge previously lived inline
 * in the metadata row (rating · break · location · watchers) which
 * overcrowded the line, and the share surface lived orphaned in
 * `beach-actions.tsx` above the primary action row. Colocating them
 * below the title creates a compact attribution block the eye can
 * dismiss in one glance if it doesn't care, or lean into if it does.
 *
 * When the watchers count is below threshold, the badge returns null
 * and the share pill stands alone — the cluster still renders because
 * share is unconditional. If `beachSlug` is missing (legacy beach
 * rows without a slug), the share pill is omitted.
 *
 * Plan: abstract-exploring-phoenix (Commit D, D2).
 */
export function BeachAttributionCluster({
  beachId,
  beachSlug,
  beachName,
  className,
}: BeachAttributionClusterProps) {
  // When the page has neither a slug (share disabled) nor a meaningful
  // watcher count (watchers badge will hide itself), render nothing.
  // We don't know the watchers count synchronously here — the badge
  // manages its own threshold — so the cluster always renders the
  // badge during its loading/fetch, and relies on the badge's own
  // null-return for low-count beaches.
  if (!beachSlug) {
    // No slug → no share. The watchers badge alone doesn't need an
    // attribution cluster wrapper.
    return (
      <div className={cn("flex items-center gap-2", className)} data-testid="beach-attribution-cluster">
        <BeachWatchersBadge beachId={beachId} />
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid="beach-attribution-cluster"
    >
      <BeachWatchersBadge beachId={beachId} />
      <ShareBeachPill beachSlug={beachSlug} beachName={beachName} />
    </div>
  );
}
