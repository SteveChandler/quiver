"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntelMap } from "./intel-map";
import { IntelFeed } from "./intel-feed";
import { IntelFilters } from "./intel-filters";
import { IntelPostForm } from "./intel-post-form";
import { useLocationIntelData, useIntelFilters } from "@/hooks/use-intel-data";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  Plus,
  MapIcon,
  List,
  Filter,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Settings,
} from "lucide-react";
import { INTEL_UI_TEXT } from "@/lib/constants/intel";
import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { IntelPostWithUser } from "@/types/database";

interface IntelDashboardProps {
  className?: string;
}

type ViewMode = "split" | "map" | "feed";

export function IntelDashboard({ className = "" }: IntelDashboardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [showFilters, setShowFilters] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>();

  const { user } = useAuth();
  const router = useRouter();

  // Intel filters state
  const { selectedTag, selectedRadius, updateTag, updateRadius, resetFilters } =
    useIntelFilters();

  // Intel data with location
  const {
    posts,
    loading,
    error,
    refetch,
    location,
    locationError,
    gettingLocation,
    getCurrentLocation,
    hasLocation,
    updateFilters,
  } = useLocationIntelData({
    tag: selectedTag,
    radius: selectedRadius,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  });

  // Handle map movement to update data
  const handleMapMove = useCallback(
    (center: mapboxgl.LngLat, zoom: number) => {
      // Only update data if the map has moved significantly
      const threshold = 0.01; // ~1km
      if (
        !location ||
        Math.abs(center.lat - location.latitude) > threshold ||
        Math.abs(center.lng - location.longitude) > threshold
      ) {
        // Don't automatically update location for now
        // Users can manually refresh if they want intel for a different area
      }
    },
    [location]
  );

  // Handle intel post confirmation
  const handleConfirmPost = useCallback(
    async (postId: string, isCurrentlyConfirmed: boolean) => {
      if (!user) {
        toast.error("Please sign in to confirm intel posts");
        return;
      }

      try {
        const result = isCurrentlyConfirmed
          ? await removeIntelPostConfirmation(postId)
          : await confirmIntelPost(postId);

        if (result.success) {
          toast.success(
            result.data.confirmed
              ? INTEL_UI_TEXT.SUCCESS.POST_CONFIRMED
              : INTEL_UI_TEXT.SUCCESS.POST_CONFIRMATION_REMOVED
          );
          // Refetch data to update confirmation status
          refetch();
        } else {
          toast.error(result.error || INTEL_UI_TEXT.ERROR.CONFIRM_FAILED);
        }
      } catch (error) {
        console.error("Error updating confirmation:", error);
        toast.error(INTEL_UI_TEXT.ERROR.CONFIRM_FAILED);
      }
    },
    [user, refetch]
  );

  // Handle plan session navigation
  const handlePlanSession = useCallback(
    (post: IntelPostWithUser) => {
      const searchParams = new URLSearchParams({
        lat: post.latitude.toString(),
        lng: post.longitude.toString(),
        location: `${post.title} (Intel)`,
      });
      router.push(`/plan-session?${searchParams.toString()}`);
    },
    [router]
  );

  // Handle filter changes
  const handleTagChange = useCallback(
    (tag: typeof selectedTag) => {
      updateTag(tag);
      updateFilters({ tag });
    },
    [updateTag, updateFilters]
  );

  const handleRadiusChange = useCallback(
    (radius: number) => {
      updateRadius(radius);
      updateFilters({ radius });
    },
    [updateRadius, updateFilters]
  );

  const handleResetFilters = useCallback(() => {
    resetFilters();
    updateFilters({ tag: "all", radius: 5 });
  }, [resetFilters, updateFilters]);

  // Handle successful post creation
  const handlePostSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const canConfirm = !!user;
  const canPost = !!user;

  // Show location error state
  if (locationError) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md p-6">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Location Required</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {locationError}
            </p>
            <div className="space-y-2">
              <Button onClick={getCurrentLocation} className="w-full">
                Try Again
              </Button>
              <p className="text-xs text-muted-foreground">
                Enable location services to see local intel posts
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while getting location
  if (gettingLocation) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-medium mb-2">Getting Your Location</h3>
            <p className="text-sm text-muted-foreground">
              Please allow location access to see local intel
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{INTEL_UI_TEXT.TITLE}</h1>
            <p className="text-sm text-muted-foreground">
              {hasLocation && (
                <span>
                  {posts.length} intel posts within {selectedRadius}{" "}
                  {selectedRadius === 1 ? "mile" : "miles"}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggles */}
            <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-lg">
              <Button
                variant={viewMode === "map" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("map")}
                className="h-8 px-3"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "split" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("split")}
                className="h-8 px-3"
              >
                Split
              </Button>
              <Button
                variant={viewMode === "feed" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("feed")}
                className="h-8 px-3"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Filters Toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8"
            >
              <Filter className="h-4 w-4" />
              {selectedTag !== "all" && (
                <Badge variant="secondary" className="ml-1 h-4 text-xs">
                  1
                </Badge>
              )}
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
              className="h-8"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t">
            <IntelFilters
              selectedTag={selectedTag}
              selectedRadius={selectedRadius}
              onTagChange={handleTagChange}
              onRadiusChange={handleRadiusChange}
              onReset={handleResetFilters}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "map" && hasLocation && (
          <IntelMap
            initialCenter={[location.latitude, location.longitude]}
            posts={posts}
            onMapMove={handleMapMove}
            selectedTag={selectedTag}
            className="h-full"
          />
        )}

        {viewMode === "feed" && (
          <div className="h-full overflow-y-auto p-4">
            <IntelFeed
              posts={posts}
              loading={loading}
              onConfirm={handleConfirmPost}
              onPlanSession={handlePlanSession}
              canConfirm={canConfirm}
              selectedTag={selectedTag}
            />
          </div>
        )}

        {viewMode === "split" && hasLocation && (
          <div className="flex flex-col lg:flex-row h-full">
            {/* Map */}
            <div className="flex-1 lg:flex-1">
              <IntelMap
                initialCenter={[location.latitude, location.longitude]}
                posts={posts}
                onMapMove={handleMapMove}
                selectedTag={selectedTag}
                className="h-full"
              />
            </div>

            {/* Feed */}
            <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Recent Intel</h3>
                  {posts.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {posts.length}
                    </Badge>
                  )}
                </div>
                <IntelFeed
                  posts={posts}
                  loading={loading}
                  onConfirm={handleConfirmPost}
                  onPlanSession={handlePlanSession}
                  canConfirm={canConfirm}
                  selectedTag={selectedTag}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md p-6">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-medium mb-2">Failed to Load Intel</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {canPost && hasLocation && (
        <div className="fixed bottom-20 right-4 z-10 lg:bottom-6">
          <Button
            onClick={() => setShowPostForm(true)}
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Sign In Prompt for Unauthenticated Users */}
      {!canPost && hasLocation && (
        <div className="bg-muted/50 border-t p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Sign in to share intel and confirm posts
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/auth/sign-in")}
            >
              Sign In
            </Button>
          </div>
        </div>
      )}

      {/* Intel Post Form */}
      <IntelPostForm
        isOpen={showPostForm}
        onClose={() => setShowPostForm(false)}
        onSuccess={handlePostSuccess}
        initialLocation={
          location
            ? { latitude: location.latitude, longitude: location.longitude }
            : undefined
        }
      />
    </div>
  );
}
