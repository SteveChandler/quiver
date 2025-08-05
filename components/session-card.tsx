import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { StarRating } from "@/components/ui/star-rating";
import {
  MapPin,
  Star,
  ThumbsUp,
  MessageSquare,
  Calendar,
  Waves,
  Users,
  Car,
  Thermometer,
  CalendarClock,
  CheckCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCommentCount } from "@/hooks/use-comment-count";
import { useSessionLike } from "@/hooks/use-session-like";
import { CommentsModal } from "@/components/comments-modal";
import type { SessionWithDetails } from "@/types/database";

interface SessionCardProps {
  id?: string;
  username: string;
  beachName: string;
  date: string;
  rating: number;
  description: string;
  imageUrl: string;
  likes: number;
  comments: number;
  isOwner?: boolean;
  session?: SessionWithDetails; // Add optional session data for enhanced display
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
  likes,
  comments,
  isOwner = false,
  session,
  onUserClick,
}: SessionCardProps) {
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

  const cardContent = (
    <CardContent className="p-4 space-y-4">
      {/* Session Status Badge */}
      {session?.status === "planned" && (
        <div className="mb-2">
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 border-blue-200"
          >
            <CalendarClock className="h-3 w-3 mr-1" />
            Planned Session
          </Badge>
        </div>
      )}

      {/* User Info */}
      <div className="flex items-center gap-3">
        {session?.user?.id && onUserClick && !isOwner ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUserClick(session.user.id);
            }}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <UserAvatar
              src={session?.user?.avatar_url}
              name={session?.user?.full_name || username}
              email={session?.user?.email}
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
              email={session?.user?.email}
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

      {/* Overall Rating */}
      <StarRating rating={rating} size="md" />

      {/* Session Conditions - Only show if session data is available */}
      {session && (
        <div className="grid grid-cols-3 gap-2 py-2 border-y bg-muted/30 rounded-md px-3">
          {/* Wave Conditions */}
          {(session.wave_quality ||
            session.wave_height ||
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
                {session.wave_height && (
                  <div className="text-xs text-muted-foreground">
                    {session.wave_height}
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
          {(session.crowd_level || session.crowd_rating) && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Users className="h-4 w-4 text-orange-500" />
              </div>
              <div className="space-y-1">
                <StarRating
                  rating={session.crowd_level || session.crowd_rating || 0}
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

      {/* Image */}
      <div className="relative h-48 w-full rounded-md overflow-hidden">
        <Image
          src={imageUrl || "/placeholder.svg"}
          alt="Session photo"
          fill
          className="object-cover"
        />
      </div>

      {/* Engagement */}
      <div className="flex items-center gap-4 pt-2">
        <button
          className={`flex items-center gap-1 text-sm transition-colors ${
            liked ? "text-primary" : "text-muted-foreground hover:text-primary"
          } ${isToggling ? "opacity-50" : ""}`}
          onClick={handleLikeClick}
          disabled={isToggling}
        >
          <ThumbsUp className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          <span>{displayLikesCount}</span>
        </button>
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          onClick={handleCommentsClick}
        >
          <MessageSquare className="h-4 w-4" />
          <span>{isLoading ? "..." : displayCommentCount}</span>
        </button>
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
