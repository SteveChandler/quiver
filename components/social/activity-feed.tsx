"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { CenteredLoadingSpinner } from "@/components/ui/loading-spinner";
import { useActivityFeed } from "@/hooks/use-activity-feed";
import { formatDistanceToNow } from "date-fns";
import {
  Waves,
  Star,
  Users,
  MessageSquare,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { ActivityFeedItem } from "@/types/database";

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
            <strong>{userName}</strong> logged a surf session at{" "}
            <strong>{metadata.beach_name || "a beach"}</strong>
          </span>
        );
      case "session_completed":
        return (
          <span>
            <strong>{userName}</strong> completed a surf session at{" "}
            <strong>{metadata.beach_name || "a beach"}</strong>
            {metadata.rating && (
              <span> and rated it {metadata.rating}/5 stars</span>
            )}
          </span>
        );
      case "beach_reviewed":
        return (
          <span>
            <strong>{userName}</strong> reviewed a beach
            {metadata.overall_rating && (
              <span> - {metadata.overall_rating}/5 stars</span>
            )}
          </span>
        );
      case "user_followed":
        return (
          <span>
            <strong>{userName}</strong> started following someone
          </span>
        );
      default:
        return (
          <span>
            <strong>{userName}</strong> had some activity
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
      <div className={`text-center py-8 text-muted-foreground ${className}`}>
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No activities yet</p>
        <p className="text-sm">
          {userId
            ? "Follow other surfers to see their activities here"
            : "Start logging sessions and connecting with other surfers!"}
        </p>
      </div>
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
        {activities.map((activity) => {
          const activityLink = getActivityLink(activity);
          const activityContent = (
            <Card
              key={activity.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <UserAvatar
                    src={activity.user_avatar}
                    name={activity.user_name}
                    size="sm"
                  />
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

          // Wrap with link if we have a valid link
          return activityLink ? (
            <Link key={activity.id} href={activityLink} className="block">
              {activityContent}
            </Link>
          ) : (
            activityContent
          );
        })}
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
