"use client";

import * as React from "react";
import { Share2, Loader2, ImageIcon, Link as LinkIcon, Download, Check, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  shareImage,
  ShareImageError,
  fetchImageAsBlob,
  downloadImage,
  copyToClipboard,
} from "@/lib/share/share-image";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";

export interface ShareSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** URL of the image to share */
  imageUrl: string;
  /** Type of content being shared (for analytics) */
  type: "wave" | "session" | "beach" | "forecast";
  /** Filename for the shared image (extension added automatically) */
  filename?: string;
  /** Optional title for the share dialog */
  title?: string;
  /** Optional text/description for the share */
  text?: string;
  /** Optional className for the sheet content */
  className?: string;
  /** Optional URL to share (defaults to current page URL) */
  shareUrl?: string;
}

type ActionState = "idle" | "loading" | "success" | "error";

// Issue 6: Typed union for action keys instead of bare string
type ActionKey = "copy" | "save" | "more";

/**
 * Lovi-style dark share sheet with three actions:
 * Copy Link, Save image, and More (full native share).
 *
 * Pre-fetches the image blob when the sheet opens so Save is instant.
 */
export function ShareSheet({
  open,
  onOpenChange,
  imageUrl,
  type,
  filename = "quiver-session",
  title = "Check out my session!",
  text,
  className,
  shareUrl,
}: ShareSheetProps) {
  // Issue 6: Use Record<ActionKey, ActionState> for full type safety
  const [actionStates, setActionStates] = React.useState<Partial<Record<ActionKey, ActionState>>>({});
  const [imageError, setImageError] = React.useState(false);
  const blobRef = React.useRef<Blob | null>(null);

  // Issue 2: Track all pending timer IDs so we can clear them on close/unmount
  const timersRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const prefersReducedMotion = useReducedMotion();

  // Issue 1: Stale-closure guard for the pre-fetch effect
  React.useEffect(() => {
    if (open) {
      setActionStates({});
      setImageError(false);
      blobRef.current = null;

      let cancelled = false;
      fetchImageAsBlob(imageUrl)
        .then((blob) => {
          if (!cancelled) blobRef.current = blob;
        })
        .catch(() => {
          // Image fetch failure is handled gracefully - Save will re-fetch if needed
        });

      return () => {
        cancelled = true;
      };
    }
  }, [open, imageUrl]);

  // Issue 2: Clear all pending timers when the sheet closes
  React.useEffect(() => {
    if (!open) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    }
  }, [open]);

  // Issue 2: Clear all pending timers on unmount
  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Issue 6: ActionKey typed parameter
  function setActionState(action: ActionKey, state: ActionState) {
    setActionStates((prev) => ({ ...prev, [action]: state }));
  }

  // Issue 2: Track timer IDs in ref instead of bare setTimeout
  function resetActionAfter(action: ActionKey, delay: number) {
    const id = setTimeout(() => {
      setActionState(action, "idle");
      timersRef.current.delete(id);
    }, delay);
    timersRef.current.add(id);
  }

  // Issue 3: Use URL constructor for safe UTM param construction
  const getTrackedShareUrl = React.useCallback(() => {
    // eslint-disable-next-line no-restricted-properties -- reading URL for share data, not navigating
    const base = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!base) return "";

    // URL(base, origin) supports both absolute and app-relative shareUrl values.
    // eslint-disable-next-line no-restricted-properties -- reading origin for URL normalization, not navigating
    const origin = typeof window !== "undefined" ? window.location.origin : "https://quiversurf.app";
    const urlObj = new URL(base, origin);
    urlObj.searchParams.set("utm_source", "quiver");
    urlObj.searchParams.set("utm_medium", "share");
    urlObj.searchParams.set("utm_campaign", `${type}_share`);
    return urlObj.toString();
  }, [shareUrl, type]);

  const handleCopyLink = async () => {
    setActionState("copy", "loading");

    try {
      const url = getTrackedShareUrl();
      if (!url) {
        setActionState("copy", "error");
        resetActionAfter("copy", 1500);
        return;
      }

      await copyToClipboard(url);
      setActionState("copy", "success");
      track("share_link_copied", { type });
      resetActionAfter("copy", 2000);
    } catch {
      setActionState("copy", "error");
      resetActionAfter("copy", 1500);
    }
  };

  const handleSave = async () => {
    setActionState("save", "loading");

    try {
      // Download directly
      const blob = blobRef.current ?? (await fetchImageAsBlob(imageUrl));
      downloadImage(blob, filename);
      setActionState("save", "success");
      track("share_image_saved", { type });
      resetActionAfter("save", 1500);
    } catch (error) {
      if (error instanceof ShareImageError && error.code === "SHARE_CANCELLED") {
        setActionState("save", "idle");
        return;
      }
      setActionState("save", "error");
      resetActionAfter("save", 1500);
    }
  };

  const handleMore = async () => {
    setActionState("more", "loading");

    track("share_started", { type });

    try {
      const url = getTrackedShareUrl();
      await shareImage(imageUrl, filename, {
        title,
        text,
        url: url || undefined,
      });
      setActionState("more", "success");
      track("share_completed", { type });
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "share_completed",
          metadata: { content_type: type, method: "native_share" },
          sessionId: getVisitorId(),
          viewportWidth: window.innerWidth,
        }),
        keepalive: true,
      }).catch(() => {});
      // Issue 2: Track the close timeout in timersRef
      const closeId = setTimeout(() => {
        onOpenChange(false);
        timersRef.current.delete(closeId);
      }, 500);
      timersRef.current.add(closeId);
    } catch (error) {
      if (error instanceof ShareImageError && error.code === "SHARE_CANCELLED") {
        setActionState("more", "idle");
        return;
      }
      setActionState("more", "error");
      resetActionAfter("more", 1500);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-2xl pb-safe border-t-2 border-[#F78E42]/30 noise-texture shadow-[0_-4px_20px_rgba(247,142,66,0.12)]",
          "[&>button[data-radix-dialog-close]]:hidden",
          className
        )}
        style={{ background: 'linear-gradient(180deg, #1E2558 0%, #252D6B 40%, #2D357D 100%)' }}
      >
        <SheetHeader>
          <div className="flex items-center justify-between mb-4">
            <SheetTitle className="text-white font-bold text-xl font-heading text-glow-orange">
              Share the <span className="text-[#F78E42]">stoke</span>
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white transition-colors focus-ring"
              aria-label="Close share sheet"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <SheetDescription className="sr-only">
            Share your session image via link, download, or native share
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col items-center gap-6">
          {/* Image preview */}
          <motion.div
            className="aspect-[9/16] max-w-[200px] mx-auto border-2 border-[#F78E42]/25 overflow-hidden bg-[#0F1B30] shadow-lg"
            style={{ borderRadius: '12px 14px 11px 13px', rotate: -2 }}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            {imageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/40">
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm text-center px-4">{title}</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Session preview"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </motion.div>

          {/* Issue 5: Screen reader status announcements */}
          <div className="sr-only" aria-live="polite" role="status">
            {actionStates["copy"] === "success" && "Link copied to clipboard"}
            {actionStates["save"] === "success" && "Image saved"}
            {actionStates["copy"] === "loading" && "Copying link"}
            {actionStates["save"] === "loading" && "Saving image"}
            {actionStates["more"] === "loading" && "Opening share"}
          </div>

          {/* Action buttons row */}
          <div className="flex items-start justify-center gap-8 w-full max-w-sm mx-auto">
            <ActionButton
              label={actionStates["copy"] === "success" ? "Copied!" : "Copy Link"}
              state={actionStates["copy"] ?? "idle"}
              idleIcon={<LinkIcon className="h-5 w-5 text-white" />}
              onClick={handleCopyLink}
              rotation={-1.5}
              prefersReducedMotion={prefersReducedMotion}
              delay={0.25}
            />
            <ActionButton
              label={actionStates["save"] === "success" ? "Saved!" : "Save"}
              state={actionStates["save"] ?? "idle"}
              idleIcon={<Download className="h-5 w-5 text-white" />}
              onClick={handleSave}
              rotation={1}
              prefersReducedMotion={prefersReducedMotion}
              delay={0.33}
            />
            <ActionButton
              label="More"
              state={actionStates["more"] ?? "idle"}
              idleIcon={<Share2 className="h-5 w-5 text-white" />}
              onClick={handleMore}
              rotation={-0.5}
              prefersReducedMotion={prefersReducedMotion}
              delay={0.41}
            />
          </div>

          {/* Close text button */}
          {/* Issue 8: aria-label on bottom Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="font-heading text-xs uppercase tracking-wider text-white/40 hover:text-white/60 py-3 w-full transition-colors focus-ring"
            aria-label="Close share sheet"
          >
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ActionButtonProps {
  label: string;
  state: ActionState;
  idleIcon: React.ReactNode;
  onClick: () => void;
  rotation?: number;
  prefersReducedMotion?: boolean | null;
  delay?: number;
}

function ActionButton({ label, state, idleIcon, onClick, rotation = 0, prefersReducedMotion, delay = 0 }: ActionButtonProps) {
  const isSuccess = state === "success";
  const isLoading = state === "loading";

  return (
    <motion.button
      onClick={onClick}
      disabled={isLoading}
      className="flex flex-col items-center gap-0 disabled:opacity-60"
      style={{ rotate: rotation }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
    >
      <div
        className={cn(
          "w-12 h-12 flex items-center justify-center border bg-gradient-to-br from-[#354090] to-[#2D357D] transition-colors",
          isSuccess ? "border-[#F78E42]/50" : "border-[#404C92] hover:border-[#F78E42]/50"
        )}
        style={{ borderRadius: '12px 14px 11px 13px' }}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 text-white animate-spin" />
        ) : isSuccess ? (
          <Check className="h-5 w-5 text-[#F78E42]" />
        ) : (
          idleIcon
        )}
      </div>
      <span
        className={cn(
          "text-xs mt-1.5 font-heading",
          isSuccess ? "text-[#F78E42]" : "text-medium"
        )}
      >
        {label}
      </span>
    </motion.button>
  );
}
