"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { IntelPostModal } from "./intel-post-modal";
import {
  Check,
  CheckCheck,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  getIntelTagConfig,
  getConfidenceColor,
  getConfidenceLabel,
} from "@/lib/constants/intel";
import { INTEL_UI_TEXT } from "@/lib/constants/intel";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";
import { cn } from "@/lib/utils";

interface IntelFeedProps {
  posts: IntelPostWithUser[];
  loading?: boolean;
  onPostClick?: (post: IntelPostWithUser) => void;
  onConfirm: (postId: string, isCurrentlyConfirmed: boolean) => void;
  onPlanSession: (post: IntelPostWithUser) => void;
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
  canConfirm,
  selectedTag = "all",
  className = "",
}: IntelFeedProps) {
  const [selectedPost, setSelectedPost] = useState<IntelPostWithUser | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  const handlePostClick = (post: IntelPostWithUser) => {
    setSelectedPost(post);
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
      <div className={cn("text-center py-8", className)}>
        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium">
              {INTEL_UI_TEXT.EMPTY_STATE.TITLE}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {INTEL_UI_TEXT.EMPTY_STATE.DESCRIPTION}
            </p>
          </div>
        </div>
      </div>
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
            setSelectedPost(null);
          }}
          onConfirm={handleConfirm}
          onPlanSession={handlePlanSession}
          canConfirm={canConfirm}
        />
      )}
    </>
  );
}

interface IntelFeedCardProps {
  post: IntelPostWithUser;
  onPostClick: (post: IntelPostWithUser) => void;
  onConfirm: (postId: string, isCurrentlyConfirmed: boolean) => void;
  onPlanSession: (post: IntelPostWithUser) => void;
  canConfirm: boolean;
}

function IntelFeedCard({
  post,
  onPostClick,
  onConfirm,
  onPlanSession,
  canConfirm,
}: IntelFeedCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const tagConfig = getIntelTagConfig(post.tag);
  const confidenceColor = getConfidenceColor(post.confirmations_count);
  const confidenceLabel = getConfidenceLabel(post.confirmations_count);
  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canConfirm || isConfirming) return;

    setIsConfirming(true);
    try {
      await onConfirm(post.id, post.user_confirmed || false);
    } finally {
      setIsConfirming(false);
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
            <UserAvatar
              src={post.user.avatar_url}
              name={post.user.full_name}
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
                <span>{post.user.full_name || "Anonymous"}</span>
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
          <p className="text-sm leading-relaxed line-clamp-3">
            {post.description}
          </p>

          {/* Photo */}
          {post.photo_url && (
            <div className="rounded-lg overflow-hidden">
              <img
                src={post.photo_url}
                alt="Intel photo"
                className="w-full h-32 object-cover"
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
                  variant={post.user_confirmed ? "secondary" : "default"}
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="h-8 px-3 text-xs"
                >
                  {isConfirming ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : post.user_confirmed ? (
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
