import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isLoading?: boolean;
}

export function UserAvatar({
  src,
  name,
  email,
  size = "md",
  className,
  isLoading = false,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Get initials for avatar fallback
  const getInitials = () => {
    if (name && name.trim()) {
      return name
        .trim()
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2); // Max 2 characters
    }
    if (email && email.trim()) {
      return email.trim().charAt(0).toUpperCase();
    }
    return "U";
  };

  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  // Clean up the src URL and validate
  const cleanSrc = (() => {
    if (!src || imageError) return null;
    // Skip placeholder URLs
    if (src.includes("placeholder.svg")) return null;
    return src;
  })();

  // Only log errors in development, not every render
  if (process.env.NODE_ENV === "development" && imageError) {
    console.log("UserAvatar image error:", {
      originalSrc: src,
      cleanSrc,
      imageError,
      name,
      email,
    });
  }

  const handleImageError = () => {
    console.log("Avatar image failed to load:", src);
    setImageError(true);
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {cleanSrc && (
        <AvatarImage
          src={cleanSrc}
          alt={name || "User"}
          onError={handleImageError}
          onLoad={() => {
            if (process.env.NODE_ENV === "development") {
              console.log("Avatar image loaded successfully:", cleanSrc);
            }
          }}
        />
      )}
      <AvatarFallback className="bg-blue-500 text-white">
        {isLoading ? "..." : getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}
