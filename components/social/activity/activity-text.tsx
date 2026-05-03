import type { ActivityFeedItem } from "@/types/database";

interface ActivityTextProps {
  activity: ActivityFeedItem;
  onUserClick?: (userId: string, e?: React.MouseEvent) => void;
}

/**
 * Renders activity description text with appropriate formatting
 * Supports optional interactive user names when onUserClick is provided
 */
export function ActivityText({ activity, onUserClick }: ActivityTextProps) {
  const userName = activity.user_name || "Someone";
  const metadata = (activity.metadata || {}) as Record<string, any>;

  // Render user name - either interactive button or static text
  const UserName = onUserClick ? (
    <button
      className="font-medium hover:underline text-primary"
      onClick={(e) => onUserClick(activity.user_id, e)}
    >
      {userName}
    </button>
  ) : (
    <strong>{userName}</strong>
  );

  switch (activity.activity_type) {
    case "session_logged":
      return (
        <span>
          {UserName} logged a surf session at{" "}
          <strong>{metadata.beach_name || "a beach"}</strong>
        </span>
      );

    case "session_completed":
      return (
        <span>
          {UserName} completed a surf session at{" "}
          <strong>{metadata.beach_name || "a beach"}</strong>
          {metadata.rating && (
            <span> and rated it {metadata.rating}/5 stars</span>
          )}
        </span>
      );

    case "beach_reviewed":
      return (
        <span>
          {UserName} reviewed a beach
          {metadata.overall_rating && (
            <span> - {metadata.overall_rating}/5 stars</span>
          )}
        </span>
      );

    case "user_followed":
      return (
        <span>
          {UserName} started following someone
        </span>
      );

    default:
      return (
        <span>
          {UserName} had some activity
        </span>
      );
  }
}
