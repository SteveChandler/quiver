"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Link, Loader2, Share2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/context/auth-context";
import { updateSession } from "@/actions/session-actions";
import { useToast } from "@/components/ui/use-toast";

type Variant = "story" | "square";

interface ShareModalProps {
  sessionId: string;
  defaultVariant?: Variant;
  isPublic?: boolean;
  open: boolean;
  onClose: () => void;
  onMadePublic?: () => void;
}

function buildShareUrl(sessionId: string, variant: Variant) {
  // Handle SSR by using fallback origin
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000"; // fallback for SSR
  const url = new URL("/api/social/share/og", origin);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("variant", variant);
  return url.toString();
}

function getUserAgent() {
  return typeof navigator !== "undefined" ? navigator.userAgent : "";
}

function isIOSSafari() {
  const ua = getUserAgent();
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua);
}

function hasWebShare() {
  return typeof navigator !== "undefined" && "share" in navigator;
}

export function ShareModal({
  sessionId,
  defaultVariant,
  isPublic: initialPublic,
  open,
  onClose,
  onMadePublic,
}: ShareModalProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [variant, setVariant] = useState<Variant>(
    defaultVariant || (isMobile ? "story" : "square")
  );
  const [warming, setWarming] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(!!initialPublic);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [hasShownImageReadyToast, setHasShownImageReadyToast] = useState(false);
  const [hasShownDownloadToast, setHasShownDownloadToast] = useState(false);
  const [hasShownShareToast, setHasShownShareToast] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset states when modal opens
      setHasShownImageReadyToast(false);
      setHasShownDownloadToast(false);
      setHasShownShareToast(false);

      // Warm the function via HEAD
      const url = buildShareUrl(sessionId, variant);
      setWarming(true);
      setImgReady(false);
      fetch(url, { method: "HEAD" })
        .catch(() => void 0)
        .finally(() => setWarming(false));
    }
  }, [open, sessionId, variant]);

  useEffect(() => {
    if (defaultVariant) setVariant(defaultVariant);
  }, [defaultVariant]);

  const imgUrl = useMemo(
    () => buildShareUrl(sessionId, variant),
    [sessionId, variant]
  );

  const makePublic = async () => {
    if (!user) return;
    try {
      setUpdating(true);
      const res = await updateSession(sessionId, user.id, { is_public: true });
      if ((res as any)?.success !== false) {
        setIsPublic(true);
        onMadePublic?.();
        toast({ title: "Session is now shareable! 🏄‍♂️" });
        // Re-warm and reload image post visibility change
        setWarming(true);
        setImgReady(false);
        await fetch(imgUrl, { method: "HEAD" }).catch(() => void 0);
      } else {
        toast({
          title: "Failed to make session shareable",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to make session shareable",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
      setWarming(false);
    }
  };

  const downloadImage = useCallback(async () => {
    if (!imgReady) return;

    try {
      setDownloading(true);
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiver-session-${sessionId}-${variant}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (!hasShownDownloadToast) {
        toast({ title: "Image downloaded! 📸" });
        setHasShownDownloadToast(true);
      }
    } catch (error) {
      toast({ title: "Failed to download image", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }, [imgUrl, imgReady, sessionId, variant, hasShownDownloadToast]);

  const shareImage = useCallback(async () => {
    if (!imgReady || !hasWebShare()) return;

    try {
      setSharing(true);
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const file = new File([blob], `quiver-session-${sessionId}.png`, {
        type: "image/png",
      });

      await navigator.share({
        title: "Check out my surf session!",
        text: "Had an epic surf session - check it out on Quiver! 🏄‍♂️",
        files: [file],
      });

      if (!hasShownShareToast) {
        toast({ title: "Shared successfully! 🤙" });
        setHasShownShareToast(true);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast({ title: "Failed to share image", variant: "destructive" });
      }
    } finally {
      setSharing(false);
    }
  }, [imgUrl, imgReady, sessionId, hasShownShareToast]);

  const getPlatformCopy = () => {
    if (hasWebShare()) {
      return "Tap Share to post to social media";
    }
    if (isIOSSafari()) {
      return "Use the Share Sheet to save image";
    }
    return "Download to upload to Instagram/TikTok";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        data-testid="share-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            Share Your Epic Session
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Tabs
            value={variant}
            onValueChange={(v) => setVariant(v as Variant)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="story"
                className="text-sm sm:text-base"
                onClick={() => setVariant("story")}
              >
                Story <span className="hidden sm:inline">(1080x1920)</span>
              </TabsTrigger>
              <TabsTrigger
                value="square"
                className="text-sm sm:text-base"
                onClick={() => setVariant("square")}
              >
                Square <span className="hidden sm:inline">(1080x1080)</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {!isPublic && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border p-4">
              <div className="flex-1">
                <div className="font-medium text-sm sm:text-base">
                  Session needs to be public to share
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Make it shareable to generate social media images
                </div>
              </div>
              <Button
                onClick={makePublic}
                disabled={updating}
                size={isMobile ? "sm" : "default"}
              >
                {updating ? (
                  <>
                    <Loader2
                      className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Making public...
                  </>
                ) : (
                  "Make shareable"
                )}
              </Button>
            </div>
          )}

          <div className="relative w-full bg-muted rounded-md overflow-hidden motion-optimized">
            {(warming || !imgReady) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 backdrop-blur-sm z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2
                    className="h-6 w-6 animate-spin text-primary"
                    aria-hidden="true"
                  />
                  <span
                    className="text-sm text-muted-foreground font-medium"
                    aria-live="polite"
                  >
                    {warming
                      ? "Generating your epic session..."
                      : "Loading preview..."}
                  </span>
                </div>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgUrl}
              alt={`Share preview for surf session in ${variant} format`}
              className={`w-full share-flip-animation ${
                sharing
                  ? "sharing"
                  : imgReady && hasShownImageReadyToast
                  ? "shared"
                  : ""
              } ${
                variant === "story" ? "aspect-[9/16]" : "aspect-square"
              } object-contain transition-all duration-500 ${
                imgReady ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              onLoad={() => {
                setImgReady(true);
                if (!hasShownImageReadyToast && isPublic) {
                  toast({ title: "Your session image is ready! 🏄‍♂️" });
                  setHasShownImageReadyToast(true);
                }
              }}
              onError={() => {
                setImgReady(true);
                toast({
                  title: "Failed to generate image",
                  variant: "destructive",
                });
              }}
            />
          </div>

          {isPublic && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                {getPlatformCopy()}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {hasWebShare() ? (
                  <Button
                    onClick={shareImage}
                    disabled={sharing || !imgReady}
                    className={`flex-1 motion-optimized like-button-spring ripple-effect transition-all ${
                      hasShownShareToast ? "celebration-bounce" : ""
                    }`}
                    aria-label="Share session image"
                    data-testid="web-share-button"
                    style={{
                      transform: sharing ? "scale(0.95)" : "scale(1)",
                    }}
                  >
                    {sharing ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Sharing...
                      </>
                    ) : (
                      <>
                        <Share2
                          className={`mr-2 h-4 w-4 transition-transform ${
                            hasShownShareToast ? "scale-110 text-green-500" : ""
                          }`}
                          aria-hidden="true"
                        />
                        {hasShownShareToast ? "Shared! 🤙" : "Share"}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={downloadImage}
                    disabled={downloading || !imgReady}
                    className={`flex-1 motion-optimized like-button-spring ripple-effect transition-all ${
                      hasShownDownloadToast ? "celebration-bounce" : ""
                    }`}
                    aria-label="Download session image"
                    data-testid="download-button"
                    style={{
                      transform: downloading ? "scale(0.95)" : "scale(1)",
                    }}
                  >
                    {downloading ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download
                          className={`mr-2 h-4 w-4 transition-transform ${
                            hasShownDownloadToast
                              ? "scale-110 text-green-500"
                              : ""
                          }`}
                          aria-hidden="true"
                        />
                        {hasShownDownloadToast ? "Downloaded! 📸" : "Download"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
