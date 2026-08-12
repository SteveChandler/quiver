"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserBoards } from "@/actions/board-actions";
import { getBeaches } from "@/actions/beach-actions";
import { Board, Beach } from "@/types/database";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import type { SessionDecomposition } from "@/lib/session-fit";
import { createSessionLogFlowId } from "@/lib/analytics/session-log-funnel";

export type SessionFormState = {
  /** Transient correlation ID; consumed by funnel telemetry, never persisted. */
  sessionLogFlowId?: string;
  selectedBeach: string;
  selectedBeachId?: string;
  selectedDate: string;
  selectedTime: string;
  selectedBoard: string;
  boardId?: string;
  duration: string;
  waveQuality: string;
  waterTemp: string;
  crowdLevel: string;
  parkingEase: string;
  overallRating: string;
  notes: string;
  photos: File[]; // Changed from string[] to File[] to fix photo handling
  waveCharacteristics: string[]; // Array of wave characteristic IDs
  waveTypes: string[]; // Back-compat alias for older call sites
  // NEW FIELDS (fix data loss from ConditionsSection):
  waveHeight?: number; // Actual wave height in feet
  windSpeed?: number; // Wind speed in mph
  windDirection?: string; // Wind direction (N, NE, E, etc.)
  forecastAccuracy?: "accurate" | "somewhat" | "inaccurate"; // User-reported forecast accuracy
  recommendationId?: string;
  recommendationSurface?: string;
  recommendationRank?: number;
  recommendationScore?: number;
  recommendationWindowStart?: string;
  recommendationWindowEnd?: string;
  recommendationTimeSlot?: string;
  recommendationCallAccuracy?: "right" | "partly" | "wrong" | "not_sure";
  forecastWaveHeightFt?: number;
  forecastTideStatus?: string;
  waveHeightEdited?: boolean;
  tideStatusEdited?: boolean;
  // Tide fields for session conditions:
  tideHeight?: number; // User-reported tide height in feet
  tideStatus?: string; // User-reported tide status (rising, falling, high, low)
  ripCurrentObserved?: "none" | "light" | "strong"; // User-observed rip current strength
  // Visibility fields
  isPublic: boolean; // Whether session is visible to others (default true)
  isMuted: boolean; // Whether session is hidden from community feed (default false)
  selectedGoals: string[];
  skillRatings: Record<string, number>;
  sessionDecomposition: SessionDecomposition | null;
};

export type SessionFormMode = "log";

/**
 * Parameters for configuring the session form hook
 */
export type SessionFormHookParams = {
  /**
   * Initial form mode. Session creation is log-only.
   */
  initialMode: SessionFormMode;
  /**
   * Optional initial form state overrides for prefilling the wizard.
   * These values will be merged with defaults on initial mount only.
   * The reset function will always reset to canonical defaults, not these overrides.
   *
   * @example
   * ```typescript
   * const form = useSessionForm({
   *   initialMode: 'log',
   *   initialFormState: {
   *     selectedBeachId: 'abc-123',
   *     selectedBeach: 'Pacific Beach',
   *     selectedDate: '2025-11-22',
   *     selectedTime: '06:00',
   *   }
   * });
   * ```
   */
  initialFormState?: Partial<SessionFormState>;
  /**
   * Enable quick log mode defaults (today's date, morning/afternoon time, 1h duration).
   */
  quick?: boolean;
};

/**
 * Gets the canonical default state for the session form based on mode.
 * This is the "clean slate" state used for initialization and resets.
 */
function getDefaultFormState(mode: SessionFormMode): SessionFormState {
  return {
    sessionLogFlowId: createSessionLogFlowId(),
    selectedBeach: "",
    selectedBeachId: "",
    selectedDate: new Date().toISOString().split("T")[0], // Default to today
    selectedTime: "06:00", // Default to dawn patrol time
    selectedBoard: "",
    boardId: undefined,
    duration: "60m", // Default to 1 hour
    waveQuality: "",
    waterTemp: "",
    crowdLevel: "",
    parkingEase: "",
    overallRating: "",
    notes: "",
    photos: [],
    waveCharacteristics: [],
    waveTypes: [],
    // NEW FIELDS (initialize to undefined to prevent data loss)
    waveHeight: undefined,
    windSpeed: undefined,
    windDirection: undefined,
    forecastAccuracy: undefined,
    recommendationId: undefined,
    recommendationSurface: undefined,
    recommendationRank: undefined,
    recommendationScore: undefined,
    recommendationWindowStart: undefined,
    recommendationWindowEnd: undefined,
    recommendationTimeSlot: undefined,
    recommendationCallAccuracy: undefined,
    forecastWaveHeightFt: undefined,
    forecastTideStatus: undefined,
    waveHeightEdited: false,
    tideStatusEdited: false,
    // Tide fields (initialize to undefined)
    tideHeight: undefined,
    tideStatus: undefined,
    ripCurrentObserved: undefined,
    // Visibility defaults
    isPublic: true,
    isMuted: false,
    selectedGoals: [],
    skillRatings: {},
    sessionDecomposition: null,
  };
}

/**
 * Session form hook with optional initial state overrides.
 *
 * Supports both legacy usage (passing mode directly) and new usage (passing params object).
 *
 * @param params - Either a SessionFormMode string (legacy) or a SessionFormHookParams object (new)
 *
 * @example
 * // Legacy usage (backwards compatible)
 * const form = useSessionForm('log');
 *
 * @example
 * // New usage with prefill
 * const form = useSessionForm({
 *   initialMode: 'log',
 *   initialFormState: {
 *     selectedBeachId: 'abc-123',
 *     selectedBeach: 'Pacific Beach',
 *     selectedDate: '2025-11-22',
 *     selectedTime: '06:00',
 *   }
 * });
 */
export function useSessionForm(
  params: SessionFormMode | SessionFormHookParams = "log"
) {
  // Support both legacy (mode string) and new (params object) usage
  const { initialMode, initialFormState, quick } =
    typeof params === "string"
      ? { initialMode: params, initialFormState: undefined, quick: false }
      : { ...params, quick: params.quick ?? false };

  const { user } = useAuth();
  const [mode, setMode] = useState<SessionFormMode>(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [beaches, setBeaches] = useState<Beach[]>([]);

  // Compute initial state once: merge defaults with any provided overrides
  const [formState, setFormState] = useState<SessionFormState>(() => {
    const defaultState = getDefaultFormState(initialMode);

    // Apply quick mode defaults: today's date, morning/afternoon time, 1h duration
    if (quick) {
      const now = new Date();
      const hour = now.getHours();
      defaultState.selectedDate = now.toISOString().split("T")[0];
      defaultState.selectedTime = hour < 12 ? "07:00" : "14:00";
      defaultState.duration = "60m";
    }

    // If overrides provided, merge them (overrides take precedence)
    if (initialFormState) {
      return { ...defaultState, ...initialFormState };
    }

    return defaultState;
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        if (!user) {
          setLoadingData(false);
          return;
        }

        const userBoardsResult = await getUserBoards(user.id);

        if (userBoardsResult.success && userBoardsResult.data) {
          setBoards(userBoardsResult.data);

          if (userBoardsResult.data.length === 0) {
            toast.info(
              "You don't have any boards yet. Add a board to get started!"
            );
            // Later, we can implement a more interactive prompt here.
          }
        }

        const beachResult = await getBeaches();
        if (beachResult.success && beachResult.data) {
          setBeaches(beachResult.data);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load data. Some features may be limited.");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    const board = boards.find((b) => b.id === formState.selectedBoard);
    if (board) {
      setFormState((prev) => ({ ...prev, boardId: board.id }));
    }
  }, [formState.selectedBoard, boards]);

  const updateField = useCallback(
    <K extends keyof SessionFormState>(
      field: K,
      value: SessionFormState[K]
    ) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  /**
   * Resets the form to canonical defaults (NOT the prefilled values).
   * This ensures a clean slate regardless of how the form was initialized.
   */
  const resetForm = useCallback(() => {
    setStep(1);
    setFormState(getDefaultFormState(mode));
  }, [mode]);

  const refreshBoards = async () => {
    if (!user) return;

    try {
      const userBoardsResult = await getUserBoards(user.id);

      if (userBoardsResult.success && userBoardsResult.data) {
        setBoards(userBoardsResult.data);
      }
    } catch (error) {
      console.error("Error refreshing boards:", error);
      toast.error("Failed to refresh boards.");
    }
  };

  return {
    mode,
    setMode,
    step,
    setStep,
    nextStep,
    prevStep,
    loading,
    setLoading,
    boards,
    beaches,
    loadingData,
    formState,
    updateField,
    resetForm,
    refreshBoards,
  };
}
