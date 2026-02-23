"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import {
  Check,
  CheckCheck,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
} from "lucide-react";
import {
  getIntelTagConfig,
  getConfidenceLevel,
  getConfidenceColor,
  getConfidenceLabel,
} from "@/lib/constants/intel";
import { INTEL_UI_TEXT } from "@/lib/constants/intel";
import type { IntelPostWithUser } from "@/types/database";
import { cn } from "@/lib/utils";
import { getNearestBeachName } from "@/lib/utils/nearest-beach";
import { useMemo } from "react";
import Image from "next/image";
import {
  ConditionsIntelCard,
  getMorningIntelPayloadV2,
} from "@/components/intel/conditions-intel-card";

interface IntelPostModalProps {
  post: IntelPostWithUser;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (postId: string, isCurrentlyConfirmed: boolean) => void;
  onPlanSession: (post: IntelPostWithUser) => void;
  canConfirm: boolean;
}

export function IntelPostModal({
  post,
  isOpen,
  onClose,
  onConfirm,
  onPlanSession,
  canConfirm,
}: IntelPostModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const hasUserConfirmed = post.user_has_confirmed ?? false;

  const tagConfig = getIntelTagConfig(post.tag);
  const confidenceLevel = getConfidenceLevel(post.confirmations_count);
  const confidenceColor = getConfidenceColor(post.confirmations_count);
  const confidenceLabel = getConfidenceLabel(post.confirmations_count);

  const handleConfirm = async () => {
    if (!canConfirm || isConfirming) return;

    setIsConfirming(true);
    try {
      await onConfirm(post.id, hasUserConfirmed);
    } finally {
      setIsConfirming(false);
    }
  };

  const handlePlanSession = () => {
    onPlanSession(post);
    onClose();
  };

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  const nearestBeach = useMemo(
    () => getNearestBeachName(post.latitude, post.longitude),
    [post.latitude, post.longitude]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{tagConfig.emoji}</span>
            <span>{post.title}</span>
            {isExpired && (
              <Badge variant="secondary" className="text-xs">
                Expired
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Intel Type Badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn("text-white", tagConfig.color)}
            >
              {tagConfig.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {tagConfig.description}
            </span>
          </div>

          {/* Description */}
          <div>
            {post.tag === "conditions" && getMorningIntelPayloadV2(post.surf_conditions) ? (
              <ConditionsIntelCard post={post} variant="modal" />
            ) : (
              <p className="text-sm leading-relaxed">{post.description}</p>
            )}
          </div>

          {/* Photo */}
          {post.photo_url && (
            <div className="relative h-48 rounded-lg overflow-hidden">
              <Image
                src={post.photo_url}
                alt="Intel photo"
                fill
                sizes="100vw"
                className="object-cover"
                priority={false}
              />
            </div>
          )}

          {/* Author and Time */}
          <div className="flex items-center gap-3">
            <UserAvatar
              src={post.user?.avatar_url}
              name={post.user?.full_name}
              size="sm"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {post.user?.full_name || "Anonymous"}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{nearestBeach}</span>
          </div>

          {/* Confirmations */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">
                {post.confirmations_count} confirmations
              </span>
            </div>
            <Badge variant="outline" className={confidenceColor}>
              {confidenceLabel}
            </Badge>
          </div>

          {/* Expiry Information */}
          {post.expires_at && (
            <div className="text-xs text-muted-foreground">
              {isExpired ? (
                <span className="text-red-500">
                  Expired{" "}
                  {formatDistanceToNow(new Date(post.expires_at), {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <span>
                  Expires{" "}
                  {formatDistanceToNow(new Date(post.expires_at), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {/* Confirm Button */}
            {canConfirm && !isExpired && (
              <Button
                variant={hasUserConfirmed ? "secondary" : "default"}
                size="sm"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex-1"
              >
                {isConfirming ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Updating...</span>
                  </div>
                ) : hasUserConfirmed ? (
                  <div className="flex items-center gap-2">
                    <CheckCheck className="h-4 w-4" />
                    <span>{INTEL_UI_TEXT.CONFIRMED_BUTTON}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    <span>{INTEL_UI_TEXT.CONFIRM_BUTTON}</span>
                  </div>
                )}
              </Button>
            )}

            {/* Plan Session Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlanSession}
              className="flex-1"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                <span>{INTEL_UI_TEXT.PLAN_SESSION_BUTTON}</span>
              </div>
            </Button>
          </div>

          {/* Help Text for Unauthenticated Users */}
          {!canConfirm && (
            <div className="text-xs text-center text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {post.user_id === undefined
                ? "Sign in to confirm intel posts and help the community"
                : "You cannot confirm your own intel posts"}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
