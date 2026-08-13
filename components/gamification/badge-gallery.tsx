"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ZeroState } from "@/components/ui/zero-state";
import { BadgeIcon } from "./badge-icon";
import { cn } from "@/lib/utils";
import { Trophy, Lock, Calendar, BookOpen } from "lucide-react";

export interface BadgeData {
  badge_slug: string;
  name: string;
  description: string;
  icon: string;
  category: "global" | "journal" | "quiver";
  xp_reward: number;
  unlocked?: boolean;
  unlocked_at?: string;
}

interface BadgeGalleryProps {
  badges: BadgeData[];
  userBadges?: string[]; // Array of unlocked badge slugs
  className?: string;
}

export function BadgeGallery({
  badges,
  userBadges = [],
  className,
}: BadgeGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "global" | "journal" | "quiver"
  >("all");

  // Show zero state if no badges are available
  if (badges.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Badge Collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ZeroState
            icon={Trophy}
            title="No Badges Available"
            description="Start logging sessions and engaging with the community to unlock badges"
            action={{
              label: "Log Your First Session",
              href: "/sessions/new?mode=log",
              icon: BookOpen,
            }}
          />
        </CardContent>
      </Card>
    );
  }

  // Organize badges by category and unlock status
  const organizedBadges = badges.reduce((acc, badge) => {
    const isUnlocked = userBadges.includes(badge.badge_slug);
    const badgeWithStatus = { ...badge, unlocked: isUnlocked };

    if (!acc[badge.category]) {
      acc[badge.category] = { unlocked: [], locked: [] };
    }

    if (isUnlocked) {
      acc[badge.category].unlocked.push(badgeWithStatus);
    } else {
      acc[badge.category].locked.push(badgeWithStatus);
    }

    return acc;
  }, {} as Record<string, { unlocked: BadgeData[]; locked: BadgeData[] }>);

  const categoryStats = {
    global: {
      total:
        (organizedBadges.global?.unlocked.length || 0) +
        (organizedBadges.global?.locked.length || 0),
      unlocked: organizedBadges.global?.unlocked.length || 0,
    },
    journal: {
      total:
        (organizedBadges.journal?.unlocked.length || 0) +
        (organizedBadges.journal?.locked.length || 0),
      unlocked: organizedBadges.journal?.unlocked.length || 0,
    },
    quiver: {
      total:
        (organizedBadges.quiver?.unlocked.length || 0) +
        (organizedBadges.quiver?.locked.length || 0),
      unlocked: organizedBadges.quiver?.unlocked.length || 0,
    },
  };

  const totalStats = {
    total: badges.length,
    unlocked: userBadges.length,
  };

  const renderBadgeGrid = (categoryBadges: {
    unlocked: BadgeData[];
    locked: BadgeData[];
  }) => {
    const allBadges = [...categoryBadges.unlocked, ...categoryBadges.locked];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {allBadges.map((badge) => (
          <BadgeCard key={badge.badge_slug} badge={badge} />
        ))}
      </div>
    );
  };

  const renderAllBadges = () => {
    const allUnlocked: BadgeData[] = [];
    const allLocked: BadgeData[] = [];

    Object.values(organizedBadges).forEach((category) => {
      allUnlocked.push(...category.unlocked);
      allLocked.push(...category.locked);
    });

    return (
      <div className="space-y-8">
        {allUnlocked.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Unlocked Badges ({allUnlocked.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allUnlocked.map((badge) => (
                <BadgeCard key={badge.badge_slug} badge={badge} />
              ))}
            </div>
          </div>
        )}

        {allLocked.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
              <Lock className="h-5 w-5" />
              Locked Badges ({allLocked.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allLocked.map((badge) => (
                <BadgeCard key={badge.badge_slug} badge={badge} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Badge Collection
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            {totalStats.unlocked} / {totalStats.total} badges unlocked
          </span>
          <Badge variant="secondary">
            {Math.round((totalStats.unlocked / totalStats.total) * 100)}%
            complete
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          value={selectedCategory}
          onValueChange={(value) => setSelectedCategory(value as any)}
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-2">
                {totalStats.unlocked}/{totalStats.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="global">
              Global
              <Badge variant="secondary" className="ml-2">
                {categoryStats.global.unlocked}/{categoryStats.global.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="journal">
              Journal+
              <Badge variant="secondary" className="ml-2">
                {categoryStats.journal.unlocked}/{categoryStats.journal.total}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="quiver">
              Quiver
              <Badge variant="secondary" className="ml-2">
                {categoryStats.quiver.unlocked}/{categoryStats.quiver.total}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {renderAllBadges()}
          </TabsContent>

          <TabsContent value="global" className="mt-6">
            {organizedBadges.global && renderBadgeGrid(organizedBadges.global)}
          </TabsContent>

          <TabsContent value="journal" className="mt-6">
            {organizedBadges.journal &&
              renderBadgeGrid(organizedBadges.journal)}
          </TabsContent>

          <TabsContent value="quiver" className="mt-6">
            {organizedBadges.quiver && renderBadgeGrid(organizedBadges.quiver)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface BadgeCardProps {
  badge: BadgeData;
}

function BadgeCard({ badge }: BadgeCardProps) {
  const isUnlocked = badge.unlocked;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative p-4 rounded-lg border transition-[background-color,border-color,box-shadow,opacity] duration-200",
              isUnlocked
                ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 hover:border-amber-300 hover:shadow-md"
                : "bg-gray-50 border-gray-200 hover:border-gray-300",
              !isUnlocked && "opacity-60"
            )}
          >
            {/* Lock overlay for locked badges */}
            {!isUnlocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
                <Lock className="h-6 w-6 text-gray-400" />
              </div>
            )}

            <div className="flex flex-col items-center text-center space-y-2">
              <div
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                  isUnlocked
                    ? "bg-gradient-to-r from-amber-100 to-yellow-100"
                    : "bg-gray-100"
                )}
              >
                <BadgeIcon
                  icon={badge.icon}
                  size="md"
                  className={!isUnlocked ? "opacity-50" : ""}
                />
              </div>

              <div>
                <p
                  className={cn(
                    "font-medium text-sm",
                    isUnlocked ? "text-gray-900" : "text-gray-500"
                  )}
                >
                  {badge.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {badge.category}
                </p>
                {badge.xp_reward > 0 && (
                  <p className="text-xs text-green-600">
                    +{badge.xp_reward} XP
                  </p>
                )}
              </div>
            </div>

            {/* Unlock date for earned badges */}
            {isUnlocked && badge.unlocked_at && (
              <div className="absolute top-2 right-2">
                <Calendar className="h-3 w-3 text-amber-500" />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            <p className="font-medium">{badge.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {badge.description}
            </p>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="capitalize">{badge.category} badge</span>
              {badge.xp_reward > 0 && (
                <span className="text-green-600">+{badge.xp_reward} XP</span>
              )}
            </div>
            {isUnlocked && badge.unlocked_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Unlocked {new Date(badge.unlocked_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
