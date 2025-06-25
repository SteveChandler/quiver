"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { SessionCardWrapper } from "@/components/session-card-wrapper";
import { LoadingStates } from "@/lib/utils/loading-utils";
import { UserProfileModal } from "@/components/social/user-profile-modal";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { formatDistanceToNow } from "date-fns";
import {
  Waves,
  Star,
  Users,
  MessageSquare,
  RefreshCw,
  UserPlus,
  Activity,
} from "lucide-react";
import Link from "next/link";
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

  const renderActivityIcon = (activityType: string) => {
    switch (activityType) {
      case "session_logged":
      case "session_completed":
        return <Waves className="h-4 w-4 text-blue-500" />;
      case "beach_reviewed":
        return <Star className="h-4 w-4 text-yellow-500" />;
      case "user_followed":
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case "session_liked":
        return <MessageSquare className="h-4 w-4 text-red-500" />;
      default:
        return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  const renderActivityText = (activity: ActivityFeedItem) => {
    const userName = activity.user_name || "Someone";
    const metadata = activity.metadata || {};

    switch (activity.activity_type) {
      case "session_logged":
        return (
          <span>
            <button
              className="font-medium hover:underline text-primary"
              onClick={(e) => handleUserClick(activity.user_id, e)}
            >
              {userName}
            </button>{" "}
            logged a surf session at{" "}
            <strong>{metadata.beach_name || "a beach"}</strong>
          </span>
        );
      case "session_completed":
        return (
          <span>
            <button
              className="font-medium hover:underline text-primary"
              onClick={(e) => handleUserClick(activity.user_id, e)}
            >
              {userName}
            </button>{" "}
            completed a surf session at{" "}
            <strong>{metadata.beach_name || "a beach"}</strong>
            {metadata.rating && (
              <span> and rated it {metadata.rating}/5 stars</span>
            )}
          </span>
        );
      case "beach_reviewed":
        return (
          <span>
            <button
              className="font-medium hover:underline text-primary"
              onClick={(e) => handleUserClick(activity.user_id, e)}
            >
              {userName}
            </button>{" "}
            reviewed a beach
            {metadata.overall_rating && (
              <span> - {metadata.overall_rating}/5 stars</span>
            )}
          </span>
        );
      case "user_followed":
        return (
          <span>
            <button
              className="font-medium hover:underline text-primary"
              onClick={(e) => handleUserClick(activity.user_id, e)}
            >
              {userName}
            </button>{" "}
            started following someone
          </span>
        );
      default:
        return (
          <span>
            <button
              className="font-medium hover:underline text-primary"
              onClick={(e) => handleUserClick(activity.user_id, e)}
            >
              {userName}
            </button>{" "}
            had some activity
          </span>
        );
    }
  };

  const getActivityLink = (activity: ActivityFeedItem) => {
    switch (activity.entity_type) {
      case "session":
        return `/sessions/${activity.entity_id}`;
      case "beach_review":
        return `/beach/${activity.metadata?.beach_id || activity.entity_id}`;
      case "user_follow":
        return `/profile/${
          activity.metadata?.followed_user_id || activity.user_id
        }`;
      default:
        return null;
    }
  };

  const renderActivityItem = (activity: ActivityFeedItem) => {
    const activityLink = getActivityLink(activity);
    const activityContent = (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <button
              onClick={(e) => handleUserClick(activity.user_id, e)}
              className="shrink-0"
            >
              <UserAvatar
                src={activity.user_avatar}
                name={activity.user_name}
                size="sm"
              />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {renderActivityIcon(activity.activity_type)}
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                {renderActivityText(activity)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );

    return activityLink ? (
      <Link href={activityLink} className="block">
        {activityContent}
      </Link>
    ) : (
      activityContent
    );
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

  if (combinedFeed.length === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No activity yet</p>
        <p className="text-sm">
          {userId
            ? "Follow other surfers to see their activities and sessions here"
            : "Start logging sessions and connecting with other surfers!"}
        </p>
      </div>
    );
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
            {item.type === "activity"
              ? renderActivityItem(item.data as ActivityFeedItem)
              : renderSessionItem(item.data as SessionWithDetails)}
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
