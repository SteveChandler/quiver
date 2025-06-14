import { SessionCard } from "@/components/session-card";
import {
  formatSessionDescription,
  formatSessionDate,
  getSessionMapImageUrl,
} from "@/lib/utils/session-utils";
import type { SessionWithDetails } from "@/types/database";

interface SessionCardWrapperProps {
  session: SessionWithDetails;
  isOwner?: boolean;
  showUserInfo?: boolean;
}

export function SessionCardWrapper({
  session,
  isOwner = false,
  showUserInfo = true,
}: SessionCardWrapperProps) {
  const username = showUserInfo
    ? session.user?.full_name || "Anonymous Surfer"
    : "You";

  return (
    <SessionCard
      key={session.id}
      id={session.id}
      username={username}
      beachName={session.beach?.name || "Unknown Beach"}
      date={formatSessionDate(session)}
      rating={session.rating || 0}
      description={formatSessionDescription(session)}
      imageUrl={getSessionMapImageUrl(session)}
      likes={session.likes_count || 0}
      comments={session.comments_count || 0}
      isOwner={isOwner}
      session={session}
    />
  );
}
