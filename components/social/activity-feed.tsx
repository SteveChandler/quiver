"use client";

import { Button } from "@/components/ui/button";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { ZeroState } from "@/components/ui/zero-state";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityItem, getActivityLink } from "@/components/social/activity";
import { RefreshCw, Users, UserPlus } from "lucide-react";

interface ActivityFeedProps {
  userId?: string; // If provided, show personalized feed; otherwise show global feed
  limit?: number;
  autoRefresh?: boolean;
  className?: string;
}

export function ActivityFeed({
  userId,
  limit = 20,
  autoRefresh = true,
  className = "",
}: ActivityFeedProps) {
  const {
    activities,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    isLoadingMore,
  } = useActivityFeed({
    userId,
    limit,
    autoRefresh,
    refreshInterval: 30000,
  });

  if (loading && activities.length === 0) {
    return (
      <div className={`py-8 ${className}`}>
        <CenteredLoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <p>Failed to load activity feed</p>
        <Button variant="outline" onClick={refresh} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <ZeroState
        icon={Users}
        title="No Activities Yet"
        description={
          userId
            ? "Follow other surfers to see their activities here"
            : "Start logging sessions and connecting with other surfers!"
        }
        action={
          userId
            ? undefined
            : {
                label: "Log Your First Session",
                href: "/sessions/new?mode=log",
              }
        }
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Refresh Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {userId ? "Activity Feed" : "Global Activity"}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Activity List */}
      <div className="space-y-3">
        {activities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            link={getActivityLink(activity)}
            showUserAvatarButton={true}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
