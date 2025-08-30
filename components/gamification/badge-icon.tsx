import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import { LucideIcon } from "lucide-react";

interface BadgeIconProps {
  icon: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5", 
  lg: "h-6 w-6"
} as const;

// Helper function to check if a string is an emoji
const isEmoji = (str: string): boolean => {
  // Simple emoji detection - checks for common emoji patterns
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|♦️|⭐|👍|👤|🏷️|☀️|🌅|⛈️|📖|📅|📋|👁️|📊|🏆|➕|⚏|⚙️|📈|♦️|👑/u;
  return emojiRegex.test(str);
};

export function BadgeIcon({ icon, size = "md", className }: BadgeIconProps) {
  // If the icon is an emoji, render it directly
  if (isEmoji(icon)) {
    return (
      <span 
        className={cn("inline-flex items-center justify-center", sizeMap[size], className)}
        style={{ fontSize: size === "sm" ? "14px" : size === "md" ? "16px" : "20px" }}
      >
        {icon}
      </span>
    );
  }

  // Try to find the Lucide icon
  const IconComponent = (LucideIcons as Record<string, LucideIcon>)[icon];
  
  if (IconComponent) {
    return (
      <IconComponent 
        className={cn(sizeMap[size], className)}
      />
    );
  }

  // Fallback to a default icon if not found
  return (
    <LucideIcons.Award 
      className={cn(sizeMap[size], className)}
    />
  );
}