"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";

export function CamsShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // eslint-disable-next-line no-restricted-properties -- needs full URL with protocol for Web Share API
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("utm_source", "quiver");
    shareUrl.searchParams.set("utm_medium", "share");
    shareUrl.searchParams.set("utm_campaign", "cam_share");
    const url = shareUrl.toString();
    const title = "Live Surf Cams | Quiver";

    let shared = false;
    let method: "native_share" | "clipboard" = "clipboard";

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        shared = true;
        method = "native_share";
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      shared = true;
      method = "clipboard";
    }

    if (shared) {
      // Track share event
      track("cam_share", { method });
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "social_share",
          metadata: {
            content_type: "cam",
            method,
          },
        }),
        keepalive: true,
      }).catch(() => {});
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="rounded-[14px_6px_16px_6px] border-2 border-[#11100D] bg-[#F78E42] px-4 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.24)] transition-transform hover:-translate-y-0.5 hover:bg-[#FDB84B] hover:text-[#11100D]"
      aria-label="Share this page"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied!" : "Share"}
    </Button>
  );
}
