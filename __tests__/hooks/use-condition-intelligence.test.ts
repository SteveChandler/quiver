/**
 * Tests for useConditionIntelligence hook.
 *
 * The hook orchestrates the scoring pipeline for the beach detail page:
 *   - Fetches user boards (when authenticated)
 *   - Calls calculateMultipleWindows() with forecast data
 *   - Calls getConditionBoardPick() with best window + user boards
 *   - Calls calculateRelativeContext() from daily scores
 *   - Returns { windows, boardPick, relativeContext, todayScore, character, loading }
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useConditionIntelligence } from "@/hooks/use-condition-intelligence";
import { useAuth } from "@/context/auth-context";
import { getUserBoards } from "@/actions/board-actions";
import { calculateMultipleWindows } from "@/lib/scoring/window-calculator";
import { getConditionBoardPick } from "@/lib/scoring/board-pick";
import { calculateRelativeContext } from "@/lib/scoring/relative-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { BeachWithThresholds, ForecastForScoring, MultiWindowResult, RelativeContext, ConditionCharacter } from "@/lib/scoring/types";
import type { BoardForPick, BoardPickResult } from "@/lib/scoring/board-pick";
import type { EnhancedForecastEntity } from "@/types/forecast";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/actions/board-actions", () => ({
  getUserBoards: jest.fn(),
}));

jest.mock("@/lib/scoring/window-calculator", () => ({
  calculateMultipleWindows: jest.fn(),
}));

jest.mock("@/lib/scoring/board-pick", () => ({
  getConditionBoardPick: jest.fn(),
}));

jest.mock("@/lib/scoring/relative-context", () => ({
  calculateRelativeContext: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockUseAuth = useAuth as jest.Mock;
const mockGetUserBoards = getUserBoards as jest.Mock;
const mockCalculateMultipleWindows = calculateMultipleWindows as jest.Mock;
const mockGetConditionBoardPick = getConditionBoardPick as jest.Mock;
const mockCalculateRelativeContext = calculateRelativeContext as jest.Mock;
const mockUseDataFetcher = useDataFetcher as jest.Mock;

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockBeach: BeachWithThresholds = {
  id: "beach-1",
  name: "Test Beach",
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 30,
  preferred_tide_ft_min: 2.0,
  preferred_tide_ft_max: 5.0,
  max_wind_onshore_mph: 10,
  max_wind_any_mph: 25,
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 45,
};

const mockBeachTimezone = "America/Los_Angeles";

/** Minimal EnhancedForecastEntity shape sufficient for the hook to process */
function makeMockForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: "fc-1",
    beach_id: "beach-1",
    forecast_at: "2026-03-25T08:00:00Z",
    forecast_date: "2026-03-25",
    forecast_time: "08:00:00",
    wave_height: "3.5",
    wave_period: "12s",
    wind_speed: "5",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_height: "3.0",
    tide_status: "rising",
    swell_1_direction: "270",
    created_at: "2026-03-25T00:00:00Z",
    updated_at: "2026-03-25T00:00:00Z",
    ...overrides,
  } as EnhancedForecastEntity;
}

const mockForecasts: EnhancedForecastEntity[] = [
  makeMockForecast({ forecast_at: "2026-03-25T06:00:00Z", forecast_time: "06:00:00" }),
  makeMockForecast({ forecast_at: "2026-03-25T09:00:00Z", forecast_time: "08:00:00" }),
  makeMockForecast({ forecast_at: "2026-03-25T12:00:00Z", forecast_time: "12:00:00" }),
];

const mockBoards: BoardForPick[] = [
  { id: "board-1", name: "My Shortboard", board_type: "shortboard", volume: 28 },
  { id: "board-2", name: "My Fish", board_type: "fish", volume: 35 },
];

const mockWindowResult: MultiWindowResult = {
  windows: [
    {
      start: new Date("2026-03-25T06:00:00Z"),
      end: new Date("2026-03-25T10:00:00Z"),
      startReason: { time: new Date("2026-03-25T06:00:00Z"), factor: "score", description: "Score above threshold" },
      endReason: { time: new Date("2026-03-25T10:00:00Z"), factor: "score", description: "Score dropped" },
      message: "Good morning window",
      peakTime: new Date("2026-03-25T15:00:00Z"),
      peakScore: 88,
      avgScore: 72,
      character: { label: "Dialed", category: "medium-clean" },
    },
  ],
  bestWindow: {
    start: new Date("2026-03-25T06:00:00Z"),
    end: new Date("2026-03-25T10:00:00Z"),
    startReason: { time: new Date("2026-03-25T06:00:00Z"), factor: "score", description: "Score above threshold" },
    endReason: { time: new Date("2026-03-25T10:00:00Z"), factor: "score", description: "Score dropped" },
    message: "Good morning window",
    peakTime: new Date("2026-03-25T15:00:00Z"),
    peakScore: 88,
    avgScore: 72,
    character: { label: "Dialed", category: "medium-clean" },
  },
};

const mockBoardPick: BoardPickResult = {
  boardId: "board-1",
  boardName: "My Shortboard",
  boardType: "shortboard",
  reason: "My Shortboard conditions — enjoy the fun waves",
};

const mockRelativeContext: RelativeContext = {
  isBestOfWeek: true,
  trend: "improving",
  trendDelta: 12,
  incomingSwell: null,
};

const mockCharacter: ConditionCharacter = {
  label: "Dialed",
  category: "medium-clean",
};

// ---------------------------------------------------------------------------
// Helper: set up the useDataFetcher mock to return boards data
// ---------------------------------------------------------------------------

function mockDataFetcherWithBoards(
  boards: BoardForPick[],
  loading = false,
  error: string | null = null
) {
  mockUseDataFetcher.mockReturnValue({
    data: boards,
    loading,
    error,
    refetch: jest.fn(),
    retry: jest.fn(),
    reset: jest.fn(),
  });
}

function mockDataFetcherLoading() {
  mockUseDataFetcher.mockReturnValue({
    data: null,
    loading: true,
    error: null,
    refetch: jest.fn(),
    retry: jest.fn(),
    reset: jest.fn(),
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("useConditionIntelligence", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    // Default: authenticated user
    mockUseAuth.mockReturnValue({ user: { id: "user-123" } });

    // Default: window calculator returns mock windows
    mockCalculateMultipleWindows.mockReturnValue(mockWindowResult);

    // Default: board pick returns a result
    mockGetConditionBoardPick.mockReturnValue(mockBoardPick);

    // Default: relative context computation
    mockCalculateRelativeContext.mockReturnValue(mockRelativeContext);

    // Default: boards loaded
    mockDataFetcherWithBoards(mockBoards);
  });

  // -------------------------------------------------------------------------
  // 1. Empty inputs
  // -------------------------------------------------------------------------

  it("returns empty results when no forecasts provided", () => {
    const { result } = renderHook(() =>
      useConditionIntelligence([], mockBeach, mockBeachTimezone)
    );

    expect(result.current.windows).toEqual([]);
    expect(result.current.bestWindow).toBeNull();
  });

  it("returns empty results when no beach provided", () => {
    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, null, mockBeachTimezone)
    );

    expect(result.current.windows).toEqual([]);
    expect(result.current.bestWindow).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. Window computation
  // -------------------------------------------------------------------------

  it("computes windows from forecast data — calls calculateMultipleWindows", () => {
    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(mockCalculateMultipleWindows).toHaveBeenCalledTimes(1);
    // First argument should be an array of ForecastForScoring (converted from EnhancedForecastEntity)
    const [forecastsArg, beachArg, optionsArg] = mockCalculateMultipleWindows.mock.calls[0];
    expect(Array.isArray(forecastsArg)).toBe(true);
    expect(forecastsArg.length).toBe(mockForecasts.length);
    expect(beachArg).toEqual(mockBeach);
    expect(optionsArg).toEqual({
      beachTimezone: mockBeachTimezone,
      skillLevel: undefined,
      boardClasses: ["shortboard", "fish"],
    });

    expect(result.current.windows).toEqual(mockWindowResult.windows);
    expect(result.current.bestWindow).toEqual(mockWindowResult.bestWindow);
  });

  // -------------------------------------------------------------------------
  // 3. Board pick — authenticated with boards
  // -------------------------------------------------------------------------

  it("uses the best window peak for the score, character, and board pick", () => {
    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(mockGetConditionBoardPick).toHaveBeenCalledTimes(1);
    const [boardForecast] = mockGetConditionBoardPick.mock.calls[0];
    expect(boardForecast.forecastTime).toEqual(
      new Date("2026-03-25T15:00:00Z"),
    );
    expect(mockGetConditionBoardPick).toHaveBeenCalledWith(
      expect.anything(),
      mockBoards,
      mockBeach,
      { kind: "scored", boardClass: null },
    );
    expect(result.current.todayScore).toBe(88);
    expect(result.current.bestWindow?.character).toEqual({
      label: "Dialed",
      category: "medium-clean",
    });
    expect(result.current.boardPick).toEqual(mockBoardPick);
  });

  // -------------------------------------------------------------------------
  // 4. Board pick — unauthenticated
  // -------------------------------------------------------------------------

  it("returns null boardPick when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null });
    // When skip=true (no user), useDataFetcher returns null data
    mockUseDataFetcher.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
      retry: jest.fn(),
      reset: jest.fn(),
    });

    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(mockGetConditionBoardPick).not.toHaveBeenCalled();
    expect(result.current.boardPick).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. Board pick — authenticated but no boards
  // -------------------------------------------------------------------------

  it("returns null boardPick when user has no boards", () => {
    mockDataFetcherWithBoards([]);
    mockGetConditionBoardPick.mockReturnValue(null);

    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(result.current.boardPick).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Relative context
  // -------------------------------------------------------------------------

  it("computes relative context from daily scores — calls calculateRelativeContext", () => {
    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(mockCalculateRelativeContext).toHaveBeenCalledTimes(1);
    expect(result.current.relativeContext).toEqual(mockRelativeContext);
  });

  // -------------------------------------------------------------------------
  // 7. Loading state while boards are fetching
  // -------------------------------------------------------------------------

  it("returns loading=true while boards are fetching", () => {
    mockDataFetcherLoading();

    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(result.current.loading).toBe(true);
  });

  it("returns loading=false when boards have loaded", () => {
    mockDataFetcherWithBoards(mockBoards, false);

    const { result } = renderHook(() =>
      useConditionIntelligence(mockForecasts, mockBeach, mockBeachTimezone)
    );

    expect(result.current.loading).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 8. Recomputes when forecasts change (useMemo dependency)
  // -------------------------------------------------------------------------

  it("recomputes windows when forecasts prop changes", () => {
    const { result, rerender } = renderHook(
      ({ forecasts }: { forecasts: EnhancedForecastEntity[] }) =>
        useConditionIntelligence(forecasts, mockBeach, mockBeachTimezone),
      { initialProps: { forecasts: mockForecasts } }
    );

    expect(mockCalculateMultipleWindows).toHaveBeenCalledTimes(1);

    // Add a new forecast — should trigger recomputation
    const updatedForecasts = [
      ...mockForecasts,
      makeMockForecast({ id: "fc-new", forecast_at: "2026-03-25T15:00:00Z" }),
    ];

    rerender({ forecasts: updatedForecasts });

    expect(mockCalculateMultipleWindows).toHaveBeenCalledTimes(2);
    const [secondCallForecasts] = mockCalculateMultipleWindows.mock.calls[1];
    expect(secondCallForecasts.length).toBe(updatedForecasts.length);
  });
});
