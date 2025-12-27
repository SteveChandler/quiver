"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserXPCard } from "@/components/gamification/user-xp-card";
import { BadgeGallery } from "@/components/gamification/badge-gallery";
import { Trophy, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";

interface GamificationSectionProps {
  user: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
  isOwnProfile?: boolean;
}

type __GamificationCached = {
  xpData: any;
  userBadges: any[];
  allBadges: any[];
  expiresAt: number;
};

// Achievements (XP/badges) are not highly volatile; cache to make back/forward fast.
const __GAMIFICATION_CACHE_TTL_MS = 5 * 60_000;
const __gamificationCacheByUserId = new Map<string, __GamificationCached>();
const __gamificationInflightByUserId = new Map<
  string,
  Promise<__GamificationCached>
>();

export function GamificationSection({
  user,
  isOwnProfile = false,
}: GamificationSectionProps) {
  const [xpData, setXpData] = useState<any>(null);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBadgeGallery, setShowBadgeGallery] = useState(false);

  const loadGamificationData = useCallback(async () => {
    setLoading(true);

    const cacheKey = user.id;
    const cached = __gamificationCacheByUserId.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setXpData(cached.xpData);
      setUserBadges(cached.userBadges || []);
      setAllBadges(cached.allBadges || []);
      setLoading(false);
      return;
    }

    const inflight = __gamificationInflightByUserId.get(cacheKey);
    if (inflight) {
      try {
        const shared = await inflight;
        setXpData(shared.xpData);
        setUserBadges(shared.userBadges || []);
        setAllBadges(shared.allBadges || []);
      } finally {
        setLoading(false);
      }
      return;
    }

    const p = (async (): Promise<__GamificationCached> => {
      const [xpRes, userBadgesRes, allBadgesRes] = await Promise.all([
        fetch("/api/gamification/xp-status", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }),
        fetch("/api/gamification/user-badges", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }),
        fetch("/api/gamification/badge-definitions", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }),
      ]);

      const xpJson = xpRes.ok ? await xpRes.json() : null;
      const userBadgesJson = userBadgesRes.ok ? await userBadgesRes.json() : null;
      const allBadgesJson = allBadgesRes.ok ? await allBadgesRes.json() : null;

      const next: __GamificationCached = {
        xpData: xpJson?.data?.xp || null,
        userBadges: userBadgesJson?.data?.badges || [],
        allBadges: allBadgesJson?.data?.badges || [],
        expiresAt: Date.now() + __GAMIFICATION_CACHE_TTL_MS,
      };
      __gamificationCacheByUserId.set(cacheKey, next);
      return next;
    })();

    __gamificationInflightByUserId.set(cacheKey, p);
    try {
      const cachedResult = await p;

      if (!cachedResult.xpData) {
        console.error("Failed to load XP data");
      }
      setXpData(cachedResult.xpData);
      setUserBadges(cachedResult.userBadges || []);
      setAllBadges(cachedResult.allBadges || []);
    } catch (error) {
      console.error("Error loading gamification data:", error);
      toast({
        title: "Error",
        description: "Failed to load gamification data",
        variant: "destructive",
      });
    } finally {
      __gamificationInflightByUserId.delete(cacheKey);
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadGamificationData();
  }, [loadGamificationData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!xpData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* XP and Badges Summary Card */}
      <UserXPCard
        user={user}
        xpData={xpData}
        badges={userBadges}
        onViewAllBadges={() => setShowBadgeGallery(true)}
      />

      {/* Badge Gallery (Collapsible) */}
      {showBadgeGallery && (
        <BadgeGallery
          badges={allBadges}
          userBadges={userBadges.map((b) => b.badge_slug)}
        />
      )}

      {/* Quick Stats for Profile View */}
      {!isOwnProfile && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {xpData.level}
                </div>
                <p className="text-sm text-muted-foreground">Level</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {xpData.xp_total.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Total XP</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">
                  {userBadges.length}
                </div>
                <p className="text-sm text-muted-foreground">Badges</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievement Progress (Own Profile Only) */}
      {isOwnProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Next Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getUpcomingBadges(allBadges, userBadges).map((badge) => (
                <div
                  key={badge.badge_slug}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-green-600 font-medium">
                    +{badge.xp_reward} XP
                  </div>
                </div>
              ))}

              {getUpcomingBadges(allBadges, userBadges).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Complete more actions to unlock new badges!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to get the next 3 badges the user can unlock
function getUpcomingBadges(allBadges: any[], userBadges: any[]) {
  const unlockedSlugs = new Set(userBadges.map((b) => b.badge_slug));

  return allBadges
    .filter((badge) => !unlockedSlugs.has(badge.badge_slug))
    .slice(0, 3);
}
