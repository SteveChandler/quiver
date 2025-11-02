import {
  Waves,
  Star,
  Users,
  MessageSquare,
  UserPlus,
  CalendarPlus,
  type LucideIcon,
} from "lucide-react";

interface ActivityIconProps {
  activityType: string;
  className?: string;
}

/**
 * Renders an icon based on the activity type
 * Centralizes icon mapping for consistent activity representation
 */
export function ActivityIcon({ activityType, className = "" }: ActivityIconProps) {
  const getIconConfig = (
    type: string
  ): { Icon: LucideIcon; color: string } => {
    switch (type) {
      case "session_logged":
      case "session_completed":
        return { Icon: Waves, color: "text-blue-500" };
      case "beach_reviewed":
        return { Icon: Star, color: "text-yellow-500" };
      case "user_followed":
        return { Icon: UserPlus, color: "text-green-500" };
      case "session_invite.created":
        return { Icon: CalendarPlus, color: "text-purple-500" };
      case "session_liked":
        return { Icon: MessageSquare, color: "text-red-500" };
      default:
        return { Icon: Users, color: "text-gray-500" };
    }
  };

  const { Icon, color } = getIconConfig(activityType);

  return <Icon className={`h-4 w-4 ${color} ${className}`} />;
}
