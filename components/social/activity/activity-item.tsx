import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { UserAvatarButton } from "@/components/social/user-avatar-button";
import { ActivityIcon } from "./activity-icon";
import { ActivityText } from "./activity-text";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import type { ActivityFeedItem } from "@/types/database";

interface ActivityItemProps {
  activity: ActivityFeedItem;
  link?: string | null;
  onUserClick?: (userId: string, e?: React.MouseEvent) => void;
  showUserAvatarButton?: boolean;
}

/**
 * Get the appropriate link URL for an activity based on its entity type
 */
export function getActivityLink(activity: ActivityFeedItem): string | null {
  const meta =
    activity.metadata &&
    typeof activity.metadata === "object" &&
    !Array.isArray(activity.metadata)
      ? (activity.metadata as Record<string, unknown>)
      : null;

  switch (activity.entity_type) {
    case "session":
      return `/sessions/${activity.entity_id}`;
    case "beach_review":
      return `/beach/${
        (meta?.beach_id as string | undefined) || activity.entity_id
      }`;
    case "user_follow":
      return `/profile/${
        (meta?.followed_user_id as string | undefined) || activity.user_id
      }`;
    default:
      return null;
  }
}

/**
 * Renders a complete activity feed item with consistent styling
 * Supports optional linking and interactive user elements
 */
export function ActivityItem({
  activity,
  link,
  onUserClick,
  showUserAvatarButton = false,
}: ActivityItemProps) {
  const activityContent = (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar - either interactive button or static avatar */}
          {onUserClick ? (
            <button
              onClick={(e) => onUserClick(activity.user_id, e)}
              className="shrink-0"
            >
              <UserAvatar
                src={activity.user_avatar}
                name={activity.user_name}
                size="sm"
              />
            </button>
          ) : showUserAvatarButton && activity.user_id ? (
            <UserAvatarButton
              userId={activity.user_id}
              src={activity.user_avatar}
              name={activity.user_name}
              size="sm"
            />
          ) : (
            <UserAvatar
              src={activity.user_avatar}
              name={activity.user_name}
              size="sm"
            />
          )}

          {/* Activity content */}
          <div className="flex-1 min-w-0">
            {/* Icon and timestamp */}
            <div className="flex items-center gap-2 mb-1">
              <ActivityIcon activityType={activity.activity_type} />
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(activity.created_at), {
                  addSuffix: true,
                })}
              </span>
            </div>

            {/* Activity description */}
            <p className="text-sm leading-relaxed">
              <ActivityText activity={activity} onUserClick={onUserClick} />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Wrap with link if provided
  return link ? (
    <Link href={link} className="block">
      {activityContent}
    </Link>
  ) : (
    activityContent
  );
}
