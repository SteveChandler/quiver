"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionShareButtonProps {
  sessionId: string;
  shareCount: number;
  onShareClick: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SessionShareButton({
  sessionId,
  shareCount,
  onShareClick,
  className = "",
  size = "md",
}: SessionShareButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    onShareClick();
  };

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const iconSize = sizeClasses[size];

  return (
    <button
      className={`flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors motion-optimized ${
        isAnimating ? "scale-110" : ""
      } ${className}`}
      onClick={handleClick}
      data-testid="share-button"
      aria-label={`Share this session. Currently shared ${shareCount} ${
        shareCount === 1 ? "time" : "times"
      }`}
      style={{
        transform: isAnimating ? "scale(1.1)" : "scale(1)",
        transition: "transform 0.2s ease-out",
      }}
    >
      <Share2
        className={`${iconSize} transition-transform ${
          isAnimating ? "rotate-12" : ""
        }`}
      />
      <span>{shareCount}</span>
    </button>
  );
}
