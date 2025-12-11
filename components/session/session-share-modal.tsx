"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Instagram,
  Twitter,
  Facebook,
  Copy,
  Share2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { shareSession } from "@/lib/mobile/share";
import {
  trackSessionShare,
  generateShareUrl,
  generateShareImageUrl,
  type SharePlatform,
  type LegacyShareVariant,
} from "@/actions/social-share-actions";
import { track } from "@/lib/analytics";

interface SessionShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  beachName: string;
  shareCount?: number;
}

interface PlatformOption {
  id: SharePlatform;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PLATFORMS: PlatformOption[] = [
  {
    id: "instagram",
    name: "Instagram",
    icon: <Instagram className="h-5 w-5" />,
    color: "text-pink-600",
    bgColor: "bg-pink-50 hover:bg-pink-100",
  },
  {
    id: "twitter",
    name: "Twitter",
    icon: <Twitter className="h-5 w-5" />,
    color: "text-blue-500",
    bgColor: "bg-blue-50 hover:bg-blue-100",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: <Facebook className="h-5 w-5" />,
    color: "text-blue-700",
    bgColor: "bg-blue-50 hover:bg-blue-100",
  },
  {
    id: "copy",
    name: "Copy Link",
    icon: <Copy className="h-5 w-5" />,
    color: "text-gray-600",
    bgColor: "bg-gray-50 hover:bg-gray-100",
  },
];

export function SessionShareModal({
  isOpen,
  onClose,
  sessionId,
  beachName,
  shareCount = 0,
}: SessionShareModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<LegacyShareVariant>("story");
  const [isSharing, setIsSharing] = useState(false);
  const [sharedPlatforms, setSharedPlatforms] = useState<Set<SharePlatform>>(
    new Set()
  );

  const handleShare = useCallback(
    async (platform: SharePlatform) => {
      setIsSharing(true);

      try {
        // Track analytics event
        track("share_platform_selected", {
          surface: "session_share_modal",
          sessionId,
          platform,
          variant: selectedVariant,
        });

        const shareUrl = await generateShareUrl({
          sessionId,
          platform,
          variant: selectedVariant,
        });

        // Handle different platforms
        if (platform === "copy") {
          // Copy to clipboard
          await navigator.clipboard.writeText(shareUrl);
          toast.success("Link copied to clipboard!");

          // Track the share
          await trackSessionShare({
            sessionId,
            platform,
            variant: selectedVariant,
          });

          setSharedPlatforms((prev) => new Set([...prev, platform]));
        } else if (platform === "instagram" || platform === "tiktok") {
          // For Instagram/TikTok, use native share with image
          try {
            const imageUrl = await generateShareImageUrl(
              sessionId,
              selectedVariant
            );

            // Use native share if available
            const result = await shareSession(sessionId, {
              title: `Surf Session at ${beachName}`,
              text: "Check out my surf session on Quiver!",
              url: shareUrl,
              analytics: {
                surface: "session_share_modal",
                sessionId,
                variant: selectedVariant,
              },
              fallback: async () => {
                // Fallback: open image in new tab for manual sharing
                window.open(imageUrl, "_blank");
                toast.info(
                  `Opening share image. Save and share to ${
                    platform.charAt(0).toUpperCase() + platform.slice(1)
                  }!`
                );
              },
            });

            if (result.method !== "unsupported") {
              // Track the share
              await trackSessionShare({
                sessionId,
                platform,
                variant: selectedVariant,
              });

              setSharedPlatforms((prev) => new Set([...prev, platform]));
              toast.success(`Shared to ${platform}!`);
            }
          } catch (error) {
            console.error("Share failed:", error);
            toast.error("Failed to share. Please try again.");
          }
        } else {
          // For other platforms, use native share or window.open
          try {
            const result = await shareSession(sessionId, {
              title: `Surf Session at ${beachName}`,
              text: "Check out my surf session on Quiver!",
              url: shareUrl,
              analytics: {
                surface: "session_share_modal",
                sessionId,
                variant: selectedVariant,
              },
              fallback: async () => {
                // Open share URL in new window
                window.open(shareUrl, "_blank");
              },
            });

            if (result.method !== "unsupported") {
              await trackSessionShare({
                sessionId,
                platform,
                variant: selectedVariant,
              });

              setSharedPlatforms((prev) => new Set([...prev, platform]));
              toast.success(`Shared to ${platform}!`);
            }
          } catch (error) {
            console.error("Share failed:", error);
            toast.error("Failed to share. Please try again.");
          }
        }

        track("share_completed", {
          surface: "session_share_modal",
          sessionId,
          platform,
          variant: selectedVariant,
        });
      } catch (error) {
        console.error("Share error:", error);
        toast.error("Failed to share. Please try again.");

        track("share_failed", {
          surface: "session_share_modal",
          sessionId,
          platform,
          variant: selectedVariant,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSharing(false);
      }
    },
    [sessionId, beachName, selectedVariant]
  );

  const handleClose = () => {
    // Track modal close
    track("share_modal_closed", {
      surface: "session_share_modal",
      sessionId,
      sharedCount: sharedPlatforms.size,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Session</DialogTitle>
          <DialogDescription>
            {beachName} • Shared {shareCount} {shareCount === 1 ? "time" : "times"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Variant Selection */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Format</div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectedVariant === "story" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedVariant("story")}
                className="flex-1"
              >
                Story (9:16)
              </Button>
              <Button
                type="button"
                variant={selectedVariant === "square" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedVariant("square")}
                className="flex-1"
              >
                Square (1:1)
              </Button>
            </div>
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Share to</div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((platform) => {
                const isShared = sharedPlatforms.has(platform.id);

                return (
                  <Button
                    key={platform.id}
                    type="button"
                    variant="outline"
                    className={`flex items-center justify-start gap-3 ${
                      platform.bgColor
                    } border-2 ${
                      isShared
                        ? "border-green-500 bg-green-50"
                        : "border-transparent"
                    }`}
                    onClick={() => handleShare(platform.id)}
                    disabled={isSharing}
                  >
                    <span className={platform.color}>{platform.icon}</span>
                    <span className="flex-1 text-left">{platform.name}</span>
                    {isShared && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {isSharing && (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Growth Hook */}
          {shareCount === 0 && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">Be the first to share! 🌊</p>
              <p className="mt-1 text-blue-700">
                Help grow the Quiver community by sharing your sessions with friends.
              </p>
            </div>
          )}

          {shareCount > 0 && shareCount < 3 && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-900">
              <p className="font-medium">Keep it going! 🚀</p>
              <p className="mt-1 text-green-700">
                Share to 2 more platforms to unlock detailed insights.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
