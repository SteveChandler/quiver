"use client";

import { useState, useMemo } from "react";
import { Share2 } from "lucide-react";
import { ShareSheet } from "@/components/share/share-sheet";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  STICKER_PILL_BASE,
  STICKER_PILL_INTERACTIVE,
  STICKER_ROTATIONS,
} from "@/lib/ui/sticker-pill";

interface ShareBeachPillProps {
  beachSlug: string;
  beachName: string;
  /** Canonical shareable URL — omit to default to current page URL. */
  shareUrl?: string;
  className?: string;
}

/**
 * Icon-only sticker-shaped share pill for the beach-detail attribution
 * cluster. Sibling to `BeachWatchersBadge` — same shape vocabulary
 * (asymmetric corners, Charming Orange), opposite rotation so the two
 * read as a matched pair peeled onto the same surface.
 *
 * Opens the existing `ShareSheet` with the `/api/og/beach?slug=...`
 * preview image. Fires `share_sheet_opened` on mount (distinct from
 * ShareSheet's `share_started` to avoid the double-fire bug caught in
 * the code-review pass) and the ShareSheet itself handles the terminal
 * action events (`share_completed` / `share_link_copied` /
 * `share_image_saved`).
 *
 * Plan: abstract-exploring-phoenix (Commit D, D2).
 */
export function ShareBeachPill({
  beachSlug,
  beachName,
  shareUrl,
  className,
}: ShareBeachPillProps) {
  const [open, setOpen] = useState(false);

  const imageUrl = useMemo(
    () => `/api/og/beach?slug=${encodeURIComponent(beachSlug)}`,
    [beachSlug]
  );

  const handleOpen = () => {
    track("share_sheet_opened", {
      surface: "beach",
      beach_slug: beachSlug,
      variant: "attribution-cluster-pill",
    });
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Share the stoke"
        data-testid="share-beach-pill"
        className={cn(
          STICKER_PILL_BASE,
          STICKER_PILL_INTERACTIVE,
          STICKER_ROTATIONS.share,
          className
        )}
      >
        <Share2 className="h-3 w-3" aria-hidden="true" />
        <span>Share</span>
      </button>

      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        imageUrl={imageUrl}
        type="beach"
        filename={`quiver-${beachSlug}`}
        title={`${beachName} surf report`}
        text={`Check ${beachName}'s surf call on Quiver`}
        shareUrl={shareUrl}
      />
    </>
  );
}
