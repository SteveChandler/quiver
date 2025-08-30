"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Waves, MapPin, Star, Calendar } from "lucide-react";
import { CenteredLoadingSpinner } from "@/components/ui/loading-states";
import { getUserStats } from "@/actions/profile-actions";
import { useProfile } from "@/lib/hooks/useProfile";
import { useAuth } from "@/context/auth-context";
import { HomeBeachTile } from "@/components/profile/HomeBeachTile";
import { GamificationSection } from "@/components/profile/gamification-section";

interface UserStatsProps {
  userId: string;
}

interface UserStatsData {
  sessionCount: number;
  boardCount: number;
  averageRating: number;
  favoriteSpot: string | null;
  mostVisitedBeach: string | null;
  mostVisitedBeachCount: number;
}

export function UserStats({ userId }: UserStatsProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if this is the current user's stats
  const isCurrentUser = user?.id === userId;

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await getUserStats(userId);
        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Error loading user stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [userId]);

  if (loading) {
    return <CenteredLoadingSpinner text="Loading stats..." />;
  }

  if (!stats) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Stats unavailable
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sessionCount}</div>
            <p className="text-xs text-muted-foreground">Total sessions (all)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boards</CardTitle>
            <Waves className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.boardCount}</div>
            <p className="text-xs text-muted-foreground">Boards in quiver</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating || "-"}</div>
            <p className="text-xs text-muted-foreground">
              Average session rating
            </p>
          </CardContent>
        </Card>

        {/* Use HomeBeachTile for current user, or fallback card for others */}
        {isCurrentUser ? (
          <HomeBeachTile />
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favorite Spot</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">
                {stats?.favoriteSpot || stats?.mostVisitedBeach || "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.favoriteSpot
                  ? "From profile"
                  : stats?.mostVisitedBeachCount
                  ? `${stats.mostVisitedBeachCount} visits`
                  : "No sessions yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gamification Section - Show XP, badges, and achievements */}
      <GamificationSection
        user={{
          id: userId,
          display_name: profile?.full_name || undefined,
        }}
        isOwnProfile={isCurrentUser}
      />
    </div>
  );
}
