"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIntelData } from "@/hooks/use-intel-data";

// Lazy load modal form since it's not needed on initial render
const IntelPostForm = dynamic(
  () => import("./intel-post-form").then((m) => m.IntelPostForm),
  { ssr: false }
);
import { useAuth } from "@/context/auth-context";
import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel-actions";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getDisplayName, cleanTitle } from "@/lib/utils/display-name-utils";
import { validateCoordinates } from "@/lib/coordinate-validation";
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
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
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
import { PartialContentGate } from "@/components/ui/partial-content-gate";

interface BeachIntelSectionProps {
  beachId: string;
  beachName: string;
  latitude: number;
  longitude: number;
  beach?: { slug?: string | null; city?: string | null; state?: string | null }; // Beach location data for hierarchical URLs
  className?: string;
  initialShowAll?: boolean;
  navigateOnViewAll?: boolean; // when true, clicking View all navigates to beach page
  publicMode?: boolean;
  previewCount?: number;
}

export function BeachIntelSection({
  beachId,
  beachName,
  latitude,
  longitude,
  beach,
  className = "",
  initialShowAll = false,
  navigateOnViewAll = true,
  publicMode = false,
  previewCount = 1,
}: BeachIntelSectionProps) {
  const router = useRouter();
  const [showPostForm, setShowPostForm] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<boolean>(initialShowAll);
  const [confirmingPosts, setConfirmingPosts] = useState<Set<string>>(
    new Set()
  );
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, { user_has_confirmed: boolean; confirmations_count: number }>
  >({});
  const [pendingPosts, setPendingPosts] = useState<IntelPostWithUser[]>([]);
  const { user } = useAuth();

  // Validate coordinates in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      if (!validateCoordinates(latitude, longitude, `Beach: ${beachName}`)) {
        console.warn(
          `⚠️ BeachIntelSection received invalid coordinates for ${beachName}`
        );
        console.warn(`  Beach ID: ${beachId}`);
        console.warn(`  Latitude: ${latitude}`);
        console.warn(`  Longitude: ${longitude}`);
      }
    }
  }, [latitude, longitude, beachName, beachId]);

  // Fetch intel data for this beach location
  const {
    data: intelData,
    loading,
    error,
    refetch,
  } = useIntelData({
    latitude,
    longitude,
    radius: 5, // 5 mile radius for beach-specific intel
    limit: 10,
    enabled: true,
  });

  // Apply optimistic updates to posts data
  const posts = useMemo(() => {
    const basePosts = intelData?.posts || [];
    const combined = [...pendingPosts, ...basePosts];
    const seen = new Set<string>();

    const deduped = combined.filter((post) => {
      if (!post?.id) return false;
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });

    const mapped = deduped.map((post) => {
      const optimisticUpdate = optimisticUpdates[post.id];
      if (optimisticUpdate) {
        return {
          ...post,
          user_has_confirmed: optimisticUpdate.user_has_confirmed,
          confirmations_count: optimisticUpdate.confirmations_count,
        };
      }
      return post;
    });

    // Sort by recency (newest first)
    mapped.sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return mapped;
  }, [intelData?.posts, optimisticUpdates, pendingPosts]);

  useEffect(() => {
    if (!intelData?.posts) return;
    setPendingPosts((prev) =>
      prev.filter(
        (pending) => !intelData.posts.some((post) => post.id === pending.id)
      )
    );
  }, [intelData?.posts]);

  // Handle intel post confirmation with optimistic updates
  const handleConfirmPost = useCallback(
    async (postId: string, isCurrentlyConfirmed: boolean) => {
      if (!user) {
        toast.error("Please sign in to vote on intel posts");
        return;
      }

      // Find the current post to get its current count
      const currentPost = posts.find((post) => post.id === postId);
      if (!currentPost) {
        toast.error("Post not found");
        return;
      }

      // Set loading state
      setConfirmingPosts((prev) => new Set(prev).add(postId));

      // Apply optimistic update immediately
      const optimisticConfirmed = !isCurrentlyConfirmed;
      const optimisticCount = isCurrentlyConfirmed
        ? Math.max(0, currentPost.confirmations_count - 1)
        : currentPost.confirmations_count + 1;

      setOptimisticUpdates((prev) => ({
        ...prev,
        [postId]: {
          user_has_confirmed: optimisticConfirmed,
          confirmations_count: optimisticCount,
        },
      }));

      try {
        // Make the API call
        const result = isCurrentlyConfirmed
          ? await removeIntelPostConfirmation(postId)
          : await confirmIntelPost(postId);

        if (result.success) {
          toast.success(
            isCurrentlyConfirmed
              ? "Vote removed"
              : "Thanks for confirming this intel!"
          );

          // Clear optimistic update and refetch to get server state
          setOptimisticUpdates((prev) => {
            const next = { ...prev };
            delete next[postId];
            return next;
          });
          refetch();
        } else {
          toast.error(result.error || "Failed to update vote");
          // Revert optimistic update on API error
          setOptimisticUpdates((prev) => {
            const next = { ...prev };
            delete next[postId];
            return next;
          });
        }
      } catch (error) {
        console.error("Confirmation error:", error);
        toast.error("Failed to update vote");
        // Revert optimistic update on API error
        setOptimisticUpdates((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
      } finally {
        // Remove loading state
        setConfirmingPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [user, posts, refetch]
  );

  const handlePostCreated = useCallback(
    (newPost: IntelPostWithUser | null) => {
      setShowPostForm(false);
      // Always notify success when the form reports completion
      toast.success("Intel post created successfully!");
      if (newPost) {
        setPendingPosts((prev) => [
          newPost,
          ...prev.filter((post) => post.id !== newPost.id),
        ]);
      }
      refetch();
    },
    [refetch]
  );

  if (loading && posts.length === 0) {
    return (
      <Card
        id="intel-section"
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
        id="intel-section"
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

            {!publicMode && (
              <Button
                data-testid="add-intel"
                onClick={() => setShowPostForm(true)}
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Intel
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          {error ? (
            <div className="text-center py-6">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Unable to load intel posts
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try Again
                </Button>
                {/* Dev-only: Always allow mock users to add intel even if list failed to load */}
                {typeof window !== "undefined" &&
                  process.env.NODE_ENV !== "production" && (
                    <Button
                      data-testid="add-intel"
                      size="sm"
                      onClick={() => setShowPostForm(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Intel
                    </Button>
                  )}
              </div>
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
                data-testid="add-intel"
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
              {posts
                .slice(0, publicMode ? previewCount : showAll ? posts.length : 3)
                .map((post) => (
                  <IntelPostCard
                    key={post.id}
                    post={post}
                    onConfirm={handleConfirmPost}
                    canConfirm={!!user}
                    isExpanded={expandedPost === post.id}
                    onToggleExpand={() =>
                      setExpandedPost(expandedPost === post.id ? null : post.id)
                    }
                    isConfirming={confirmingPosts.has(post.id)}
                  />
                ))}

              {publicMode && posts.length > previewCount && (
                <PartialContentGate
                  contentType="intel posts"
                  totalCount={posts.length}
                  previewCount={previewCount}
                />
              )}

              {!publicMode && posts.length > 3 && (
                <div className="pt-2 border-t border-blue-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (!showAll && navigateOnViewAll) {
                        // Generate hierarchical URL with safe fallback chain
                        const baseUrl = beach
                          ? getBeachHrefSafe({ id: beachId, ...beach })
                          : getBeachHrefSafe({ id: beachId });
                        if (!baseUrl) return;
                        router.push(`${baseUrl}?section=intel&show=all`);
                        return;
                      }
                      setShowAll((v) => !v);
                    }}
                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    {showAll ? (
                      <>Show less</>
                    ) : (
                      <>
                        View all {posts.length} intel posts
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
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
        beachId={beachId}
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
  isConfirming: boolean;
}

function IntelPostCard({
  post,
  onConfirm,
  canConfirm,
  isExpanded,
  onToggleExpand,
  isConfirming,
}: IntelPostCardProps) {
  const tagConfig = getIntelTagConfig(post.tag);
  const isConfirmed = post.user_has_confirmed ?? false;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
  });

  return (
    <div className="bg-white/70 rounded-xl border border-blue-100/80 p-4 transition-all duration-200 hover:bg-white/90 hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        <UserAvatarButton
          userId={post.user_id}
          src={post.user?.avatar_url ?? undefined}
          name={getDisplayName(post.user?.full_name ?? "Anonymous", post.id)}
          size="sm"
          className="ring-2 ring-white shadow-sm"
        />

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
                  {tagConfig.emoji}
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
                {cleanTitle(post.title, tagConfig.emoji)}
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
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-600 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {post.beach_name || "Unknown Beach"}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              {canConfirm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onConfirm(post.id, isConfirmed)}
                  disabled={isConfirming}
                  className={cn(
                    "h-7 px-2 text-xs whitespace-nowrap transition-all duration-200 shrink-0",
                    isConfirmed
                      ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "text-gray-600 hover:bg-blue-50 hover:text-blue-700",
                    isConfirming && "opacity-50 cursor-wait"
                  )}
                >
                  {isConfirming ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <ThumbsUp
                      className={cn(
                        "h-3 w-3 mr-1 transition-transform duration-200",
                        isConfirmed && "scale-110"
                      )}
                    />
                  )}
                  {isConfirming
                    ? "Processing…"
                    : isConfirmed
                      ? "Confirmed"
                      : "Confirm"}
                </Button>
              )}

              {post.description.length > 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpand}
                  className="h-7 px-2 text-xs text-gray-600 hover:text-gray-800 whitespace-nowrap shrink-0"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {isExpanded ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
