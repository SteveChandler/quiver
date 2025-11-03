"use client";

import { SessionCard } from "@/components/session-card";
import {
  formatSessionDescription,
  formatSessionDate,
  getSessionMapImageUrl,
} from "@/lib/utils/session-utils";
import type { SessionWithDetails } from "@/types/database";
import { useSessionPhotos } from "@/hooks/use-session-photos";

interface SessionCardWrapperProps {
  session: SessionWithDetails;
  isOwner?: boolean;
  showUserInfo?: boolean;
  onUserClick?: (userId: string) => void;
}

export function SessionCardWrapper({
  session,
  isOwner = false,
  showUserInfo = true,
  onUserClick,
}: SessionCardWrapperProps) {
  // Fetch session photos
  const { photos } = useSessionPhotos(session.id);

  const username = showUserInfo
    ? session.user?.full_name || "Anonymous Surfer"
    : "You";

  const sessionPhoto =
    session.featured_photo_url ||
    session.image_url ||
    ((session as any)?.media?.[0]?.public_url as string | undefined);
  const imageUrl = sessionPhoto ?? getSessionMapImageUrl(session);

  const beachLabel = session.beach?.name || "Unknown Beach";
  const imageAlt = sessionPhoto
    ? `Session photo from ${beachLabel}`
    : `Map showing surf session location at ${beachLabel}`;

  return (
    <SessionCard
      key={session.id}
      id={session.id}
      username={username}
      beachName={beachLabel}
      date={formatSessionDate(session)}
      rating={session.rating || 0}
      description={formatSessionDescription(session)}
      imageUrl={imageUrl}
      imageAlt={imageAlt}
      likes={session.likes_count || 0}
      comments={session.comments_count || 0}
      isOwner={isOwner}
      session={session}
      photos={photos}
      onUserClick={onUserClick}
    />
  );
}
