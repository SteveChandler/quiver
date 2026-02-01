"use client";

import * as React from "react";
import { Share2, Loader2, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { shareImage, ShareImageError } from "@/lib/share/share-image";
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
}

type ShareState = "idle" | "loading" | "error" | "success";

const LOADING_TEXT = "Generating image...";

/**
 * Minimal bottom sheet for sharing images
 *
 * Shows image preview with a single "Share" button.
 * Uses native share sheets on mobile, Web Share API on desktop,
 * with download fallback when share APIs are unavailable.
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
}: ShareSheetProps) {
  const [state, setState] = React.useState<ShareState>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  // Reset state when sheet opens
  React.useEffect(() => {
    if (open) {
      setState("idle");
      setErrorMessage(null);
      setImageLoaded(false);
    }
  }, [open]);

  const handleShare = async () => {
    setState("loading");
    setErrorMessage(null);

    track("share_started", { type });

    try {
      await shareImage(imageUrl, filename, { title, text });
      setState("success");
      track("share_completed", { type });
      // Close after successful share
      setTimeout(() => onOpenChange(false), 500);
    } catch (error) {
      if (error instanceof ShareImageError) {
        // User cancelled - just reset to idle
        if (error.code === "SHARE_CANCELLED") {
          setState("idle");
          return;
        }
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to share image");
      }
      setState("error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-2xl pb-safe",
          className
        )}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Share Session</SheetTitle>
          <SheetDescription>Share your session image</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col items-center gap-4 pt-2">
          {/* Image preview */}
          <div className="relative w-full max-w-sm aspect-[4/3] rounded-lg overflow-hidden bg-muted">
            {/* Shimmer loading state */}
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-muted via-muted-foreground/10 to-muted" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Session preview"
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
            />
            {/* Share action loading overlay - 70% opacity allows preview visibility while indicating blocking operation */}
            {state === "loading" && (
              <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground">{LOADING_TEXT}</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {state === "error" && errorMessage && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Share button */}
          <Button
            onClick={handleShare}
            disabled={state === "loading"}
            size="lg"
            className="w-full max-w-sm"
          >
            {state === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LOADING_TEXT}
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
