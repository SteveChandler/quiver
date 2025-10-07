"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getClientBrowserClient } from "@/lib/supabase";
import {
  Clock,
  Waves,
  Wind,
  TrendingUp,
  AlertCircle,
  Share2,
} from "lucide-react";

interface BestSurfWindowProps {
  beachId: string;
  beachName: string;
}

export function BestSurfWindow({ beachId, beachName }: BestSurfWindowProps) {
  // Fetch latest intel directly from Supabase (no edge function needed!)
  const fetchIntel = useCallback(async () => {
    const supabase = getClientBrowserClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("beach_daily_intel")
      .select("*")
      .eq("beach_id", beachId)
      .eq("forecast_date", today)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  }, [beachId]);

  const { data: intel, loading, error } = useDataFetcher(fetchIntel);

  // Loading state
  if (loading) {
    return (
      <Card className="rounded-3xl border-blue-100/60">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error or no intel available - show friendly message
  if (error || !intel) {
    return (
      <Card className="rounded-3xl border-yellow-100/60 bg-yellow-50/50">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium mb-1">
              Surf intel not available yet
            </p>
            <p className="text-xs text-yellow-700">
              Intel is generated daily for select beaches. Check back soon or
              view the detailed forecast below.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format time helper
  const formatTime = (time: string | null) => {
    if (!time) return "";
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return time;
    }
  };

  // Check if window has passed, is current, or upcoming
  const getWindowStatus = () => {
    if (!intel.best_window_start || !intel.best_window_end) {
      return { status: "unknown", message: "" };
    }

    const now = new Date();
    const today = new Date().toISOString().split('T')[0];
    
    const startTime = new Date(`${today}T${intel.best_window_start}`);
    const endTime = new Date(`${today}T${intel.best_window_end}`);
    
    if (now < startTime) {
      // Window hasn't started yet
      const hoursUntil = Math.round((startTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      const minsUntil = Math.round((startTime.getTime() - now.getTime()) / (1000 * 60));
      
      if (hoursUntil >= 1) {
        return {
          status: "upcoming",
          message: `Starts in ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`,
        };
      } else {
        return {
          status: "upcoming",
          message: `Starts in ${minsUntil} minutes`,
        };
      }
    } else if (now >= startTime && now <= endTime) {
      // Currently in the window
      const minsRemaining = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60));
      return {
        status: "current",
        message: minsRemaining > 60 
          ? `${Math.floor(minsRemaining / 60)}h ${minsRemaining % 60}m remaining`
          : `${minsRemaining} mins remaining`,
      };
    } else {
      // Window has passed
      return {
        status: "passed",
        message: "Window has passed",
      };
    }
  };

  const windowStatus = getWindowStatus();
  const generatedTime = new Date(intel.generated_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="rounded-3xl border-blue-100/60 bg-gradient-to-br from-blue-50/50 to-white shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl font-bold text-blue-900">
              🌊 Best Time to Surf Today
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Updated at {generatedTime}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // TODO: Add share functionality
              console.log("Share surf intel");
            }}
            className="h-8 w-8 p-0 flex-shrink-0"
            title="Share surf intel"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Optimal Window - Highlighted with status */}
        <div className={`rounded-2xl p-4 ${
          windowStatus.status === "current"
            ? "bg-green-100/50 border border-green-200"
            : windowStatus.status === "passed"
            ? "bg-gray-100/50 border border-gray-200"
            : "bg-blue-100/50"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className={`h-5 w-5 ${
                windowStatus.status === "current"
                  ? "text-green-600"
                  : windowStatus.status === "passed"
                  ? "text-gray-600"
                  : "text-blue-600"
              }`} />
              <h4 className={`font-semibold ${
                windowStatus.status === "current"
                  ? "text-green-900"
                  : windowStatus.status === "passed"
                  ? "text-gray-900"
                  : "text-blue-900"
              }`}>
                {windowStatus.status === "current"
                  ? "🏄 SURF NOW!"
                  : windowStatus.status === "passed"
                  ? "Best Window (Passed)"
                  : "Optimal Window"}
              </h4>
            </div>
            {windowStatus.message && (
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                windowStatus.status === "current"
                  ? "bg-green-200 text-green-800"
                  : windowStatus.status === "passed"
                  ? "bg-gray-200 text-gray-700"
                  : "bg-blue-200 text-blue-800"
              }`}>
                {windowStatus.message}
              </span>
            )}
          </div>
          <p className={`text-2xl font-bold ${
            windowStatus.status === "current"
              ? "text-green-600"
              : windowStatus.status === "passed"
              ? "text-gray-600"
              : "text-blue-600"
          }`}>
            {formatTime(intel.best_window_start)} -{" "}
            {formatTime(intel.best_window_end)}
          </p>
          {intel.best_window_description && (
            <p className={`text-sm mt-1 ${
              windowStatus.status === "current"
                ? "text-green-700"
                : windowStatus.status === "passed"
                ? "text-gray-600"
                : "text-blue-700"
            }`}>
              {intel.best_window_description}
            </p>
          )}
        </div>

        {/* Show current conditions if window has passed */}
        {windowStatus.status === "passed" && (
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
            <h4 className="font-semibold text-blue-900 mb-2 text-sm">
              📍 Current Conditions
            </h4>
            <p className="text-sm text-gray-700">
              Right now: {intel.surf_min_ft}-{intel.surf_max_ft} ft, {intel.wind_speed_mph} mph {intel.wind_direction_text} ({intel.wind_quality}). Check back at 10 AM or 2 PM for updated windows.
            </p>
          </div>
        )}

        {/* Conditions Grid - 2x2 on mobile, 4 cols on desktop */}
        <div className="grid grid-cols-2 gap-3">
          {/* Surf */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Waves className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Surf
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.surf_min_ft}-{intel.surf_max_ft} ft
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {intel.surf_description}
            </p>
          </div>

          {/* Wind */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <Wind className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Wind
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.wind_speed_mph} mph {intel.wind_direction_text}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {intel.wind_quality}
            </p>
          </div>

          {/* Tide */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">
                Tide
              </span>
            </div>
            <p className="font-semibold text-gray-900">
              {intel.tide_height_ft} ft @ {formatTime(intel.tide_time)}
            </p>
            {intel.tide_optimal_range && (
              <p className="text-xs text-muted-foreground truncate">
                Best: {intel.tide_optimal_range}
              </p>
            )}
          </div>

          {/* Confidence */}
          <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Confidence
              </span>
            </div>
            <p className="font-semibold text-gray-900">{intel.confidence}</p>
            {intel.conditions_score !== null &&
              intel.conditions_score !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Score: {intel.conditions_score}/100
                </p>
              )}
          </div>
        </div>

        {/* Recommendation - Why this window is best */}
        {intel.recommendation && (
          <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">
            <p className="text-sm text-gray-700 leading-relaxed">
              {intel.recommendation}
            </p>
          </div>
        )}

        {/* Next tide info */}
        {intel.next_tide_type && intel.next_tide_time && (
          <p className="text-xs text-muted-foreground text-center">
            Next {intel.next_tide_type}: {intel.next_tide_height_ft?.toFixed(1)}
            ft @ {intel.next_tide_time}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
