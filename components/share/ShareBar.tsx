/**
 * ShareBar Component
 * Main share interface with platform buttons, variant selector, and aspect ratio selector
 */

"use client";

import { useState, useCallback } from "react";
import type { SessionWithDetails } from "@/types/database";
import type { SharePlatform, ShareVariant, AspectRatio } from "@/types/session-share";
import { PLATFORM_NAMES, VARIANT_NAMES } from "@/types/session-share";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  Instagram,
  Twitter,
  Facebook,
  Share2,
  Download,
  Loader2,
  Copy,
  CheckCircle2,
} from "lucide-react";
import {
  buildPlatformShareUrl,
  openShareUrl,
  downloadImage,
  buildImageFilename,
  triggerNativeShare,
  isWebShareAvailable,
  copyShareUrl,
} from "@/lib/share/share-url-builder";
import {
  trackShare,
  trackSharePlatformSelected,
  trackShareCompleted,
  trackShareFailed,
  trackVariantChanged,
  trackAspectRatioChanged,
  trackDownloadStarted,
  trackDownloadCompleted,
  incrementSessionShareCount,
} from "@/lib/share/track-share";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { updateSession } from "@/actions/session-actions";

export interface ShareBarProps {
  session: SessionWithDetails;
  sessionId: string;
  defaultVariant?: ShareVariant;
  defaultRatio?: AspectRatio;
  surface?: string;
  className?: string;
  onSessionUpdated?: (session: SessionWithDetails) => void;
}

export function ShareBar({
  session,
  sessionId,
  defaultVariant = 1,
  defaultRatio = "1:1",
  surface = "session_detail",
  className,
  onSessionUpdated,
}: ShareBarProps) {
  const { user } = useAuth();
  const [selectedVariant, setSelectedVariant] = useState<ShareVariant>(defaultVariant);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(defaultRatio);
  const [isSharing, setIsSharing] = useState(false);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  /**
   * Handle variant change
   */
  const handleVariantChange = useCallback(
    (newVariant: string) => {
      const variant = parseInt(newVariant) as ShareVariant;
      const previousVariant = selectedVariant;
      setSelectedVariant(variant);

      trackVariantChanged(variant, {
        sessionId,
        previousVariant,
        surface,
      });
    },
    [selectedVariant, sessionId, surface]
  );

  /**
   * Handle aspect ratio change
   */
  const handleRatioChange = useCallback(
    (newRatio: string) => {
      const ratio = newRatio as AspectRatio;
      const previousRatio = selectedRatio;
      setSelectedRatio(ratio);

      trackAspectRatioChanged(ratio, {
        sessionId,
        previousAspectRatio: previousRatio,
        surface,
      });
    },
    [selectedRatio, sessionId, surface]
  );

  /**
   * Handle platform share
   */
  const handleShare = useCallback(
    async (platform: SharePlatform) => {
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to share your sessions",
          variant: "destructive",
        });
        return;
      }

      // Auto-make session public before sharing
      if (!session.is_public && !isUpdatingPrivacy) {
        setIsUpdatingPrivacy(true);
        try {
          const result = await updateSession(sessionId, user.id, { is_public: true });

          if (!result || (result as any).error) {
            toast({
              title: "Failed to make session public",
              description: "Please try again or check your permissions",
              variant: "destructive",
            });
            return;
          }

          // Update parent component with new session state
          if (onSessionUpdated) {
            onSessionUpdated({ ...session, is_public: true });
          }

          toast({
            title: "Session is now public",
            description: "Your session can now be shared with others",
          });
        } catch (error) {
          console.error("Failed to make session public:", error);
          toast({
            title: "Failed to make session public",
            description: error instanceof Error ? error.message : "Please try again",
            variant: "destructive",
          });
          return;
        } finally {
          setIsUpdatingPrivacy(false);
        }
      }

      setIsSharing(true);

      try {
        // Track platform selection
        trackSharePlatformSelected(platform, {
          sessionId,
          variant: selectedVariant,
          aspectRatio: selectedRatio,
          surface,
        });

        const shareData = buildPlatformShareUrl(
          platform,
          session,
          sessionId,
          selectedVariant,
          selectedRatio
        );

        switch (platform) {
          case "instagram":
            // Download image for Instagram
            trackDownloadStarted({
              sessionId,
              variant: selectedVariant,
              aspectRatio: selectedRatio,
              surface,
            });

            const instagramFilename = buildImageFilename(
              session,
              selectedVariant,
              selectedRatio
            );
            const instagramSuccess = await downloadImage(
              shareData.url,
              instagramFilename
            );

            if (instagramSuccess) {
              trackDownloadCompleted({
                sessionId,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                surface,
              });

              toast({
                title: "Image downloaded!",
                description: shareData.tooltip || "Share to Instagram Stories and add a link sticker",
                duration: 5000,
              });

              // Track share
              await trackShare("instagram", {
                sessionId,
                userId: user.id,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                shareUrl: shareData.url,
                surface,
              });

              await incrementSessionShareCount(sessionId);
              trackShareCompleted("instagram", {
                sessionId,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                surface,
              });
            } else {
              throw new Error("Failed to download image");
            }
            break;

          case "x":
          case "facebook":
            // Open share URL
            openShareUrl(shareData.url);

            // Track share
            await trackShare(platform, {
              sessionId,
              userId: user.id,
              variant: selectedVariant,
              aspectRatio: selectedRatio,
              shareUrl: shareData.url,
              surface,
            });

            await incrementSessionShareCount(sessionId);
            trackShareCompleted(platform, {
              sessionId,
              variant: selectedVariant,
              aspectRatio: selectedRatio,
              surface,
            });
            break;

          case "download":
            // Download image
            trackDownloadStarted({
              sessionId,
              variant: selectedVariant,
              aspectRatio: selectedRatio,
              surface,
            });

            const filename = buildImageFilename(
              session,
              selectedVariant,
              selectedRatio
            );
            const downloadSuccess = await downloadImage(shareData.url, filename);

            if (downloadSuccess) {
              trackDownloadCompleted({
                sessionId,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                surface,
              });

              toast({
                title: "Image downloaded!",
                description: `Saved as ${filename}`,
              });

              // Track download as share
              await trackShare("download", {
                sessionId,
                userId: user.id,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                shareUrl: shareData.url,
                surface,
              });

              await incrementSessionShareCount(sessionId);
              trackShareCompleted("download", {
                sessionId,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                surface,
              });
            } else {
              throw new Error("Failed to download image");
            }
            break;

          case "generic":
            // Try native share first
            if (isWebShareAvailable()) {
              const nativeSuccess = await triggerNativeShare(session, sessionId);
              if (nativeSuccess) {
                await trackShare("generic", {
                  sessionId,
                  userId: user.id,
                  variant: selectedVariant,
                  aspectRatio: selectedRatio,
                  shareUrl: shareData.url,
                  surface,
                });

                await incrementSessionShareCount(sessionId);
                trackShareCompleted("generic", {
                  sessionId,
                  variant: selectedVariant,
                  aspectRatio: selectedRatio,
                  surface,
                });
                break;
              }
            }

            // Fall back to copy link
            const copySuccess = await copyShareUrl(sessionId);
            if (copySuccess) {
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);

              toast({
                title: "Link copied!",
                description: "Share link copied to clipboard",
              });

              await trackShare("generic", {
                sessionId,
                userId: user.id,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                shareUrl: shareData.url,
                surface,
              });

              await incrementSessionShareCount(sessionId);
              trackShareCompleted("generic", {
                sessionId,
                variant: selectedVariant,
                aspectRatio: selectedRatio,
                surface,
              });
            } else {
              throw new Error("Failed to copy link");
            }
            break;
        }
      } catch (error) {
        console.error("Share failed:", error);
        trackShareFailed(platform, {
          sessionId,
          variant: selectedVariant,
          aspectRatio: selectedRatio,
          error: error instanceof Error ? error.message : "Unknown error",
          surface,
        });

        toast({
          title: "Share failed",
          description: error instanceof Error ? error.message : "Please try again",
          variant: "destructive",
        });
      } finally {
        setIsSharing(false);
      }
    },
    [user, session, sessionId, selectedVariant, selectedRatio, surface, isUpdatingPrivacy, onSessionUpdated]
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Variant Selector */}
        <Select
          value={String(selectedVariant)}
          onValueChange={handleVariantChange}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select variant" />
          </SelectTrigger>
          <SelectContent>
            {([1, 2, 3, 4, 5, 6] as ShareVariant[]).map((variant) => (
              <SelectItem key={variant} value={String(variant)}>
                {VARIANT_NAMES[variant]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Aspect Ratio Selector */}
        <Select value={selectedRatio} onValueChange={handleRatioChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select ratio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1:1">1:1 Square</SelectItem>
            <SelectItem value="4:5">4:5 Portrait</SelectItem>
            <SelectItem value="9:16">9:16 Story</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Instagram */}
        <Button
          variant="outline"
          onClick={() => handleShare("instagram")}
          disabled={isSharing || isUpdatingPrivacy}
          aria-label="Share to Instagram"
          className="flex items-center gap-2"
        >
          {isSharing || isUpdatingPrivacy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Instagram className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Instagram</span>
        </Button>

        {/* X (Twitter) */}
        <Button
          variant="outline"
          onClick={() => handleShare("x")}
          disabled={isSharing || isUpdatingPrivacy}
          aria-label="Share to X (Twitter)"
          className="flex items-center gap-2"
        >
          {isSharing || isUpdatingPrivacy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Twitter className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">X</span>
        </Button>

        {/* Facebook */}
        <Button
          variant="outline"
          onClick={() => handleShare("facebook")}
          disabled={isSharing || isUpdatingPrivacy}
          aria-label="Share to Facebook"
          className="flex items-center gap-2"
        >
          {isSharing || isUpdatingPrivacy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Facebook className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Facebook</span>
        </Button>

        {/* Download */}
        <Button
          variant="outline"
          onClick={() => handleShare("download")}
          disabled={isSharing || isUpdatingPrivacy}
          aria-label="Download image"
          className="flex items-center gap-2"
        >
          {isSharing || isUpdatingPrivacy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Download</span>
        </Button>

        {/* Share Link / Copy */}
        <Button
          variant="outline"
          onClick={() => handleShare("generic")}
          disabled={isSharing || isUpdatingPrivacy}
          aria-label="Share link"
          className="flex items-center gap-2"
        >
          {isSharing || isUpdatingPrivacy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : copiedLink ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {copiedLink ? "Copied!" : "Share"}
          </span>
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-sm text-muted-foreground">
        Instagram: Download image and share to Stories with a link sticker
      </p>
    </div>
  );
}
