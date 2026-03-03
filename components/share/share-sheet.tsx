"use client";

import * as React from "react";
import { Share2, Loader2, ImageIcon, Link as LinkIcon, Download, Check, X } from "lucide-react";
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
import { isNativeApp } from "@/lib/mobile/platform";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

export interface ShareSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** URL of the image to share */
  imageUrl: string;
  /** Type of content being shared (for analytics) */
  type: "wave" | "session";
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
  const [actionStates, setActionStates] = React.useState<Record<string, ActionState>>({});
  const [imageError, setImageError] = React.useState(false);
  const blobRef = React.useRef<Blob | null>(null);

  // Reset state and pre-fetch image blob when sheet opens
  React.useEffect(() => {
    if (open) {
      setActionStates({});
      setImageError(false);
      blobRef.current = null;

      fetchImageAsBlob(imageUrl)
        .then((blob) => {
          blobRef.current = blob;
        })
        .catch(() => {
          // Image fetch failure is handled gracefully - Save will re-fetch if needed
        });
    }
  }, [open, imageUrl]);

  function setActionState(action: string, state: ActionState) {
    setActionStates((prev) => ({ ...prev, [action]: state }));
  }

  function resetActionAfter(action: string, delay: number) {
    setTimeout(() => setActionState(action, "idle"), delay);
  }

  const handleCopyLink = async () => {
    setActionState("copy", "loading");

    const base = shareUrl ?? (typeof window !== "undefined" ? window.location.href : "");
    const separator = base.includes("?") ? "&" : "?";
    const url = `${base}${separator}utm_source=quiver&utm_medium=share&utm_campaign=${type}_share`;

    try {
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
      // Native: open native share sheet so user can save to Photos
      if (isNativeApp()) {
        await shareImage(imageUrl, filename, { title, text });
        setActionState("save", "success");
        track("share_image_saved", { type });
        resetActionAfter("save", 1500);
        return;
      }

      // Web: download directly
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
      await shareImage(imageUrl, filename, { title, text });
      setActionState("more", "success");
      track("share_completed", { type });
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "social_share",
          metadata: { content_type: type, method: "native_share" },
        }),
        keepalive: true,
      }).catch(() => {});
      setTimeout(() => onOpenChange(false), 500);
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
          "rounded-t-2xl pb-safe border-t-0 border-transparent bg-[#0B1426]",
          "[&>button[data-radix-dialog-close]]:hidden",
          className
        )}
      >
        <SheetHeader>
          <div className="flex items-center justify-between mb-4">
            <SheetTitle className="text-white font-bold text-lg">Share the stoke</SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white transition-colors"
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
          <div className="aspect-[4/3] w-full max-w-sm mx-auto rounded-2xl border border-[#1E2D4A] overflow-hidden bg-[#0F1B30]">
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
          </div>

          {/* Action buttons row */}
          <div className="flex items-start justify-center gap-8 w-full max-w-sm mx-auto">
            <ActionButton
              label={actionStates["copy"] === "success" ? "Copied!" : "Copy Link"}
              state={actionStates["copy"] ?? "idle"}
              idleIcon={<LinkIcon className="h-5 w-5 text-white" />}
              onClick={handleCopyLink}
            />
            <ActionButton
              label={actionStates["save"] === "success" ? "Saved!" : "Save"}
              state={actionStates["save"] ?? "idle"}
              idleIcon={<Download className="h-5 w-5 text-white" />}
              onClick={handleSave}
            />
            <ActionButton
              label="More"
              state={actionStates["more"] ?? "idle"}
              idleIcon={<Share2 className="h-5 w-5 text-white" />}
              onClick={handleMore}
            />
          </div>

          {/* Close text button */}
          <button
            onClick={() => onOpenChange(false)}
            className="text-white/50 hover:text-white/70 text-sm font-medium py-3 w-full transition-colors"
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
}

function ActionButton({ label, state, idleIcon, onClick }: ActionButtonProps) {
  const isSuccess = state === "success";
  const isLoading = state === "loading";

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="flex flex-col items-center gap-0 disabled:opacity-60"
    >
      <div className="w-12 h-12 rounded-full bg-[#172544] border border-[#1E2D4A] flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="h-5 w-5 text-white animate-spin" />
        ) : isSuccess ? (
          <Check className="h-5 w-5 text-[#00D4AA]" />
        ) : (
          idleIcon
        )}
      </div>
      <span
        className={cn(
          "text-xs mt-1.5",
          isSuccess ? "text-[#00D4AA]" : "text-white/70"
        )}
      >
        {label}
      </span>
    </button>
  );
}
