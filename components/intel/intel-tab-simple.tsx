"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IntelPostForm } from "./intel-post-form";
import { IntelMap } from "./intel-map";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  MapIcon,
  List,
} from "lucide-react";
import { INTEL_UI_TEXT, INTEL_FILTERS } from "@/lib/constants/intel";
import {
  confirmIntelPost,
  removeIntelPostConfirmation,
  getAllIntelPosts,
} from "@/actions/intel-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";
import { IntelFeedCard } from "./intel-feed";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

interface IntelTabSimpleProps {
  className?: string;
}

type ViewMode = "feed" | "map";

export function IntelTabSimple({ className = "" }: IntelTabSimpleProps) {
  const [posts, setPosts] = useState<IntelPostWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedTag, setSelectedTag] = useState<IntelPostTag | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("feed");
  const [confirmingPosts, setConfirmingPosts] = useState<Set<string>>(
    new Set()
  );

  const { user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const hasTrackedViewRef = useRef(false);

  const canPost = !!user;
  const canConfirm = !!user;

  // Track when Local Intel tab is viewed
  useEffect(() => {
    if (hasTrackedViewRef.current) {
      return;
    }
    hasTrackedViewRef.current = true;
    track("local_intel_tab_viewed", {
      user_authenticated: !!user,
      post_count: posts.length,
    });
  }, [user, posts.length]);

  // Reset to feed view when component mounts to prevent map interference
  useEffect(() => {
    setViewMode("feed");
  }, []);

  // Fetch intel posts
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getAllIntelPosts({
        tag: selectedTag,
        limit: 50,
      });

      if (result.success) {
        setPosts(result.data.posts);
      } else {
        setError(result.error || "Failed to load intel posts");
      }
    } catch (err) {
      console.error("Error fetching intel posts:", err);
      setError("Failed to load intel posts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedTag]);

  // Initial fetch
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Real-time subscription for intel posts updates
  // Use a ref to avoid re-subscriptions when fetchPosts changes
  const fetchPostsRef = useRef(fetchPosts);

  useEffect(() => {
    fetchPostsRef.current = fetchPosts;
  }, [fetchPosts]);

  useEffect(() => {
    console.log("[IntelTab] Setting up realtime subscriptions...");

    // PERFORMANCE OPTIMIZATION: Only subscribe to recent intel posts
    // Subscribing to ALL intel posts (unfiltered) causes excessive realtime.list_changes() calls
    // Filter to posts created in the last 7 days to reduce database load
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoDateFilter = sevenDaysAgo.toISOString();

    const channels = [
      // Listen for changes to RECENT intel_posts only
      supabase
        .channel("intel_posts_updates_recent")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "intel_posts",
            // Filter: Only listen to posts created in last 7 days
            filter: `created_at=gte.${isoDateFilter}`,
          },
          (payload) => {
            console.log(
              "[IntelTab] Received intel_posts change:",
              payload.eventType
            );
            // Refetch posts when any intel post is created, updated, or deleted
            fetchPostsRef.current();
          }
        )
        .subscribe((status) => {
          console.log("[IntelTab] intel_posts subscription status:", status);
        }),

      // Listen for changes to intel_post_confirmations (already filtered via JOIN to recent posts)
      // Note: We can't directly filter confirmations by post date, but the fetchPosts query
      // already limits to recent posts, so stale confirmations won't appear anyway
      supabase
        .channel("intel_post_confirmations_updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "intel_post_confirmations",
          },
          (payload) => {
            console.log(
              "[IntelTab] Received intel_post_confirmations change:",
              payload.eventType
            );
            // Refetch posts when confirmations change
            fetchPostsRef.current();
          }
        )
        .subscribe((status) => {
          console.log(
            "[IntelTab] intel_post_confirmations subscription status:",
            status
          );
        }),
    ];

    return () => {
      console.log("[IntelTab] Cleaning up realtime subscriptions...");
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase]);

  // Handle post creation success
  const handlePostSuccess = useCallback(
    (newPost: IntelPostWithUser | null) => {
      if (newPost) {
        setPosts((prev) => [newPost, ...prev]);
        track("intel_post_created", {
          tag: newPost.tag,
          has_photo: !!newPost.photo_url,
        });
      }
      setShowPostForm(false);
      toast.success("Intel post created successfully!");
      fetchPosts(); // Refresh to get the latest data
    },
    [fetchPosts]
  );

  // Handle confirm post
  const handleConfirmPost = useCallback(
    async (postId: string, isCurrentlyConfirmed: boolean) => {
      if (!user) {
        toast.error("Please sign in to confirm posts");
        return;
      }

      setConfirmingPosts((prev) => new Set(prev).add(postId));

      try {
        const result = isCurrentlyConfirmed
          ? await removeIntelPostConfirmation(postId)
          : await confirmIntelPost(postId);

        if (result.success) {
          track("intel_post_confirmed", {
            action: isCurrentlyConfirmed ? "unconfirm" : "confirm",
            post_id: postId,
          });
          
          // Update the post in the list
          setPosts((prev) =>
            prev.map((post) => {
              if (post.id === postId) {
                return {
                  ...post,
                  confirmations_count: isCurrentlyConfirmed
                    ? (post.confirmations_count || 1) - 1
                    : (post.confirmations_count || 0) + 1,
                  user_has_confirmed: !isCurrentlyConfirmed,
                };
              }
              return post;
            })
          );
        } else {
          toast.error(result.error || "Failed to update confirmation");
        }
      } catch (error) {
        console.error("Error confirming post:", error);
        toast.error("Failed to update confirmation");
      } finally {
        setConfirmingPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      }
    },
    [user]
  );

  // Handle plan session
  const handlePlanSession = useCallback(
    (post: IntelPostWithUser) => {
      if (!user) {
        toast.error("Please sign in to plan sessions");
        router.push("/auth/sign-in");
        return;
      }

      track("plan_session_from_intel", {
        post_id: post.id,
        post_tag: post.tag,
        has_beach: !!post.beach_id,
      });

      // Navigate to session planner with beach context if available
      if (post.beach_id) {
        router.push(`/sessions/new?mode=plan&beach=${post.beach_id}`);
      } else {
        router.push("/sessions/new?mode=plan");
      }
    },
    [user, router]
  );

  // Filter posts by tag and ensure coordinates are numbers
  const filteredPosts = (
    selectedTag === "all"
      ? posts
      : posts.filter((post) => post.tag === selectedTag)
  ).map((post) => ({
    ...post,
    latitude: Number(post.latitude),
    longitude: Number(post.longitude),
  }));

  // Calculate map center from posts - returns [lat, lng] format for IntelMap
  const getMapCenter = (): [number, number] => {
    if (filteredPosts.length === 0) {
      // Default to San Diego [lat, lng]
      return [32.7157, -117.1611];
    }

    // Calculate average position from all posts
    const avgLng =
      filteredPosts.reduce((sum, post) => sum + Number(post.longitude), 0) /
      filteredPosts.length;
    const avgLat =
      filteredPosts.reduce((sum, post) => sum + Number(post.latitude), 0) /
      filteredPosts.length;

    return [avgLat, avgLng]; // Return [lat, lng] format
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Local Intel</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time updates from the surf community
              </p>
            </div>
            <div className="flex gap-2">
              {/* View Mode Toggle */}
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "feed" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("feed")}
                  className="h-8 px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "map" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  className="h-8 px-3"
                >
                  <MapIcon className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchPosts}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {canPost ? (
                <Button 
                  size="sm" 
                  onClick={() => {
                    track("share_intel_button_clicked", {
                      user_authenticated: true,
                      view_mode: viewMode,
                    });
                    setShowPostForm(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Share Intel
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    track("share_intel_signin_prompt", {
                      user_authenticated: false,
                    });
                    router.push("/auth/sign-in");
                  }}
                >
                  Sign In to Post
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tag Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {INTEL_FILTERS.TAG_OPTIONS.map((tag) => (
          <Badge
            key={tag.value}
            variant={selectedTag === tag.value ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setSelectedTag(tag.value as IntelPostTag | "all")}
          >
            {"emoji" in tag && tag.emoji && `${tag.emoji} `}
            {tag.label}
          </Badge>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Map View */}
      {viewMode === "map" && !loading && !error && (
        <div className="h-[600px] rounded-lg overflow-hidden border relative z-0">
          {filteredPosts.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-muted">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto bg-background rounded-full flex items-center justify-center">
                  <MapIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">
                    No Intel Posts to Display
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTag === "all"
                      ? "Be the first to share intel!"
                      : "No posts for this tag. Try a different filter."}
                  </p>
                </div>
                {canPost && (
                  <Button onClick={() => setShowPostForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Share Intel
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <IntelMap
              key={`intel-map-${selectedTag}`}
              posts={filteredPosts}
              selectedTag={selectedTag}
              initialCenter={getMapCenter()}
              onMapMove={() => {}}
              className="h-full"
            />
          )}
        </div>
      )}

      {/* Loading State */}
      {viewMode === "feed" && loading && !error && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
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
      )}

      {/* Intel Feed */}
      {viewMode === "feed" && !loading && !error && (
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">
                      {INTEL_UI_TEXT.EMPTY_STATE.TITLE}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {INTEL_UI_TEXT.EMPTY_STATE.DESCRIPTION}
                    </p>
                  </div>
                  {canPost && (
                    <Button onClick={() => setShowPostForm(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Share Intel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredPosts.map((post) => (
              <IntelFeedCard
                key={post.id}
                post={post}
                onPostClick={() => {}}
                onConfirm={handleConfirmPost}
                onPlanSession={handlePlanSession}
                canConfirm={canConfirm}
                isConfirming={confirmingPosts.has(post.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Intel Post Form */}
      <IntelPostForm
        isOpen={showPostForm}
        onClose={() => setShowPostForm(false)}
        onSuccess={handlePostSuccess}
        initialLocation={{
          latitude: 32.7157,
          longitude: -117.1611,
        }}
      />
    </div>
  );
}
