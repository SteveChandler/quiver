"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { SessionFormState } from "@/hooks/use-session-form";
import {
  WavesIcon as Surfboard,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Target,
  Calendar,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GearSuggestionsSectionProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

interface BoardSuggestion {
  board: {
    id: string;
    name: string;
    board_type: string;
    dimensions: string;
    description?: string;
    image_url?: string;
  };
  score: number;
  confidence: number;
  reasons: string[];
  matchedConditions: {
    waveHeight: number;
    sessions: number;
    averageRating: number;
    lastUsed: string;
  };
}

export function GearSuggestionsSection({
  formState,
  updateField,
}: GearSuggestionsSectionProps) {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    formState.boardId || null
  );

  // Get wave height from optimal times selection
  const selectedOptimalTime = formState.optimalTimes?.find(
    (time) => time.time === formState.selectedOptimalTime
  );
  const waveHeight = selectedOptimalTime?.conditions.waveHeight || 3; // Default to 3ft
  const windSpeed = selectedOptimalTime?.conditions.windSpeed || 10; // Default to 10mph

  // Fetch gear suggestions based on conditions
  const fetchGearSuggestions = useCallback(async () => {
    if (!formState.selectedBeachId) {
      return null;
    }

    const params = new URLSearchParams({
      waveHeight: waveHeight.toString(),
      windSpeed: windSpeed.toString(),
      beachId: formState.selectedBeachId,
    });

    const response = await fetch(
      `/api/session-planner/gear-suggestions?${params}`,
      {
        credentials: "include", // Ensure cookies are included
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gear suggestions API error:", response.status, errorData);
      throw new Error(
        `Failed to fetch gear suggestions: ${response.status} ${errorData}`
      );
    }

    return response.json();
  }, [formState.selectedBeachId, waveHeight, windSpeed]);

  const { data, loading, error, refetch } = useDataFetcher(
    fetchGearSuggestions,
    {
      skip: !formState.selectedBeachId, // skip when no beach ID (inverted logic from enabled)
    }
  );

  // Update form state when gear suggestions are loaded
  useEffect(() => {
    if (data?.success && data.data?.suggestions) {
      updateField(
        "boardSuggestions",
        data.data.suggestions.map((suggestion: BoardSuggestion) => ({
          boardId: suggestion.board.id,
          score: suggestion.score,
          confidence: suggestion.confidence,
          reasons: suggestion.reasons,
        }))
      );
    }
  }, [data, updateField]);

  // Handle board selection
  const handleBoardSelect = useCallback(
    (boardId: string) => {
      setSelectedBoardId(boardId);
      updateField("boardId", boardId);
      updateField("selectedBoard", boardId);
    },
    [updateField]
  );

  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Surfboard className="w-5 h-5 mr-2" />
            Analyzing Your Quiver...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertCircle className="w-5 h-5 mr-2" />
            Unable to Load Gear Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message ||
                "Failed to analyze your boards. You can still manually select equipment."}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            variant="outline"
            onClick={refetch}
            className="mt-3"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no beach selected
  if (!formState.selectedBeachId) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Surfboard className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">
              Select a beach to see smart board recommendations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const suggestions = data?.data?.suggestions || [];
  const analysisResults = data?.data?.analysisResults;

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Surfboard className="w-5 h-5 mr-2" />
            Board Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No boards found in your quiver. Add some boards to your collection
              to get personalized recommendations.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-blue-600";
    if (confidence >= 0.4) return "text-yellow-600";
    return "text-gray-600";
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Good";
    if (confidence >= 0.4) return "Medium";
    return "Low";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Surfboard className="w-5 h-5 mr-2 text-primary" />
            Smart Board Recommendations
          </div>
          <Badge variant="outline" className="text-xs">
            {waveHeight}ft waves • {windSpeed}mph wind
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <span>Based on your surf history and current conditions</span>
          {analysisResults && (
            <Badge variant="secondary" className="text-xs">
              {analysisResults.analyzedSessions} sessions analyzed
            </Badge>
          )}
        </div>

        <div className="grid gap-3">
          {suggestions
            .slice(0, 3)
            .map((suggestion: BoardSuggestion, index: number) => {
              const isSelected = selectedBoardId === suggestion.board.id;
              const isTopChoice = index === 0;

              // Memoize the click handler to prevent ref loops
              const handleClick = () => handleBoardSelect(suggestion.board.id);

              return (
                <Button
                  type="button"
                  key={suggestion.board.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "h-auto p-4 text-left justify-start relative",
                    isSelected && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={handleClick}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {suggestion.board.name}
                        </span>
                        {isTopChoice && (
                          <Badge variant="secondary" className="text-xs">
                            <Target className="w-3 h-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground mb-2">
                        {suggestion.board.board_type} •{" "}
                        {suggestion.board.dimensions}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {suggestion.matchedConditions.sessions} sessions
                        </div>
                        {suggestion.matchedConditions.averageRating > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {suggestion.matchedConditions.averageRating.toFixed(
                              1
                            )}{" "}
                            avg rating
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(
                            suggestion.matchedConditions.lastUsed
                          ).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {suggestion.reasons.slice(0, 2).join(" • ")}
                        {suggestion.reasons.length > 2 && " • ..."}
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <div className="text-lg font-bold text-primary">
                        {suggestion.score}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-medium",
                          getConfidenceColor(suggestion.confidence)
                        )}
                      >
                        {getConfidenceLabel(suggestion.confidence)} confidence
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
        </div>

        {suggestions.length > 3 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing top 3 recommendations from your {suggestions.length} boards.
          </p>
        )}

        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Recommendations are based on your past session ratings, board
            performance in similar conditions, and how recently you've used each
            board.
          </p>
        </div>

        {analysisResults?.recommendationBasis && (
          <div className="text-xs text-muted-foreground text-center mt-2">
            Analysis: {analysisResults.recommendationBasis}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
