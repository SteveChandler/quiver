"use client";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  color?: string;
  showNumber?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  color = "text-yellow-500",
  showNumber = false,
  className = "",
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const starSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-1 star-rating ${className}`}>
      <div className="flex">
        {Array(maxStars)
          .fill(0)
          .map((_, i) => (
            <Star
              key={i}
              className={`${starSize} ${
                i < rating ? `${color} fill-current` : "text-gray-300"
              }`}
            />
          ))}
      </div>
      {showNumber && (
        <span className="text-sm text-muted-foreground ml-1">
          {rating}/{maxStars}
        </span>
      )}
    </div>
  );
}
