"use client";

import { useState, useCallback } from "react";
import { Share2, Check } from "lucide-react";
import { track } from "@/lib/analytics";

interface ToolShareButtonProps {
  /** Tool display name, e.g. "Offshore Wind Checker" */
  toolName: string;
  /** Beach name when available, included in share text */
  beachName?: string | null;
  /** Optional custom share text override */
  shareText?: string;
}

/**
 * Compact share button for tool pages.
 * Uses Web Share API on mobile, falls back to clipboard copy with brief feedback.
 *
 * Fires `share_started` / `share_completed` / `share_link_copied` events for
 * the /app-stats dashboard. Previously the button shipped with zero tracking
 * — 0 events in the 7d ending 2026-04-17 despite real tool-page traffic.
 * Plan: abstract-exploring-phoenix (Commit C).
 */
export function ToolShareButton({
  toolName,
  beachName,
  shareText: customShareText,
}: ToolShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    // eslint-disable-next-line no-restricted-properties -- needs full URL with protocol for Web Share API
    const url = window.location.href;
    const text =
      customShareText ??
      (beachName
        ? `Check ${toolName.toLowerCase()} at ${beachName} on Quiver`
        : `${toolName} on Quiver`);

    const trackingMeta = {
      surface: "tool",
      tool_name: toolName,
      beach_name: beachName ?? undefined,
    };

    if (navigator.share) {
      track("share_started", trackingMeta);
      try {
        await navigator.share({ title: toolName, text, url });
        track("share_completed", trackingMeta);
      } catch (err) {
        // User cancelled share — not an error
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
      return;
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track("share_link_copied", trackingMeta);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: prompt-based copy
      window.prompt("Copy this link:", url);
    }
  }, [toolName, beachName, customShareText]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors hover:border-[rgba(247,142,66,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42]"
      style={{
        background: copied
          ? "rgba(34,197,94,0.12)"
          : "rgba(37,45,107,0.5)",
        borderColor: copied
          ? "rgba(34,197,94,0.4)"
          : "rgba(64,76,146,0.4)",
        color: copied ? "#4ade80" : "#B8C7E0",
      }}
      aria-label={copied ? "Link copied" : `Share ${toolName}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Share
        </>
      )}
    </button>
  );
}
