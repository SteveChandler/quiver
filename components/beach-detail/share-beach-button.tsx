"use client";

import { useState, useMemo } from "react";
import { Share2 } from "lucide-react";
import { ShareSheet } from "@/components/share/share-sheet";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface ShareBeachButtonProps {
  beachSlug: string;
  beachName: string;
  /** Canonical shareable URL — omit to default to current page URL. */
  shareUrl?: string;
  className?: string;
}

/**
 * Share button for beach detail pages. Opens the existing `ShareSheet`
 * with the `/api/og/beach?slug=...` image as the preview. Fires
 * `share_started` / `share_completed` / `share_link_copied` /
 * `share_image_saved` via the ShareSheet's internal tracking.
 *
 * Previously there was no share surface on beach pages despite a ready
 * OG image route — 0 beach-share events in 7d ending 2026-04-17. Plan:
 * abstract-exploring-phoenix (Commit C).
 */
export function ShareBeachButton({
  beachSlug,
  beachName,
  shareUrl,
  className,
}: ShareBeachButtonProps) {
  const [open, setOpen] = useState(false);

  const imageUrl = useMemo(
    () => `/api/og/beach?slug=${encodeURIComponent(beachSlug)}`,
    [beachSlug]
  );

  const handleOpen = () => {
    track("share_started", { surface: "beach", beach_slug: beachSlug });
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Share ${beachName}`}
        data-testid="share-beach-button"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
          "border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]",
          className
        )}
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share
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
