"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarButton } from "@/components/social/user-avatar-button";
import { IntelPostModal } from "./intel-post-modal";
import {
  Check,
  CheckCheck,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
  AlertTriangle,
  MessageCircle,
  PenSquare,
} from "lucide-react";
import {
  getIntelTagConfig,
  getConfidenceColor,
  getConfidenceLabel,
} from "@/lib/constants/intel";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";
import { cn } from "@/lib/utils";
import { ZeroState } from "@/components/ui/zero-state";
import { getNearestBeachName } from "@/lib/utils/nearest-beach";
import {
  ConditionsIntelCard,
  getMorningIntelPayloadV2,
} from "@/components/intel/conditions-intel-card";
import { getTransformedUrl } from "@/lib/utils/image-utils";

interface IntelFeedProps {
  posts: IntelPostWithUser[];
  loading?: boolean;
  onPostClick?: (post: IntelPostWithUser) => void;
  onConfirm: (postId: string, isCurrentlyConfirmed: boolean) => void;
  onPlanSession: (post: IntelPostWithUser) => void;
  onShareIntel?: () => void;
  canConfirm: boolean;
  selectedTag?: IntelPostTag | "all";
  className?: string;
}

export function IntelFeed({
  posts,
  loading = false,
  onPostClick,
  onConfirm,
  onPlanSession,
  onShareIntel,
  canConfirm,
  selectedTag = "all",
  className = "",
}: IntelFeedProps) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Derive the modal post from the current posts array so optimistic updates
  // (confirmations_count, user_has_confirmed) are reflected while the modal is open.
  const selectedPost = selectedPostId
    ? posts.find((p) => p.id === selectedPostId) ?? null
    : null;

  const handlePostClick = (post: IntelPostWithUser) => {
    setSelectedPostId(post.id);
    setModalOpen(true);
    onPostClick?.(post);
  };

  const handleConfirm = async (
    postId: string,
    isCurrentlyConfirmed: boolean
  ) => {
    await onConfirm(postId, isCurrentlyConfirmed);
  };

  const handlePlanSession = (post: IntelPostWithUser) => {
    onPlanSession(post);
  };

  // Filter posts by selected tag
  const filteredPosts =
    selectedTag === "all"
      ? posts
      : posts.filter((post) => post.tag === selectedTag);

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (filteredPosts.length === 0) {
    return (
      <ZeroState
        icon={MessageCircle}
        title="No Local Intel Yet"
        description="Be the first to share what's happening at this spot"
        action={
          onShareIntel
            ? {
                label: "Share Intel",
                onClick: onShareIntel,
                icon: PenSquare,
              }
            : undefined
        }
        className={className}
      />
    );
  }

  return (
    <>
      <div className={cn("space-y-4", className)}>
        {filteredPosts.map((post) => (
          <IntelFeedCard
            key={post.id}
            post={post}
            onPostClick={handlePostClick}
            onConfirm={handleConfirm}
            onPlanSession={handlePlanSession}
            canConfirm={canConfirm}
          />
        ))}
      </div>

      {/* Intel Post Modal */}
      {selectedPost && (
        <IntelPostModal
          post={selectedPost}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedPostId(null);
          }}
          onConfirm={handleConfirm}
          onPlanSession={handlePlanSession}
          canConfirm={canConfirm}
        />
      )}
    </>
  );
}

export interface IntelFeedCardProps {
  post: IntelPostWithUser;
  onPostClick: (post: IntelPostWithUser) => void;
  onConfirm: (postId: string, isCurrentlyConfirmed: boolean) => void;
  onPlanSession: (post: IntelPostWithUser) => void;
  canConfirm: boolean;
  isConfirming?: boolean;
}

export function IntelFeedCard({
  post,
  onPostClick,
  onConfirm,
  onPlanSession,
  canConfirm,
  isConfirming: externalIsConfirming,
}: IntelFeedCardProps) {
  const [internalIsConfirming, setInternalIsConfirming] = useState(false);
  const isConfirming = externalIsConfirming ?? internalIsConfirming;
  const hasUserConfirmed = Boolean((post as any).user_has_confirmed);

  const tagConfig = getIntelTagConfig(post.tag);
  const confidenceColor = getConfidenceColor(post.confirmations_count);
  const confidenceLabel = getConfidenceLabel(post.confirmations_count);
  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  const nearestBeach = useMemo(
    () => getNearestBeachName(Number(post.latitude), Number(post.longitude)),
    [post.latitude, post.longitude]
  );

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canConfirm || isConfirming) return;

    // Only use internal state if external isConfirming is not provided
    if (externalIsConfirming === undefined) {
      setInternalIsConfirming(true);
    }
    try {
      await onConfirm(post.id, hasUserConfirmed);
    } finally {
      if (externalIsConfirming === undefined) {
        setInternalIsConfirming(false);
      }
    }
  };

  const handlePlanSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlanSession(post);
  };

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onPostClick(post)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <UserAvatarButton
              userId={post.user_id}
              src={post.user?.avatar_url ?? undefined}
              name={post.user?.full_name ?? "Anonymous"}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{tagConfig.emoji}</span>
                <h3 className="font-medium text-sm truncate">{post.title}</h3>
                {isExpired && (
                  <Badge variant="secondary" className="text-xs">
                    Expired
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{post.user?.full_name || "Anonymous"}</span>
                <span>•</span>
                <Calendar className="h-3 w-3" />
                <span>
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("text-white text-xs", tagConfig.color)}
            >
              {tagConfig.label}
            </Badge>
          </div>

          {/* Description */}
          {post.tag === "conditions" && getMorningIntelPayloadV2(post.surf_conditions) ? (
            <ConditionsIntelCard post={post} variant="feed" />
          ) : (
            <p className="text-sm leading-relaxed line-clamp-3">
              {post.description}
            </p>
          )}

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{nearestBeach}</span>
          </div>

          {/* Photo - using Supabase image transformations for optimized delivery */}
          {post.photo_url && (
            <div className="relative h-32 rounded-lg overflow-hidden">
              <Image
                src={getTransformedUrl(post.photo_url, 'intelPost')}
                alt="Intel photo"
                fill
                loading="lazy"
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}

          {/* Stats and Actions */}
          <div className="flex items-center justify-between pt-2">
            {/* Confirmations */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{post.confirmations_count} confirmations</span>
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs", confidenceColor)}
              >
                {confidenceLabel}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Confirm Button */}
              {canConfirm && !isExpired && (
                <Button
                  variant={hasUserConfirmed ? "secondary" : "default"}
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="h-8 px-3 text-xs"
                >
                  {isConfirming ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : hasUserConfirmed ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
              )}

              {/* Plan Session Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlanSession}
                className="h-8 px-3 text-xs"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Expiry Warning */}
          {isExpired && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              <AlertTriangle className="h-3 w-3" />
              <span>
                This intel expired{" "}
                {formatDistanceToNow(new Date(post.expires_at!), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
