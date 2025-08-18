import { NextRequest, NextResponse } from "next/server";
import { createAPIServerClient, getAuthenticatedAPIClient } from "@/lib/supabase/api-server-client";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-response-utils";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

interface GearSuggestionsResponse {
  userId: string;
  conditions: {
    waveHeight: number;
    windSpeed: number;
    beachId: string | null;
  };
  suggestions: BoardSuggestion[];
  analysisResults: {
    totalSessions: number;
    analyzedSessions: number;
    recommendationBasis: string;
  };
  generatedAt: string;
}

/**
 * Analyzes user's past sessions to recommend boards based on conditions
 * GET /api/session-planner/gear-suggestions?waveHeight=4&windSpeed=8&beachId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const waveHeight = parseFloat(searchParams.get("waveHeight") || "0");
    const windSpeed = parseFloat(searchParams.get("windSpeed") || "0");
    const beachId = searchParams.get("beachId");

    if (!waveHeight || !windSpeed) {
      return createErrorResponse(
        "Wave height and wind speed are required",
        null,
        400
      );
    }

    // Use API-specific Supabase client to ensure cookies are correctly read in API routes
    const { supabase, user, error: authError } = await getAuthenticatedAPIClient();
    if (authError || !supabase || !user) {
      return createErrorResponse("Authentication required", null, 401);
    }

    // Get user's boards
    const { data: boards, error: boardsError } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (boardsError) {
      console.error("Error fetching user boards:", boardsError);
      return createErrorResponse(
        "Failed to fetch user boards",
        boardsError.message
      );
    }

    if (!boards || boards.length === 0) {
      return createSuccessResponse({
        userId: user.id,
        conditions: { waveHeight, windSpeed, beachId },
        suggestions: [],
        analysisResults: {
          totalSessions: 0,
          analyzedSessions: 0,
          recommendationBasis: "No boards found",
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // Get user's past sessions with ratings and conditions
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(
        `
        *,
        boards(*)
      `
      )
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("rating", "is", null)
      .not("wave_quality", "is", null)
      .order("created_at", { ascending: false })
      .limit(50); // Analyze last 50 sessions

    if (sessionsError) {
      console.error("Error fetching user sessions:", sessionsError);
      return createErrorResponse(
        "Failed to fetch user sessions",
        sessionsError.message
      );
    }

    // Analyze sessions to generate board recommendations
    const suggestions = analyzeGearSuggestions(boards, sessions || [], {
      waveHeight,
      windSpeed,
      beachId,
    });

    const response: GearSuggestionsResponse = {
      userId: user.id,
      conditions: { waveHeight, windSpeed, beachId },
      suggestions,
      analysisResults: {
        totalSessions: sessions?.length || 0,
        analyzedSessions:
          sessions?.filter((s) => s.boards && s.rating).length || 0,
        recommendationBasis:
          sessions?.length > 0
            ? "Historical session data"
            : "Board catalog only",
      },
      generatedAt: new Date().toISOString(),
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error("Error generating gear suggestions:", error);
    return createErrorResponse(
      "Failed to generate gear suggestions",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Analyzes user's session history to recommend boards for given conditions
 */
function analyzeGearSuggestions(
  boards: any[],
  sessions: any[],
  conditions: { waveHeight: number; windSpeed: number; beachId: string | null }
): BoardSuggestion[] {
  const suggestions: BoardSuggestion[] = [];

  boards.forEach((board) => {
    let score = 0;
    let confidence = 0;
    const reasons: string[] = [];

    // Find sessions with this board
    const boardSessions = sessions.filter((s) => s.board_id === board.id);

    if (boardSessions.length === 0) {
      // No historical data - base recommendation on board type and conditions
      const baseScore = getBoardTypeScore(
        board.board_type,
        conditions.waveHeight
      );
      score = baseScore;
      confidence = 0.3; // Low confidence without historical data
      reasons.push(
        `${board.board_type} recommended for ${conditions.waveHeight}ft waves`
      );

      if (board.dimensions) {
        const dimensionScore = getDimensionScore(
          board.dimensions,
          conditions.waveHeight
        );
        score += dimensionScore;
        if (dimensionScore > 0) {
          reasons.push(`Board size suitable for conditions`);
        }
      }
    } else {
      // Analyze historical performance
      const relevantSessions = boardSessions.filter((session) => {
        const sessionWaveHeight = session.wave_quality || 0;
        const waveHeightDiff = Math.abs(
          sessionWaveHeight - conditions.waveHeight
        );
        return waveHeightDiff <= 2; // Within 2 feet of target conditions
      });

      if (relevantSessions.length > 0) {
        const avgRating =
          relevantSessions.reduce((sum, s) => sum + (s.rating || 0), 0) /
          relevantSessions.length;
        const recentSessions = relevantSessions.filter((s) => {
          const sessionDate = new Date(s.created_at);
          const monthsAgo =
            (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
          return monthsAgo <= 12; // Within last 12 months
        });

        score = avgRating * 20; // Rating of 4-5 = 80-100 points
        confidence = Math.min(0.9, 0.3 + recentSessions.length * 0.1);

        reasons.push(
          `Average rating: ${avgRating.toFixed(1)}/5 in similar conditions`
        );
        reasons.push(`Used in ${relevantSessions.length} similar sessions`);

        if (recentSessions.length > 0) {
          reasons.push(`Recently used ${recentSessions.length} times`);
        }
      } else {
        // Board exists but no similar conditions
        const avgRating =
          boardSessions.reduce((sum, s) => sum + (s.rating || 0), 0) /
          boardSessions.length;
        score = avgRating * 10; // Lower score for different conditions
        confidence = 0.4;
        reasons.push(
          `Good performance in other conditions (${avgRating.toFixed(1)}/5)`
        );
        reasons.push(`Used in ${boardSessions.length} sessions`);
      }
    }

    // Beach-specific bonus
    if (conditions.beachId) {
      const beachSessions = boardSessions.filter(
        (s) => s.beach_id === conditions.beachId
      );
      if (beachSessions.length > 0) {
        const beachAvgRating =
          beachSessions.reduce((sum, s) => sum + (s.rating || 0), 0) /
          beachSessions.length;
        score += beachAvgRating * 5; // Bonus for beach-specific performance
        confidence += 0.1;
        reasons.push(
          `Good performance at this beach (${beachAvgRating.toFixed(1)}/5)`
        );
      }
    }

    // Usage frequency bonus
    if (boardSessions.length > 0) {
      const lastUsed = boardSessions[0].created_at;
      const monthsSinceUsed =
        (Date.now() - new Date(lastUsed).getTime()) /
        (1000 * 60 * 60 * 24 * 30);

      if (monthsSinceUsed <= 3) {
        score += 5;
        reasons.push("Recently used board");
      }
    }

    // Calculate matched conditions data
    const matchedConditions = {
      waveHeight: conditions.waveHeight,
      sessions: boardSessions.length,
      averageRating:
        boardSessions.length > 0
          ? boardSessions.reduce((sum, s) => sum + (s.rating || 0), 0) /
            boardSessions.length
          : 0,
      lastUsed:
        boardSessions.length > 0
          ? boardSessions[0].created_at
          : board.created_at,
    };

    suggestions.push({
      board: {
        id: board.id,
        name: board.name,
        board_type: board.board_type,
        dimensions: board.dimensions,
        description: board.description,
        image_url: board.image_url,
      },
      score: Math.round(score),
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      matchedConditions,
    });
  });

  // Sort by score (best first) and filter out very low scores
  const filteredSuggestions = suggestions.filter((s) => s.score > 0);

  return filteredSuggestions.sort((a, b) => b.score - a.score);
}

/**
 * Get base score for board type based on wave height
 */
function getBoardTypeScore(boardType: string, waveHeight: number): number {
  const type = boardType.toLowerCase();

  if (waveHeight <= 2) {
    // Small waves - longboards and funboards work better
    if (type.includes("longboard")) return 40;
    if (type.includes("funboard") || type.includes("mid-length")) return 35;
    if (type.includes("shortboard")) return 20;
    if (type.includes("fish")) return 30;
  } else if (waveHeight <= 4) {
    // Medium waves - most boards work well
    if (type.includes("shortboard")) return 35;
    if (type.includes("funboard") || type.includes("mid-length")) return 40;
    if (type.includes("longboard")) return 30;
    if (type.includes("fish")) return 35;
  } else if (waveHeight <= 6) {
    // Bigger waves - shortboards and performance boards
    if (type.includes("shortboard")) return 40;
    if (type.includes("gun") || type.includes("semi-gun")) return 35;
    if (type.includes("funboard")) return 25;
    if (type.includes("longboard")) return 15;
  } else {
    // Big waves - guns and performance boards
    if (type.includes("gun") || type.includes("semi-gun")) return 45;
    if (type.includes("shortboard")) return 35;
    if (type.includes("longboard")) return 10;
    if (type.includes("funboard")) return 15;
  }

  return 25; // Default score
}

/**
 * Get dimension-based score for wave height
 */
function getDimensionScore(dimensions: string, waveHeight: number): number {
  // Extract length from dimensions (e.g., "6'2\" x 19\" x 2.5\"")
  const lengthMatch = dimensions.match(/(\d+)'(\d+)/);
  if (!lengthMatch) return 0;

  const lengthFeet = parseInt(lengthMatch[1]);
  const lengthInches = parseInt(lengthMatch[2]);
  const totalLength = lengthFeet + lengthInches / 12;

  // Scoring based on length vs wave height
  if (waveHeight <= 2) {
    // Small waves - longer boards better
    if (totalLength >= 8) return 10;
    if (totalLength >= 7) return 5;
    return 0;
  } else if (waveHeight <= 4) {
    // Medium waves - 6-8 foot boards ideal
    if (totalLength >= 6 && totalLength <= 8) return 10;
    if (totalLength >= 5.5 && totalLength <= 8.5) return 5;
    return 0;
  } else {
    // Bigger waves - shorter boards better
    if (totalLength >= 5.5 && totalLength <= 6.5) return 10;
    if (totalLength >= 5 && totalLength <= 7) return 5;
    return 0;
  }
}
