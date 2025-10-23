"use client";

import React, { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  TrendingUp,
  Users,
  Loader2,
  AlertCircle,
  Lock,
  LogIn,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBeachAccuracyStats,
  type BeachAccuracyStats,
} from "@/actions/forecast-verification-actions";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { useRouter, usePathname } from "next/navigation";

interface ForecastAccuracyStatsProps {
  beachId: string;
  daysBack?: number;
  className?: string;
  compact?: boolean;
}

/**
 * ForecastAccuracyStats - Display community verification statistics for a beach
 *
 * Shows aggregate accuracy metrics based on community votes:
 * - Total verifications
 * - Accuracy percentage
 * - Accurate vs Inaccurate counts
 *
 * Part of the forecast transparency and community engagement feature set.
 */
export function ForecastAccuracyStats({
  beachId,
  daysBack = 30,
  className,
  compact = false,
}: ForecastAccuracyStatsProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectTo =
    pathname && pathname.length > 0 ? pathname : "/forecast";

  // Fetch accuracy stats
  const fetchStats = useCallback(async () => {
    const result = await getBeachAccuracyStats(beachId, daysBack);
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  }, [beachId, daysBack]);

  const {
    data: stats,
    loading,
    error,
  } = useDataFetcher(fetchStats, { skip: !isAuthenticated });

  if (!isAuthenticated) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Community Accuracy
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Lock className="w-5 h-5" />
            <span>Sign in to view community verification stats</span>
          </div>
          <div className="text-sm text-muted-foreground max-w-sm">
            Join the community to see how other surfers rated recent forecasts
            and add your own votes.
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
            <Button
              onClick={() =>
                router.push(
                  `/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
                )
              }
              className="w-full"
              disabled={authLoading}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`
                )
              }
              className="w-full"
              disabled={authLoading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2
            role="img"
            aria-hidden="true"
            className="w-6 h-6 animate-spin text-muted-foreground"
          />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">Failed to load statistics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total_votes === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No verifications yet</p>
            <p className="text-xs mt-1">
              Be the first to verify forecast accuracy!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine accuracy level for styling
  const accuracyLevel =
    stats.accuracy_percentage >= 75
      ? "high"
      : stats.accuracy_percentage >= 50
        ? "medium"
        : "low";

  const accuracyColors = {
    high: "text-green-700 bg-green-50 border-green-200",
    medium: "text-yellow-700 bg-yellow-50 border-yellow-200",
    low: "text-red-700 bg-red-50 border-red-200",
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="outline" className={accuracyColors[accuracyLevel]}>
          <TrendingUp className="w-3 h-3 mr-1" />
          {stats.accuracy_percentage}% Accurate
        </Badge>
        <span className="text-xs text-muted-foreground">
          ({stats.total_votes} {stats.total_votes === 1 ? "vote" : "votes"})
        </span>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Community Accuracy
          <Badge variant="outline" className="ml-auto">
            Last {daysBack} days
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall accuracy */}
        <div className="text-center">
          <div
            className={cn(
              "inline-flex items-center justify-center w-20 h-20 rounded-full border-4",
              accuracyColors[accuracyLevel]
            )}
          >
            <div className="text-center">
              <div className="text-2xl font-bold">
                {stats.accuracy_percentage}%
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Overall Accuracy
          </p>
        </div>

        {/* Vote breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-center gap-1 text-green-700 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-2xl font-bold">
                {stats.accurate_votes}
              </span>
            </div>
            <p className="text-xs text-green-600">Accurate</p>
          </div>

          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center justify-center gap-1 text-red-700 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-2xl font-bold">
                {stats.inaccurate_votes}
              </span>
            </div>
            <p className="text-xs text-red-600">Inaccurate</p>
          </div>
        </div>

        {/* Total votes */}
        <div className="text-center pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            Based on{" "}
            <span className="font-semibold text-foreground">
              {stats.total_votes}
            </span>{" "}
            community {stats.total_votes === 1 ? "verification" : "verifications"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
