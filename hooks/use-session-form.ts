"use client";

import { useState, useEffect } from "react";
import { getBeaches } from "@/actions/session-actions";
import { Board, Beach } from "@/types/database";
import { toast } from "sonner";

export type SessionFormState = {
  selectedBeach: string;
  selectedDate: string;
  selectedTime: string;
  selectedBoard: string;
  boardId?: string;
  duration: string;
  waveQuality: string;
  waterTemp: string;
  crowdLevel: string;
  parkingEase: string;
  notes: string;
  photos: string[];
};

export type SessionFormMode = "plan" | "log";

export function useSessionForm(initialMode: SessionFormMode = "plan") {
  const [mode, setMode] = useState<SessionFormMode>(initialMode);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [boards, setBoards] = useState<Board[]>([]);
  const [beaches, setBeaches] = useState<Beach[]>([]);

  const [formState, setFormState] = useState<SessionFormState>({
    selectedBeach: "",
    selectedDate: "",
    selectedTime: "",
    selectedBoard: "",
    boardId: undefined,
    duration: "",
    waveQuality: "",
    waterTemp: "",
    crowdLevel: "",
    parkingEase: "",
    notes: "",
    photos: [],
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        // Only fetch beaches, boards are fetched in EquipmentStep
        const beachList = await getBeaches();
        setBeaches(beachList);
      } catch (error) {
        console.error("Error loading beaches:", error);
        toast.error("Failed to load beaches. Some features may be limited.");
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  const updateField = <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const resetForm = () => {
    setStep(1);
    setFormState({
      selectedBeach: "",
      selectedDate: "",
      selectedTime: "",
      selectedBoard: "",
      boardId: undefined,
      duration: "",
      waveQuality: "",
      waterTemp: "",
      crowdLevel: "",
      parkingEase: "",
      notes: "",
      photos: [],
    });
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
    isPlanning: mode === "plan",
  };
}
