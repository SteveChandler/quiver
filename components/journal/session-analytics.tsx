"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Waves,
  MapPin,
  Calendar,
  Clock,
  Star,
  RefreshCw,
  Activity,
  Target,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SessionWithDetails } from "@/types/database";

/** Wave height trend data point */
interface WaveHeightTrendPoint {
  averageWaveHeight: number;
  date: string;
}

/** Monthly session statistics */
interface MonthlyStats {
  month: string;
  sessionCount: number;
  averageRating?: number;
}

/** Board usage statistics */
interface BoardUsage {
  boardId?: string;
  boardName: string;
  usageCount: number;
}

/** Session analytics data structure */
interface SessionAnalyticsType {
  totalSessions: number;
  totalHours: number;
  averageRating: number;
  averageWaveHeight: number;
  waveHeightTrend: WaveHeightTrendPoint[];
  conditionRatings: {
    waveQuality: number;
    waterTemp: number;
    crowdLevel: number;
    windConditions: number;
    parkingEase: number;
  };
  monthlyStats: MonthlyStats[];
  favoriteBeach: string | null;
  frequentBoards: BoardUsage[];
}

interface SessionAnalyticsProps {
  analytics: SessionAnalyticsType | null;
  sessions: SessionWithDetails[];
  onRefresh: () => void;
}

export function SessionAnalytics({
  analytics,
  sessions,
  onRefresh,
}: SessionAnalyticsProps) {
  const [selectedChart, setSelectedChart] = useState<
    "trend" | "conditions" | "frequency"
  >("trend");

  if (!analytics) {
    return (
      <Alert>
        <AlertDescription>
          No analytics data available. Log some sessions to see your surfing
          insights!
        </AlertDescription>
      </Alert>
    );
  }

  // Calculate additional insights
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthSessions = sessions.filter((session) => {
    const sessionDate = new Date(session.arrival_time);
    return (
      sessionDate.getMonth() === currentMonth &&
      sessionDate.getFullYear() === currentYear
    );
  }).length;

  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const lastMonthSessions = sessions.filter((session) => {
    const sessionDate = new Date(session.arrival_time);
    return (
      sessionDate.getMonth() === lastMonth &&
      sessionDate.getFullYear() === lastMonthYear
    );
  }).length;

  const monthlyGrowth =
    lastMonthSessions > 0
      ? ((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100
      : 0;

  const bestRatedSession = sessions.reduce((best, session) => {
    return (session.rating || 0) > (best.rating || 0) ? session : best;
  }, sessions[0]);

  const longestSession = sessions.reduce((longest, session) => {
    return (session.duration_minutes || 0) > (longest.duration_minutes || 0)
      ? session
      : longest;
  }, sessions[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Session Insights</h3>
          <p className="text-sm text-muted-foreground">
            Analyze your surfing performance and trends
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{analytics.totalSessions}</p>
                <p className="text-sm text-muted-foreground">
                  Completed Sessions
                </p>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <span
                className={`text-sm ${
                  monthlyGrowth >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {monthlyGrowth >= 0 ? "+" : ""}
                {monthlyGrowth.toFixed(1)}% from last month
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{analytics.totalHours}h</p>
                <p className="text-sm text-muted-foreground">Time Surfed</p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">
                Avg{" "}
                {Math.round(
                  (analytics.totalHours / analytics.totalSessions) * 10
                ) / 10}
                h per session
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {analytics.averageRating}/5
                </p>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
              <Star className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">
                Best: {bestRatedSession?.rating || 0}/5
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {analytics.averageWaveHeight}ft
                </p>
                <p className="text-sm text-muted-foreground">Avg Waves</p>
              </div>
              <Waves className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">
                Max: {Math.max(...sessions.map((s) => s.wave_quality || 0))}ft
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Selection */}
      <div className="flex items-center gap-2">
        <Button
          variant={selectedChart === "trend" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedChart("trend")}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Wave Height Trend
        </Button>
        <Button
          variant={selectedChart === "conditions" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedChart("conditions")}
        >
          <Activity className="h-4 w-4 mr-2" />
          Conditions Radar
        </Button>
        <Button
          variant={selectedChart === "frequency" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedChart("frequency")}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Session Frequency
        </Button>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Wave Height Trend Chart */}
        {selectedChart === "trend" && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Wave Height Over Time
              </CardTitle>
              <CardDescription>
                Your recent session wave heights and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 relative border rounded p-2">
                <div className="absolute inset-2 flex items-end justify-between gap-1">
                  {analytics.waveHeightTrend.map((point, index) => {
                    const maxHeight = Math.max(
                      ...analytics.waveHeightTrend.map(
                        (p) => p.averageWaveHeight
                      )
                    );
                    const minHeight = Math.min(
                      ...analytics.waveHeightTrend.map(
                        (p) => p.averageWaveHeight
                      )
                    );

                    // Calculate proportional height in pixels for better control
                    // Container height is ~240px (h-64 minus padding), use 90% of that
                    const containerHeight = 220; // Available height in pixels
                    const minPixelHeight = 40; // Minimum bar height in pixels
                    const maxPixelHeight = containerHeight - 20; // Maximum bar height
                    const heightRange = maxPixelHeight - minPixelHeight;
                    const waveRange = maxHeight - minHeight;

                    let finalHeightPx;
                    if (waveRange === 0) {
                      // All waves same height - use middle value
                      finalHeightPx = containerHeight / 2;
                    } else {
                      // Enhanced scaling: amplify small differences
                      const normalizedHeight =
                        (point.averageWaveHeight - minHeight) / waveRange;

                      // Apply power scaling to make small differences more visible
                      const enhancedHeight = Math.pow(normalizedHeight, 0.6);
                      finalHeightPx =
                        minPixelHeight + enhancedHeight * heightRange;
                    }

                    return (
                      <div
                        key={index}
                        className="flex flex-col items-center flex-1 min-w-0"
                      >
                        <div
                          className="bg-blue-500 rounded-t-sm w-full transition-[background-color,height] duration-300 hover:bg-blue-600 min-h-[8px] relative"
                          style={{ height: `${finalHeightPx}px` }}
                          title={`${point.date}: ${point.averageWaveHeight}ft`}
                        >
                          {/* Wave height display */}
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/50 px-1 rounded">
                            {point.averageWaveHeight}ft
                          </div>
                        </div>
                        <div className="text-xs mt-2 text-muted-foreground rotate-45 origin-top-left whitespace-nowrap">
                          {point.date}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                📈 Showing wave heights from{" "}
                {Math.min(
                  ...analytics.waveHeightTrend.map((p) => p.averageWaveHeight)
                )}
                ft to{" "}
                {Math.max(
                  ...analytics.waveHeightTrend.map((p) => p.averageWaveHeight)
                )}
                ft across {analytics.waveHeightTrend.length} sessions
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conditions Radar Chart */}
        {selectedChart === "conditions" && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Condition Ratings Comparison
              </CardTitle>
              <CardDescription>
                How you rate different surfing conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.conditionRatings.waveQuality.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Wave Quality
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (analytics.conditionRatings.waveQuality / 5) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.conditionRatings.waterTemp.toFixed(0)}°F
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Water Temp
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          ((analytics.conditionRatings.waterTemp - 50) / 30) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {analytics.conditionRatings.crowdLevel.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Crowd Level
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-yellow-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (analytics.conditionRatings.crowdLevel / 5) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.conditionRatings.windConditions.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Wind</div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (analytics.conditionRatings.windConditions / 5) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics.conditionRatings.parkingEase.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Parking</div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div
                      className="bg-orange-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (analytics.conditionRatings.parkingEase / 5) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Frequency Chart */}
        {selectedChart === "frequency" && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Monthly Session Frequency
              </CardTitle>
              <CardDescription>
                Your surfing activity over the past year
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 relative border rounded p-2">
                <div className="absolute inset-2 flex items-end justify-between gap-1">
                  {analytics.monthlyStats.map((month, index) => {
                    const maxSessions = Math.max(
                      ...analytics.monthlyStats.map((m) => m.sessionCount)
                    );

                    // Calculate proportional height in pixels for better control
                    // Container height is ~240px (h-64 minus padding), use 90% of that
                    const containerHeight = 220; // Available height in pixels
                    const minPixelHeight = 8; // Minimum bar height in pixels
                    const maxPixelHeight = containerHeight - 20; // Maximum bar height
                    const heightRange = maxPixelHeight - minPixelHeight;

                    let finalHeightPx;
                    const isActiveMonth = month.sessionCount > 0;

                    if (maxSessions === 0) {
                      // No sessions at all - show minimal bars
                      finalHeightPx = minPixelHeight;
                    } else if (isActiveMonth) {
                      // Active months: scale based on session count
                      const normalizedHeight = month.sessionCount / maxSessions;
                      finalHeightPx =
                        minPixelHeight + normalizedHeight * heightRange;
                    } else {
                      // Empty months: show minimal gray bar
                      finalHeightPx = minPixelHeight;
                    }

                    return (
                      <div
                        key={index}
                        className="flex flex-col items-center flex-1 min-w-0"
                      >
                        <div
                          className={`rounded-t-sm w-full transition-[background-color,height,opacity] duration-300 min-h-[8px] relative ${
                            isActiveMonth
                              ? "bg-primary hover:opacity-80"
                              : "bg-muted-foreground/30"
                          }`}
                          style={{ height: `${finalHeightPx}px` }}
                          title={`${month.month}: ${
                            month.sessionCount
                          } sessions${
                            month.sessionCount > 0 && month.averageRating
                              ? `, ${month.averageRating.toFixed(1)}/5 rating`
                              : ""
                          }`}
                        >
                          {/* Session count display for active months */}
                          {isActiveMonth && (
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/50 px-1 rounded">
                              {month.sessionCount}
                            </div>
                          )}
                        </div>
                        <div className="text-xs mt-2 text-muted-foreground text-center whitespace-nowrap">
                          {month.month.split(" ")[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-sm text-muted-foreground">
                  📊 Total sessions across{" "}
                  {
                    analytics.monthlyStats.filter((m) => m.sessionCount > 0)
                      .length
                  }{" "}
                  active months out of {analytics.monthlyStats.length} months
                  shown
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-primary rounded"></div>
                    <span>Months with sessions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-muted-foreground/30 rounded"></div>
                    <span>Months without sessions</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Additional Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Favorite Beach */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Favorite Beaches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">
                  {analytics.favoriteBeach || "No favorite yet"}
                </span>
                <Badge variant="secondary">Most visited</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Visit different beaches to discover new favorites
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frequent Boards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Go-To Boards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.frequentBoards.slice(0, 3).map((board, index) => (
                <div
                  key={board.boardId}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{board.boardName}</span>
                  <Badge variant="outline">{board.usageCount} sessions</Badge>
                </div>
              ))}
              {analytics.frequentBoards.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No board data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>Session Highlights</CardTitle>
          <CardDescription>Your most memorable sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {bestRatedSession && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Best Rated Session</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {bestRatedSession.beach?.name || bestRatedSession.beach_name}{" "}
                  • {bestRatedSession.rating}/5 stars
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(bestRatedSession.arrival_time).toLocaleDateString()}
                </div>
              </div>
            )}

            {longestSession && (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Longest Session</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {longestSession.beach?.name || longestSession.beach_name} •{" "}
                  {Math.round(
                    ((longestSession.duration_minutes || 0) / 60) * 10
                  ) / 10}
                  h
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(longestSession.arrival_time).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
