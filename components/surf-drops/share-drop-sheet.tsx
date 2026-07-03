"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import { cn } from "@/lib/utils";
import type { SurfDropDetail } from "@/types/surf-drops";

interface ShareDropSheetProps {
  open: boolean;
  onClose: () => void;
  drop: SurfDropDetail;
}

function buildOgUrl(drop: SurfDropDetail): string {
  return `/api/og/drop/${drop.share_slug}`;
}

function buildShareUrl(shareSlug: string): string {
  if (typeof window === "undefined") {
    return `https://www.quiversurf.app/go/${shareSlug}`;
  }
  // Share URLs must be absolute. We deliberately fall back to the prod
  // origin when the caller is on localhost so copied links resolve
  // outside dev — that's why we read window.location.origin instead of
  // using a Next router (there is no router-based way to get the origin).
  const origin =
    // eslint-disable-next-line no-restricted-properties
    window.location.origin;
  const prodOrigin = origin.startsWith("http://localhost")
    ? "https://www.quiversurf.app"
    : origin;
  return `${prodOrigin}/go/${shareSlug}`;
}

export function ShareDropSheet({ open, onClose, drop }: ShareDropSheetProps) {
  const { track } = useTrackEvent();
  const [copied, setCopied] = useState(false);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);

  const shareUrl = useMemo(() => buildShareUrl(drop.share_slug), [drop.share_slug]);
  const ogUrl = useMemo(() => buildOgUrl(drop), [drop]);

  useEffect(() => {
    setNativeShareAvailable(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    void track("surf_drop_share_opened", {
      metadata: { drop_id: drop.id, slug: drop.share_slug },
    });
  }, [drop.id, drop.share_slug, open, track]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!nativeShareAvailable) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: "Surf Drop",
        text: "I'm in. Pull up if you are too.",
        url: shareUrl,
      });
    } catch {
      /* user dismissed */
    }
  }, [handleCopy, nativeShareAvailable, shareUrl]);

  if (!open) return null;

  return (
    <div
      className="share-drop-sheet__scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share Surf Drop"
    >
      <div
        className="share-drop-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-drop-sheet__header">
          <span className="share-drop-sheet__eyebrow">Share Surf Drop</span>
          <button
            type="button"
            className="share-drop-sheet__close"
            onClick={onClose}
            aria-label="Close share sheet"
          >
            Close
          </button>
        </div>

        <div className="share-drop-sheet__preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ogUrl} alt="Surf Drop preview" loading="lazy" />
        </div>

        <div className="share-drop-sheet__link" aria-label="Share URL">
          {shareUrl}
        </div>

        <div className="share-drop-sheet__actions">
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "share-drop-sheet__action",
              copied && "share-drop-sheet__action--success",
            )}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          {nativeShareAvailable ? (
            <button
              type="button"
              onClick={handleNativeShare}
              className="share-drop-sheet__action share-drop-sheet__action--primary"
            >
              Share…
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
