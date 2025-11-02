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
  mapVariantToSignedParams,
} from "@/lib/share/share-url-builder";
import { generateShareImageUrl } from "@/actions/social-share-actions";
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
import { useServerAction } from "@/hooks/use-data-fetcher";

export interface ShareBarProps {
  session: SessionWithDetails;
  sessionId: string;
  defaultVariant?: ShareVariant;
  defaultRatio?: AspectRatio;
  surface?: string;
  className?: string;
  onSessionUpdated?: (session: SessionWithDetails) => void;
}

/**
 * Make session public
 * Extracted logic for converting a private session to public
 */
async function makeSessionPublicAction(
  sessionId: string
): Promise<{ success: boolean; data?: SessionWithDetails; error?: string }> {
  try {
    const result = await updateSession(sessionId, { is_public: true });

    if (!result.success || result.error) {
      return {
        success: false,
        error: result.error || "Failed to make session public",
      };
    }

    return {
      success: true,
      data: result.data as SessionWithDetails,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to make session public",
    };
  }
}

/**
 * Execute platform share
 * Extracted logic for sharing to different platforms
 */
async function executePlatformShare(
  platform: SharePlatform,
  session: SessionWithDetails,
  sessionId: string,
  userId: string,
  variant: ShareVariant,
  aspectRatio: AspectRatio,
  surface: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (platform) {
      case "instagram": {
        // Download image for Instagram using signed URL
        trackDownloadStarted({
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        // Map variant and aspect ratio to signed params
        const { variant: stringVariant, ratio } = mapVariantToSignedParams(variant, aspectRatio);

        // Generate signed image URL
        const imageUrl = await generateShareImageUrl(sessionId, stringVariant, ratio);

        const filename = buildImageFilename(session, variant, aspectRatio);
        const success = await downloadImage(imageUrl, filename);

        if (!success) {
          throw new Error("Failed to download image");
        }

        trackDownloadCompleted({
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        // Track share
        await trackShare("instagram", {
          sessionId,
          userId,
          variant,
          aspectRatio,
          shareUrl: imageUrl,
          surface,
        });

        await incrementSessionShareCount(sessionId);
        trackShareCompleted("instagram", {
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        return {
          success: true,
          data: {
            message: "Image downloaded!",
            description: "Share to Instagram Stories and add a link sticker",
          },
        };
      }

      case "x":
      case "facebook": {
        // Build platform-specific share URL for X/Facebook
        const shareData = buildPlatformShareUrl(
          platform,
          session,
          sessionId,
          variant,
          aspectRatio
        );

        // Open share URL
        openShareUrl(shareData.url);

        // Track share
        await trackShare(platform, {
          sessionId,
          userId,
          variant,
          aspectRatio,
          shareUrl: shareData.url,
          surface,
        });

        await incrementSessionShareCount(sessionId);
        trackShareCompleted(platform, {
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        return { success: true };
      }

      case "download": {
        // Download image using signed URL
        trackDownloadStarted({
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        // Map variant and aspect ratio to signed params
        const { variant: stringVariant, ratio } = mapVariantToSignedParams(variant, aspectRatio);

        // Generate signed image URL
        const imageUrl = await generateShareImageUrl(sessionId, stringVariant, ratio);

        const filename = buildImageFilename(session, variant, aspectRatio);
        const success = await downloadImage(imageUrl, filename);

        if (!success) {
          throw new Error("Failed to download image");
        }

        trackDownloadCompleted({
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        // Track download as share
        await trackShare("download", {
          sessionId,
          userId,
          variant,
          aspectRatio,
          shareUrl: imageUrl,
          surface,
        });

        await incrementSessionShareCount(sessionId);
        trackShareCompleted("download", {
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        return {
          success: true,
          data: {
            message: "Image downloaded!",
            description: `Saved as ${filename}`,
          },
        };
      }

      case "generic": {
        // Build generic share URL
        const shareData = buildPlatformShareUrl(
          platform,
          session,
          sessionId,
          variant,
          aspectRatio
        );

        // Try native share first
        if (isWebShareAvailable()) {
          const nativeSuccess = await triggerNativeShare(session, sessionId);
          if (nativeSuccess) {
            await trackShare("generic", {
              sessionId,
              userId,
              variant,
              aspectRatio,
              shareUrl: shareData.url,
              surface,
            });

            await incrementSessionShareCount(sessionId);
            trackShareCompleted("generic", {
              sessionId,
              variant,
              aspectRatio,
              surface,
            });
            return { success: true };
          }
        }

        // Fall back to copy link
        const copySuccess = await copyShareUrl(sessionId);
        if (!copySuccess) {
          throw new Error("Failed to copy link");
        }

        await trackShare("generic", {
          sessionId,
          userId,
          variant,
          aspectRatio,
          shareUrl: shareData.url,
          surface,
        });

        await incrementSessionShareCount(sessionId);
        trackShareCompleted("generic", {
          sessionId,
          variant,
          aspectRatio,
          surface,
        });

        return {
          success: true,
          data: {
            copiedLink: true,
            message: "Link copied!",
            description: "Share link copied to clipboard",
          },
        };
      }

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  } catch (error) {
    trackShareFailed(platform, {
      sessionId,
      variant,
      aspectRatio,
      error: error instanceof Error ? error.message : "Unknown error",
      surface,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Share failed",
    };
  }
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
  const [copiedLink, setCopiedLink] = useState(false);

  // Use server action hooks for platform sharing
  const shareAction = useServerAction(
    async (platform: SharePlatform) => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Auto-make session public before sharing if needed
      if (!session.is_public) {
        const publicResult = await makeSessionPublicAction(sessionId);

        if (!publicResult.success) {
          // Show specific error for privacy update failure
          toast({
            title: "Failed to make session public",
            description: publicResult.error || "Please try again or check your permissions",
            variant: "destructive",
          });
          throw new Error(publicResult.error || "Failed to make session public");
        }

        // Update parent component with new session state
        // Handle both cases: when data is present and when it's just success: true
        if (onSessionUpdated) {
          const updatedSession = publicResult.data || { ...session, is_public: true };
          onSessionUpdated(updatedSession);
        }

        toast({
          title: "Session is now public",
          description: "Your session can now be shared with others",
        });
      }

      // Track platform selection
      trackSharePlatformSelected(platform, {
        sessionId,
        variant: selectedVariant,
        aspectRatio: selectedRatio,
        surface,
      });

      return executePlatformShare(
        platform,
        session,
        sessionId,
        user.id,
        selectedVariant,
        selectedRatio,
        surface
      );
    },
    {
      onSuccess: (data) => {
        if (data?.message) {
          toast({
            title: data.message,
            description: data.description,
            duration: data.message.includes("downloaded") ? 5000 : undefined,
          });
        }

        if (data?.copiedLink) {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
        }
      },
      onError: (error) => {
        // Don't show toast if it's already been shown for privacy update failure
        if (!error.includes("Failed to make session public")) {
          toast({
            title: "Share failed",
            description: error,
            variant: "destructive",
          });
        }
      },
    }
  );

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

      // Execute the share action (which handles making session public if needed)
      await shareAction.execute(platform);
    },
    [user, shareAction]
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
          disabled={shareAction.loading}
          aria-label="Share to Instagram"
          className="flex items-center gap-2"
        >
          {shareAction.loading ? (
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
          disabled={shareAction.loading}
          aria-label="Share to X (Twitter)"
          className="flex items-center gap-2"
        >
          {shareAction.loading ? (
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
          disabled={shareAction.loading}
          aria-label="Share to Facebook"
          className="flex items-center gap-2"
        >
          {shareAction.loading ? (
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
          disabled={shareAction.loading}
          aria-label="Download image"
          className="flex items-center gap-2"
        >
          {shareAction.loading ? (
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
          disabled={shareAction.loading}
          aria-label="Share link"
          className="flex items-center gap-2"
        >
          {shareAction.loading ? (
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
