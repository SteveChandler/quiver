import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Star, ThumbsUp, MessageSquare, Calendar } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
}: SessionCardProps) {
  const cardContent = (
    <CardContent className="p-4 space-y-4">
      {/* User Info */}
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage
            src="/placeholder.svg?height=40&width=40"
            alt={username}
          />
          <AvatarFallback>{username.charAt(0)}</AvatarFallback>
        </Avatar>
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
      </div>

      {/* Rating */}
      <div className="flex">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
              }`}
            />
          ))}
      </div>

      {/* Description */}
      <p className="text-sm">{description}</p>

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
        <button className="flex items-center gap-1 text-sm text-muted-foreground">
          <ThumbsUp className="h-4 w-4" />
          <span>{likes}</span>
        </button>
        <button className="flex items-center gap-1 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>{comments}</span>
        </button>
      </div>
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
