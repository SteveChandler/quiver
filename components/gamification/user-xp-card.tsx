"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BadgeIcon } from "./badge-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserXPCardProps {
  user: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
  xpData: {
    xp_total: number;
    level: number;
    level_title: string;
    progress_to_next: number;
    xp_to_next_level: number;
    next_level_title: string;
  };
  badges?: Array<{
    badge_slug: string;
    badge_definitions: {
      name: string;
      icon: string;
      category: string;
    };
  }>;
  onViewAllBadges?: () => void;
  className?: string;
}

export function UserXPCard({
  user,
  xpData,
  badges = [],
  onViewAllBadges,
  className,
}: UserXPCardProps) {
  const displayName = user.display_name || user.username || "Surfer";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Show top 3 most recent badges
  const recentBadges = badges.slice(0, 3);
  const remainingBadgeCount = Math.max(0, badges.length - 3);

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header with Avatar and Level */}
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar_url} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{displayName}</h3>
                <Badge variant="secondary" className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  Level {xpData.level}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{xpData.level_title}</p>
            </div>
          </div>

          {/* XP Progress Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{xpData.xp_total.toLocaleString()} XP</span>
              </div>
              {xpData.xp_to_next_level > 0 && (
                <span className="text-sm text-muted-foreground">
                  {xpData.xp_to_next_level} to next level
                </span>
              )}
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="space-y-1">
                    <Progress 
                      value={xpData.progress_to_next} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{xpData.level_title}</span>
                      <span>{xpData.progress_to_next}%</span>
                      <span>{xpData.next_level_title}</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-medium">Progress to Level {xpData.level + 1}</p>
                    <p>{xpData.progress_to_next}% complete</p>
                    <p>{xpData.xp_to_next_level} XP remaining</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Badges Section */}
          {badges.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Recent Badges</span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {recentBadges.map((userBadge) => (
                  <TooltipProvider key={userBadge.badge_slug}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-200">
                          <BadgeIcon 
                            icon={userBadge.badge_definitions.icon} 
                            size="sm"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-center">
                          <p className="font-medium">{userBadge.badge_definitions.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {userBadge.badge_definitions.category}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                
                {remainingBadgeCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onViewAllBadges}
                  >
                    +{remainingBadgeCount} more
                  </Button>
                )}
                
                {onViewAllBadges && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={onViewAllBadges}
                  >
                    View All
                  </Button>
                )}
              </div>
            </div>
          )}

          {badges.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Complete actions to earn badges!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for smaller spaces
export function UserXPBadge({
  xpData,
  className,
}: {
  xpData: Pick<UserXPCardProps["xpData"], "level" | "level_title" | "xp_total">;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium",
            className
          )}>
            <Star className="h-3 w-3" />
            <span>L{xpData.level}</span>
            <span className="opacity-75">•</span>
            <span>{xpData.xp_total.toLocaleString()}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">Level {xpData.level}</p>
            <p>{xpData.level_title}</p>
            <p className="text-xs opacity-75">{xpData.xp_total.toLocaleString()} XP</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}