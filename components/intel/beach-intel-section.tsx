"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntelPostForm } from "./intel-post-form";
import { useIntelData } from "@/hooks/use-intel-data";
import { useAuth } from "@/context/auth-context";
import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel-actions";
import {
  Plus,
  MessageSquare,
  ChevronRight,
  Users,
  MapPin,
  Clock,
  ThumbsUp,
  Loader2,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarButton } from "@/components/social/user-avatar-button";
import {
  getIntelTagConfig,
  getConfidenceColor,
  getConfidenceLabel,
} from "@/lib/constants/intel";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";
import { getNearestBeachName } from "@/lib/utils/nearest-beach";
import { useMemo } from "react";

interface BeachIntelSectionProps {
  beachId: string;
  beachName: string;
  latitude: number;
  longitude: number;
  className?: string;
}

export function BeachIntelSection({
  beachId,
  beachName,
  latitude,
  longitude,
  className = "",
}: BeachIntelSectionProps) {
  const [showPostForm, setShowPostForm] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch intel data for this beach location
  const {
    data: intelData,
    loading,
    error,
    refetch,
  } = useIntelData({
    latitude,
    longitude,
    radius: 2, // 2 mile radius for beach-specific intel
    limit: 10,
    enabled: true,
  });

  const posts = intelData?.posts || [];

  // Handle intel post confirmation
  const handleConfirmPost = useCallback(
    async (postId: string, isCurrentlyConfirmed: boolean) => {
      if (!user) {
        toast.error("Please sign in to vote on intel posts");
        return;
      }

      try {
        const result = isCurrentlyConfirmed
          ? await removeIntelPostConfirmation(postId)
          : await confirmIntelPost(postId);

        if (result.success) {
          toast.success(
            isCurrentlyConfirmed
              ? "Vote removed"
              : "Thanks for confirming this intel!"
          );
          refetch();
        } else {
          toast.error(result.error || "Failed to update vote");
        }
      } catch (error) {
        toast.error("Failed to update vote");
      }
    },
    [user, refetch]
  );

  const handlePostCreated = useCallback(() => {
    setShowPostForm(false);
    refetch();
    toast.success("Intel post created successfully!");
  }, [refetch]);

  if (loading && posts.length === 0) {
    return (
      <Card
        className={cn(
          "overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg",
          className
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-roboto">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Local Intel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-white/60 rounded-xl p-4 border border-blue-100"
                data-testid="loading-skeleton"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg transition-all duration-300 hover:shadow-xl",
          className
        )}
      >
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Local Intel
              {posts.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 bg-blue-100 text-blue-700 border-blue-200"
                >
                  {posts.length}
                </Badge>
              )}
            </CardTitle>

            <Button
              onClick={() => setShowPostForm(true)}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Intel
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {error ? (
            <div className="text-center py-6">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Unable to load intel posts
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                No local intel yet
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Be the first to share intel about {beachName}
              </p>
              <Button
                onClick={() => setShowPostForm(true)}
                size="sm"
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add First Intel
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.slice(0, 3).map((post) => (
                <IntelPostCard
                  key={post.id}
                  post={post}
                  onConfirm={handleConfirmPost}
                  canConfirm={!!user}
                  isExpanded={expandedPost === post.id}
                  onToggleExpand={() =>
                    setExpandedPost(expandedPost === post.id ? null : post.id)
                  }
                />
              ))}

              {posts.length > 3 && (
                <div className="pt-2 border-t border-blue-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    View all {posts.length} intel posts
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intel Post Form */}
      <IntelPostForm
        isOpen={showPostForm}
        onClose={() => setShowPostForm(false)}
        onSuccess={handlePostCreated}
        initialLocation={{ latitude, longitude }}
      />
    </>
  );
}

// Modern Intel Post Card Component
interface IntelPostCardProps {
  post: IntelPostWithUser;
  onConfirm: (postId: string, isCurrentlyConfirmed: boolean) => void;
  canConfirm: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function IntelPostCard({
  post,
  onConfirm,
  canConfirm,
  isExpanded,
  onToggleExpand,
}: IntelPostCardProps) {
  const tagConfig = getIntelTagConfig(post.tag);
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
  });

  const nearestBeach = useMemo(
    () => getNearestBeachName(Number(post.latitude), Number(post.longitude)),
    [post.latitude, post.longitude]
  );

  return (
    <div className="bg-white/70 rounded-xl border border-blue-100/80 p-4 transition-all duration-200 hover:bg-white/90 hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        {post.user?.id ? (
          <UserAvatarButton
            userId={post.user.id}
            src={post.user?.avatar_url}
            name={post.user?.full_name}
            size="sm"
            className="ring-2 ring-white shadow-sm"
          />
        ) : (
          <UserAvatar
            src={post.user?.avatar_url}
            name={post.user?.full_name}
            size="sm"
            className="ring-2 ring-white shadow-sm"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  className={cn(
                    "text-xs font-medium px-2 py-1 transition-colors",
                    tagConfig.color
                  )}
                >
                  {tagConfig.icon}
                  <span className="ml-1">{tagConfig.label}</span>
                </Badge>

                {post.confirmations_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Users className="h-3 w-3" />
                    <span>{post.confirmations_count}</span>
                  </div>
                )}
              </div>

              <h4 className="font-medium text-sm text-gray-900 line-clamp-1">
                {post.title}
              </h4>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
          </div>

          {/* Description */}
          <p
            className={cn(
              "text-sm text-gray-700 transition-all duration-200",
              isExpanded ? "line-clamp-none" : "line-clamp-2"
            )}
          >
            {post.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <MapPin className="h-3 w-3" />
                <span>{nearestBeach}</span>
              </div>
              {canConfirm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfirm(post.id, post.user_has_confirmed)}
                  className={cn(
                    "h-7 px-2 text-xs transition-all duration-200",
                    post.user_has_confirmed
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                  )}
                >
                  <ThumbsUp
                    className={cn(
                      "h-3 w-3 mr-1 transition-transform duration-200",
                      post.user_has_confirmed && "scale-110"
                    )}
                  />
                  {post.user_has_confirmed ? "Confirmed" : "Confirm"}
                </Button>
              )}
            </div>

            {post.description.length > 100 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-7 px-2 text-xs text-gray-600 hover:text-gray-800"
              >
                <Eye className="h-3 w-3 mr-1" />
                {isExpanded ? "Show less" : "Show more"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
