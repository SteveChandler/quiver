"use client";

import React from "react";
import { format } from "date-fns";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Waves, Wind, Ruler, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimilarSessionInsight } from "@/types/personalization";

/**
 * Props for SimilarSessionsDrawer component
 */
interface SimilarSessionsDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when drawer state changes */
  onOpenChange: (open: boolean) => void;
  /** List of similar sessions to display */
  sessions: SimilarSessionInsight[];
  /** Current forecast conditions for comparison */
  currentConditions?: {
    waveHeight: string;
    wavePeriod: string;
    wind: string;
  };
}

/**
 * Get badge color based on similarity score
 */
function getMatchBadgeColor(score: number): {
  variant: "default" | "secondary" | "destructive" | "outline" | "blue";
  className: string;
} {
  if (score >= 80) {
    return {
      variant: "default",
      className: "bg-green-600 text-white hover:bg-green-700",
    };
  }
  if (score >= 60) {
    return {
      variant: "blue",
      className: "",
    };
  }
  if (score >= 40) {
    return {
      variant: "default",
      className: "bg-yellow-600 text-white hover:bg-yellow-700",
    };
  }
  return {
    variant: "outline",
    className: "",
  };
}

/**
 * Format wave height for display
 */
function formatWaveHeight(height: number | null): string {
  if (height === null) return "N/A";
  return `${height.toFixed(1)} ft`;
}

/**
 * Format wind speed for display
 */
function formatWindSpeed(speed: number | null): string {
  if (speed === null) return "N/A";
  return `${speed.toFixed(0)} mph`;
}

/**
 * SimilarSessionsDrawer displays a list of past sessions with similar conditions
 *
 * Features:
 * - Current forecast conditions summary
 * - List of similar sessions with match scores
 * - Session details (date, beach, rating, conditions)
 * - Board used if available
 * - Empty state when no sessions found
 *
 * @example
 * ```tsx
 * <SimilarSessionsDrawer
 *   open={showDrawer}
 *   onOpenChange={setShowDrawer}
 *   sessions={insights.similarSessions}
 *   currentConditions={{
 *     waveHeight: "3-4 ft",
 *     wavePeriod: "12s",
 *     wind: "10 mph SW"
 *   }}
 * />
 * ```
 */
export function SimilarSessionsDrawer({
  open,
  onOpenChange,
  sessions,
  currentConditions,
}: SimilarSessionsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DrawerTitle className="text-xl font-bold">
                Similar Past Sessions
              </DrawerTitle>
              <DrawerDescription className="mt-1">
                Your sessions with similar conditions
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6">
          {/* Current Forecast Conditions */}
          {currentConditions && (
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  Current Forecast
                </h3>
                <div className="flex items-center gap-4 text-sm text-blue-700">
                  <div className="flex items-center gap-1.5">
                    <Waves className="h-4 w-4" />
                    <span>{currentConditions.waveHeight}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Waves className="h-4 w-4" />
                    <span>{currentConditions.wavePeriod}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wind className="h-4 w-4" />
                    <span>{currentConditions.wind}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sessions List */}
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-1">
                No Similar Sessions Found
              </p>
              <p className="text-sm text-gray-500">
                Log more sessions to see comparisons with similar conditions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const matchBadge = getMatchBadgeColor(session.similarityScore);
                const sessionDate = new Date(session.sessionDate);

                return (
                  <Card key={session.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-base truncate">
                            {session.beachName}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {format(sessionDate, "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge
                          variant={matchBadge.variant}
                          className={matchBadge.className}
                        >
                          {session.similarityScore}% Match
                        </Badge>
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1 mb-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "h-4 w-4",
                              i < session.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            )}
                          />
                        ))}
                        <span className="text-sm text-muted-foreground ml-1">
                          ({session.rating}/5)
                        </span>
                      </div>

                      {/* Conditions */}
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Waves className="h-4 w-4 text-blue-500" />
                          <span>{formatWaveHeight(session.waveHeight)}</span>
                        </div>
                        {session.wavePeriod && (
                          <div className="flex items-center gap-1.5">
                            <Waves className="h-4 w-4 text-cyan-500" />
                            <span>{session.wavePeriod}s</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Wind className="h-4 w-4 text-green-500" />
                          <span>{formatWindSpeed(session.windSpeed)}</span>
                        </div>
                      </div>

                      {/* Board Used */}
                      {session.boardName && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 bg-gray-50 rounded px-2 py-1 mt-2">
                          <Ruler className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{session.boardName}</span>
                          {session.boardType && (
                            <span className="text-gray-500">
                              ({session.boardType})
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
