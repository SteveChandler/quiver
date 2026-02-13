"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function CamsShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    const title = "Live Surf Cams - Free, No Paywall | Quiver";

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-ocean-blue hover:text-white backdrop-blur-sm"
      aria-label="Share this page"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
