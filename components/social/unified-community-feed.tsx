"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { LoadingStates } from "@/lib/utils/loading-utils";
import { UserProfileModal } from "@/components/social/user-profile-modal";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { ActivityItem, getActivityLink } from "@/components/social/activity";
import { RefreshCw, Activity } from "lucide-react";
import type { ActivityFeedItem, SessionWithDetails } from "@/types/database";

interface UnifiedCommunityFeedProps {
  sessions: SessionWithDetails[];
  userId?: string;
  loading: boolean;
  className?: string;
}

type FeedItem = {
  id: string;
  type: "activity" | "session";
  created_at: string;
  data: ActivityFeedItem | SessionWithDetails;
};

export function UnifiedCommunityFeed({
  sessions,
  userId,
  loading: sessionsLoading,
  className = "",
}: UnifiedCommunityFeedProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const {
    activities,
    loading: activitiesLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    isLoadingMore,
  } = useActivityFeed({
    userId,
    limit: 20,
    autoRefresh:
      typeof window !== "undefined" ? !(window as any).__PLAYWRIGHT__ : true,
    refreshInterval: 30000,
  });

  const combinedFeed = useMemo(() => {
    const feedItems: FeedItem[] = [];

    // Add activities to feed
    activities.forEach((activity) => {
      feedItems.push({
        id: `activity-${activity.id}`,
        type: "activity",
        created_at: activity.created_at,
        data: activity,
      });
    });

    // Add sessions to feed
    sessions.forEach((session) => {
      feedItems.push({
        id: `session-${session.id}`,
        type: "session",
        created_at:
          session.created_at ||
          session.session_date ||
          new Date().toISOString(),
        data: session,
      });
    });

    // Sort by created_at date (newest first)
    return feedItems.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [activities, sessions]);

  const handleUserClick = (userId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedUserId(userId);
    setProfileModalOpen(true);
  };


  const renderSessionItem = (session: SessionWithDetails) => {
    return (
      <div>
        <SessionCardWrapper
          session={session}
          isOwner={false}
          showUserInfo={true}
          onUserClick={handleUserClick}
        />
      </div>
    );
  };

  const isLoading =
    sessionsLoading || (activitiesLoading && activities.length === 0);

  if (isLoading) {
    return LoadingStates.feed(className);
  }

  if (error) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <p>Failed to load community feed</p>
        <Button variant="outline" onClick={refresh} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  // Hide entirely when empty — showing "No activity yet" signals an empty
  // community and drives churn. Only render when there is actual content.
  if (combinedFeed.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Community Feed
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={activitiesLoading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              activitiesLoading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>
      </div>

      {/* Combined Feed */}
      <div className="space-y-4">
        {combinedFeed.map((item) => (
          <div key={item.id}>
            {item.type === "activity" ? (
              <ActivityItem
                activity={item.data as ActivityFeedItem}
                link={getActivityLink(item.data as ActivityFeedItem)}
                onUserClick={handleUserClick}
              />
            ) : (
              renderSessionItem(item.data as SessionWithDetails)
            )}
          </div>
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

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          isOpen={profileModalOpen}
          onClose={() => {
            setProfileModalOpen(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
}
