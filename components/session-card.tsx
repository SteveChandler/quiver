"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { StarRating } from "@/components/ui/star-rating";
import {
  MapPin,
  ThumbsUp,
  MessageSquare,
  Calendar,
  Waves,
  Users,
  Car,
  Thermometer,
} from "lucide-react";
import { MapImage } from "@/components/map-image";
import Link from "next/link";
import { useCommentCount } from "@/hooks/use-comment-count";
import { useSessionLike } from "@/hooks/use-session-like";
import { CommentsModal } from "@/components/comments-modal";
import { UserPlus } from "lucide-react";
import { useUserFollow } from "@/hooks/use-user-follow";
import type { SessionWithDetails } from "@/types/database";
import { SessionCardPhotos, type SessionPhoto } from "@/components/session-card-photos";
import { getWaveTypeLabel } from "@/components/ui/wave-type-selector";
import { formatSessionTideSnapshot } from "@/lib/services/session-tide-snapshot";

const RIP_CURRENT_LABELS: Record<string, string> = {
  none: "None",
  light: "Light",
  strong: "Strong",
};

const RIP_RISK_LABELS: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

interface SessionCardProps {
  id?: string;
  username: string;
  beachName: string;
  date: string;
  rating: number;
  description: string;
  imageUrl: string;
  imageAlt?: string;
  likes: number;
  comments: number;
  isOwner?: boolean;
  session?: SessionWithDetails; // Add optional session data for enhanced display
  photos?: SessionPhoto[]; // Optional photos to display
  onUserClick?: (userId: string) => void;
}

export function SessionCard({
  id,
  username,
  beachName,
  date,
  rating,
  description,
  imageUrl,
  imageAlt,
  likes,
  comments,
  isOwner = false,
  session,
  photos,
  onUserClick,
}: SessionCardProps) {
  const router = useRouter();
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);

  // Use dynamic comment count if session ID is available
  const { commentCount: dynamicCommentCount, isLoading } = useCommentCount(
    id || ""
  );
  const displayCommentCount = id ? dynamicCommentCount : comments;

  // Use dynamic like functionality if session ID is available
  const { liked, likesCount, toggleLike, isToggling } = useSessionLike(
    id || "",
    likes
  );
  const displayLikesCount = id ? likesCount : likes;

  // Use follow functionality for session author
  const {
    following,
    toggleFollow,
    isToggling: isFollowToggling,
  } = useUserFollow(session?.user?.id || "");
  const waveCharacteristics =
    ((session as { wave_characteristics?: string[] | null } | undefined)
      ?.wave_characteristics ?? []);
  const tideRateFtPerHr =
    ((session as { tide_rate_ft_per_hr?: number | null } | undefined)
      ?.tide_rate_ft_per_hr ?? null);
  const tideDisplay =
    session?.tide_height_ft !== null &&
    session?.tide_height_ft !== undefined &&
    session?.tide_status &&
    tideRateFtPerHr !== null
      ? formatSessionTideSnapshot({
          tideHeightFt: session.tide_height_ft,
          tideStatus: session.tide_status as "rising" | "falling" | "high" | "low",
          tideRateFtPerHr,
        })
      : null;
  const ripCurrentObserved =
    ((session as { rip_current_observed?: string | null } | undefined)
      ?.rip_current_observed ?? null);
  const ripCurrentLabel = ripCurrentObserved
    ? RIP_CURRENT_LABELS[ripCurrentObserved] ?? ripCurrentObserved
    : null;
  const ripCurrentRisk =
    ((session as { rip_current_risk?: string | null } | undefined)
      ?.rip_current_risk ?? null);
  const ripRiskLabel = ripCurrentRisk
    ? RIP_RISK_LABELS[ripCurrentRisk] ?? ripCurrentRisk
    : null;

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (id) {
      setCommentsModalOpen(true);
    }
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (id && !isToggling) {
      await toggleLike();
    }
  };

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFollowToggling && session?.user?.id) {
      await toggleFollow();
    }
  };

  const cardContent = (
    <CardContent className="p-4 space-y-4 motion-optimized session-card-hover">
      {/* User Info */}
      <div className="flex items-center gap-3">
        {session?.user?.id && onUserClick && !isOwner ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUserClick(session.user!.id);
            }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity focus-ring"
          >
            <UserAvatar
              src={session?.user?.avatar_url}
              name={session?.user?.full_name || username}
              size="md"
            />
            <div>
              <p className="font-medium hover:underline">{username}</p>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                <span>{beachName}</span>
                <span className="mx-1">•</span>
                <Calendar className="h-3 w-3 mr-1" />
                <span>{date}</span>
              </div>
            </div>
          </button>
        ) : (
          <>
            <UserAvatar
              src={session?.user?.avatar_url}
              name={session?.user?.full_name || username}
              size="md"
            />
            <div>
              <p className="font-medium">{username}</p>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                <span>{beachName}</span>
                <span className="mx-1">•</span>
                <Calendar className="h-3 w-3 mr-1" />
                <span>{date}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {session?.board?.name && (
        <div className="text-sm text-muted-foreground">
          Board: {session.board.name}
        </div>
      )}

      {rating > 0 && <StarRating rating={rating} size="md" />}

      {waveCharacteristics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {waveCharacteristics.map((characteristic) => (
            <span
              key={characteristic}
              className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              {getWaveTypeLabel(characteristic)}
            </span>
          ))}
        </div>
      )}

      {tideDisplay && (
        <div className="text-xs font-medium text-muted-foreground">
          Tide: {tideDisplay}
        </div>
      )}

      {ripCurrentLabel && (
        <div
          className={`text-xs font-medium ${
            ripCurrentObserved === "none"
              ? "text-muted-foreground"
              : "text-amber-700"
          }`}
        >
          Rip current observed: {ripCurrentLabel}
        </div>
      )}

      {ripRiskLabel && (
        <div
          className={`text-xs font-medium ${
            ripCurrentRisk === "high" ? "text-amber-700" : "text-muted-foreground"
          }`}
        >
          Rip risk that day: {ripRiskLabel}
        </div>
      )}

      {/* Session Conditions - Only show if session data is available */}
      {session && (
        <div className="grid grid-cols-3 gap-2 py-2 border-y bg-muted/30 rounded-md px-3">
          {/* Wave Conditions */}
          {(session.wave_quality ||
            session.wave_height_ft ||
            session.water_temp) && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Waves className="h-4 w-4 text-blue-500" />
              </div>
              <div className="space-y-1">
                {session.wave_quality && (
                  <StarRating
                    rating={session.wave_quality}
                    size="sm"
                    color="text-blue-500"
                  />
                )}
                {session.wave_height_ft && (
                  <div className="text-xs text-muted-foreground">
                    {session.wave_height_ft} ft
                  </div>
                )}
                {session.water_temp && (
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    {session.water_temp}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Crowd Level */}
          {session.crowd_level && (
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Users className="h-4 w-4 text-orange-500" />
                </div>
                <div className="space-y-1">
                  <StarRating
                    rating={session.crowd_level}
                    size="sm"
                    color="text-orange-500"
                  />
                  <div className="text-xs text-muted-foreground">Crowd</div>
                </div>
              </div>
          )}

          {/* Parking */}
          {session.parking_ease && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Car className="h-4 w-4 text-green-500" />
              </div>
              <div className="space-y-1">
                <StarRating
                  rating={session.parking_ease}
                  size="sm"
                  color="text-green-500"
                />
                <div className="text-xs text-muted-foreground">Parking</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes - Show if available and different from basic description */}
      {session?.notes && (
        <div className="text-sm bg-muted/50 p-3 rounded-md">
          <p className="italic">{session.notes}</p>
        </div>
      )}

      {/* Description - fallback if no session data */}
      {!session?.notes && <p className="text-sm">{description}</p>}

      {/* Duration */}
      {session?.duration_minutes && (
        <div className="text-xs text-muted-foreground">
          Duration: {Math.floor(session.duration_minutes / 60)}h{" "}
          {session.duration_minutes % 60}m
        </div>
      )}

      {/* Session Photos */}
      {photos && photos.length > 0 && (
        <SessionCardPhotos
          photos={photos}
          maxDisplay={3}
          onClick={() => {
            if (id && isOwner) {
              // Navigate to session detail page to view photos
              router.push(`/sessions/${id}`);
            }
          }}
          className="my-3"
        />
      )}

      {/* Map Preview - Only show if no photos, or show smaller if photos exist */}
      {(!photos || photos.length === 0) && (
        <div className="relative h-48 w-full rounded-md overflow-hidden">
        <MapImage
          src={imageUrl || "/placeholder.svg"}
          alt={
            imageAlt ??
            `Map showing surf session location at ${beachName}`
          }
          fill
          loading="lazy"
          className="object-cover"
          beachName={beachName}
          latitude={session?.beach?.lat ?? undefined}
          longitude={session?.beach?.lon ?? undefined}
        />
      </div>
      )}

      {/* Engagement */}
      <div className="flex items-center gap-4 pt-2">
        <button
          className={`flex items-center gap-1 text-sm transition-colors motion-optimized like-button-spring ripple-effect ${
            liked ? "text-primary" : "text-muted-foreground hover:text-primary"
          } ${isToggling ? "opacity-75" : ""} ${liked ? "heart-burst" : ""}` + " focus-ring"}
          onClick={handleLikeClick}
          disabled={isToggling}
          data-testid="like-button"
          aria-pressed={liked}
          aria-label={`${
            liked ? "Unlike" : "Like"
          } this session. Currently has ${displayLikesCount} ${
            displayLikesCount === 1 ? "like" : "likes"
          }`}
          style={{
            transform: isToggling
              ? liked
                ? "scale(1.3) rotate(15deg)"
                : "scale(0.95)"
              : "scale(1)",
          }}
        >
          <ThumbsUp
            className={`h-4 w-4 transition-colors duration-300 ${
              liked ? "fill-current text-red-500" : ""
            } ${isToggling && liked ? "animate-bounce" : ""}`}
          />
          <span
            className={`transition-transform duration-200 ${
              isToggling ? "scale-110" : "scale-100"
            }`}
          >
            {displayLikesCount}
          </span>
        </button>
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors focus-ring"
          onClick={handleCommentsClick}
        >
          <MessageSquare className="h-4 w-4" />
          <span>{isLoading ? "..." : displayCommentCount}</span>
        </button>
        {id && session?.user?.id && !isOwner && (
          <button
            className={`flex items-center gap-1 text-sm transition-colors ${
              following
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            } ${isFollowToggling ? "opacity-75" : ""}` + " focus-ring"}
            onClick={handleFollowClick}
            disabled={isFollowToggling}
            data-testid="follow-button"
            aria-pressed={following}
            aria-label={`${following ? "Unfollow" : "Follow"} ${username}`}
          >
            <UserPlus className="h-4 w-4" />
            <span>{following ? "Following" : "Follow"}</span>
          </button>
        )}
      </div>

      {/* Comments Modal */}
      {id && (
        <CommentsModal
          sessionId={id}
          beachName={beachName}
          isOpen={commentsModalOpen}
          onClose={() => setCommentsModalOpen(false)}
        />
      )}
    </CardContent>
  );

  if (id && isOwner) {
    return (
      <Link href={`/sessions/${id}`}>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          {cardContent}
        </Card>
      </Link>
    );
  }

  return <Card>{cardContent}</Card>;
}
