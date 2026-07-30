"use client";

import { useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { toForecastForScoring } from "@/lib/scoring";
import { calculateMultipleWindows } from "@/lib/scoring/window-calculator";
import { getConditionBoardPick } from "@/lib/scoring/board-pick";
import { calculateRelativeContext } from "@/lib/scoring/relative-context";
import { scoreNativeForecastSlot } from "@/lib/scoring/native-condition-score";
import type { SkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { getUserBoards } from "@/actions/board-actions";
import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import type { BeachWithThresholds, ConditionCharacter, MultiWindowResult, RelativeContext } from "@/lib/scoring/types";
import type { BoardPickResult, BoardForPick } from "@/lib/scoring/board-pick";

export interface ConditionIntelligenceResult {
  windows: MultiWindowResult["windows"];
  bestWindow: MultiWindowResult["bestWindow"];
  boardPick: BoardPickResult | null;
  relativeContext: RelativeContext | null;
  todayCharacter: ConditionCharacter | null;
  todayScore: number | null;
  loading: boolean;
}

/**
 * Orchestrates all condition intelligence computations for the beach detail page.
 *
 * Given a list of forecasts and beach config, this hook:
 * 1. Converts forecasts to ForecastForScoring via toForecastForScoring()
 * 2. Calls calculateMultipleWindows() to find ranked surf windows
 * 3. Fetches user's boards (when authenticated) and calls getConditionBoardPick()
 *    against the best window's peak forecast
 * 4. Groups forecasts by date, computes max score per day, then calls
 *    calculateRelativeContext() for best-of-week / trend / swell data
 * 5. Returns the best window's character + score as todayCharacter / todayScore
 *
 * All heavy computation runs inside useMemo, only recomputing when forecasts change.
 */
export function useConditionIntelligence(
  forecasts: EnhancedForecastEntity[] | undefined,
  beach: BeachWithThresholds | null | undefined,
  beachTimezone?: string | null,
  skillLevel?: SkillLevel | string | null
): ConditionIntelligenceResult {
  const { user } = useAuth();

  // Fetch user boards when authenticated
  const fetchBoards = useCallback(async () => {
    if (!user) return null;
    const result = await getUserBoards(user.id);
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  }, [user]);

  const { data: boardsData, loading: boardsLoading } = useDataFetcher(fetchBoards, {
    skip: !user,
  });

  // Convert raw boards to the BoardForPick shape expected by getConditionBoardPick
  const boards: BoardForPick[] = useMemo(() => {
    if (!boardsData) return [];
    return boardsData.map((b) => ({
      id: b.id,
      name: b.name,
      board_type: b.board_type,
      volume: b.volume ?? null,
    }));
  }, [boardsData]);

  // Core scoring computation — only recomputes when forecasts or beach change
  const scoringResult = useMemo(() => {
    if (!forecasts || forecasts.length === 0 || !beach) {
      return null;
    }

    // Convert to scoring-friendly format
    const scoringForecasts = forecasts.map((f) =>
      toForecastForScoring(f, beachTimezone ?? undefined)
    );

    // Calculate multiple surf windows for today
    const multiWindowResult = calculateMultipleWindows(scoringForecasts, beach, {
      beachTimezone: beachTimezone ?? undefined,
      skillLevel,
    });

    // Determine today's character and score from the best window
    let todayCharacter: ConditionCharacter | null = null;
    let todayScore: number | null = null;

    if (multiWindowResult.bestWindow) {
      todayCharacter = multiWindowResult.bestWindow.character ?? null;
      todayScore = multiWindowResult.bestWindow.avgScore ?? null;
    }

    // Group forecasts by date and compute max native score per day.
    const dateScoreMap: Record<string, number> = {};
    for (const forecast of forecasts) {
      const date = extractForecastDate(
        forecast.forecast_at,
        beachTimezone ?? undefined
      );
      const total = scoreNativeForecastSlot(forecast, skillLevel);
      const currentMax = dateScoreMap[date] ?? 0;
      if (total > currentMax) {
        dateScoreMap[date] = total;
      }
    }

    // Sort dates to determine today and subsequent days
    const sortedDates = Object.keys(dateScoreMap).sort();
    const weekScores = sortedDates.map((date) => ({
      date,
      score: dateScoreMap[date],
    }));

    // Today is index 0, yesterday would be just before today
    const todayDate = sortedDates[0] ?? null;
    const todayDailyScore =
      todayDate !== null ? (dateScoreMap[todayDate] ?? 0) : 0;

    // We don't have yesterday's data in this dataset, so pass null
    const relativeContext = weekScores.length > 0
      ? calculateRelativeContext(todayDailyScore, null, weekScores)
      : null;

    return {
      multiWindowResult,
      todayCharacter,
      todayScore,
      relativeContext,
    };
  }, [forecasts, beach, beachTimezone, skillLevel]);

  // Board pick computation — recomputes when scoring result or boards change
  const boardPick = useMemo(() => {
    if (!scoringResult || boards.length === 0 || !beach) return null;

    const { bestWindow } = scoringResult.multiWindowResult;
    if (!bestWindow) return null;

    // Use the peak time of the best window to find the representative forecast
    const peakTime = bestWindow.peakTime ?? bestWindow.start;
    if (!forecasts || forecasts.length === 0) return null;

    // Find the forecast closest to the peak time
    let closestForecast = forecasts[0];
    let minDiff = Infinity;
    for (const f of forecasts) {
      const diff = Math.abs(new Date(f.forecast_at).getTime() - peakTime.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestForecast = f;
      }
    }

    const scoringForecast = toForecastForScoring(closestForecast, beachTimezone ?? undefined);
    return getConditionBoardPick(scoringForecast, boards, beach);
  }, [scoringResult, boards, beach, forecasts, beachTimezone]);

  const loading = !!user && boardsLoading;

  if (!scoringResult) {
    return {
      windows: [],
      bestWindow: null,
      boardPick: null,
      relativeContext: null,
      todayCharacter: null,
      todayScore: null,
      loading,
    };
  }

  return {
    windows: scoringResult.multiWindowResult.windows,
    bestWindow: scoringResult.multiWindowResult.bestWindow,
    boardPick,
    relativeContext: scoringResult.relativeContext,
    todayCharacter: scoringResult.todayCharacter,
    todayScore: scoringResult.todayScore,
    loading,
  };
}
