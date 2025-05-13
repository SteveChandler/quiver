"use client";

import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  max?: number;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  onChange?: (rating: number) => void;
  className?: string;
}

export function StarRating({
  rating,
  max = 5,
  readonly = false,
  size = "md",
  onChange,
  className,
}: StarRatingProps) {
  // Size classes for different star sizes
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  // Handle star click
  const handleClick = (index: number) => {
    if (readonly || !onChange) return;
    onChange(index + 1);
  };

  return (
    <div className={cn("flex items-center", className)}>
      {Array.from({ length: max }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            sizeClasses[size],
            "transition-all",
            index < rating
              ? "text-yellow-500 fill-yellow-500"
              : "text-muted-foreground",
            !readonly && "cursor-pointer hover:text-yellow-400"
          )}
          onClick={() => handleClick(index)}
        />
      ))}
    </div>
  );
}
