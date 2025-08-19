"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserBoards } from "@/actions/board-actions";
import { getBeaches } from "@/actions/beach-actions";
import { Board, Beach } from "@/types/database";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

export type SessionFormState = {
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
  photos: string[];
  waveTypes: string[]; // Array of wave type IDs
  // New Session Planner Pro fields
  optimalTimes?: Array<{
    time: string;
    score: number;
    rating: "poor" | "fair" | "good" | "excellent";
    conditions: {
      waveHeight: number;
      waveQuality: string;
      windSpeed: number;
      windDirection: string;
      confidence: number;
    };
    reasons: string[];
  }>;
  selectedOptimalTime?: string;
  boardSuggestions?: Array<{
    boardId: string;
    score: number;
    confidence: number;
    reasons: string[];
  }>;
  invitees?: Array<{
    userId?: string;
    email?: string;
    name?: string;
  }>;
  invitationMessage?: string;
};

export type SessionFormMode = "plan" | "log";

export function useSessionForm(initialMode: SessionFormMode = "plan") {
  const { user } = useAuth();
  const [mode, setMode] = useState<SessionFormMode>(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [beaches, setBeaches] = useState<Beach[]>([]);

  const [formState, setFormState] = useState<SessionFormState>({
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
    waveTypes: [],
    // Initialize new Session Planner Pro fields
    optimalTimes: undefined,
    selectedOptimalTime: undefined,
    boardSuggestions: undefined,
    invitees: [],
    invitationMessage: "",
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

  const resetForm = () => {
    setStep(1);
    setFormState({
      selectedBeach: "",
      selectedBeachId: "",
      selectedDate: "",
      selectedTime: "",
      selectedBoard: "",
      boardId: undefined,
      duration: "",
      waveQuality: "",
      waterTemp: "",
      crowdLevel: "",
      parkingEase: "",
      overallRating: "",
      notes: "",
      photos: [],
      waveTypes: [],
      // Reset new Session Planner Pro fields
      optimalTimes: undefined,
      selectedOptimalTime: undefined,
      boardSuggestions: undefined,
      invitees: [],
      invitationMessage: "",
    });
  };

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
    isPlanning: mode === "plan",
  };
}
