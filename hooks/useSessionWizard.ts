"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSessionForm, SessionFormState, SessionFormMode } from "./use-session-form";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";
import { WIZARD_MOTION } from "@/lib/constants/animations";

// Define wizard steps with validation and components
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: string;
  isRequired: boolean;
  validation: (formState: SessionFormState, mode: SessionFormMode) => boolean;
  hints?: string[];
}

// Define the step configuration for both planning and logging modes
export const WIZARD_STEPS: Record<SessionFormMode, WizardStep[]> = {
  plan: [
    {
      id: "location",
      title: "Location",
      description: "Choose where you'll be surfing",
      component: "LocationStep",
      isRequired: true,
      validation: (state) => Boolean(state.selectedBeach),
      hints: ["Select a beach from the dropdown", "Or enter a custom location name"]
    },
    {
      id: "datetime", 
      title: "When",
      description: "Set your session date and time",
      component: "DateTimeStep",
      isRequired: true,
      validation: (state) => Boolean(state.selectedDate && state.selectedTime),
      hints: ["Pick your preferred date", "Choose your arrival time"]
    },
    {
      id: "optimal-times",
      title: "Best Times",
      description: "See optimal conditions for your session",
      component: "OptimalTimesStep",
      isRequired: false,
      validation: () => true,
      hints: ["Review forecast-based recommendations", "Compare different time slots"]
    },
    {
      id: "gear",
      title: "Gear",
      description: "Get smart recommendations for your session",
      component: "GearSuggestionsStep", 
      isRequired: false,
      validation: () => true,
      hints: ["See board recommendations", "Review gear suggestions"]
    },
    {
      id: "goals",
      title: "Goals",
      description: "What do you want to focus on?",
      component: "GoalsStep",
      isRequired: false,
      validation: () => true,
      hints: ["Set your session objectives", "Track your progress"]
    },
    {
      id: "notes",
      title: "Notes & Invites",
      description: "Add notes and invite friends",
      component: "NotesStep",
      isRequired: false,
      validation: () => true,
      hints: ["Add personal notes", "Invite friends to join"]
    }
  ],
  log: [
    {
      id: "location",
      title: "Location", 
      description: "Where did your session take place?",
      component: "LocationStep",
      isRequired: true,
      validation: (state) => Boolean(state.selectedBeach),
      hints: ["Select the beach you surfed", "Or enter the location name"]
    },
    {
      id: "datetime",
      title: "When",
      description: "When did you surf?", 
      component: "DateTimeStep",
      isRequired: true,
      validation: (state) => Boolean(state.selectedDate),
      hints: ["Select the date of your session", "Time is optional for logging"]
    },
    {
      id: "equipment",
      title: "Equipment",
      description: "Which board did you ride?",
      component: "EquipmentStep",
      isRequired: false,
      validation: () => true,
      hints: ["Select your board", "Or add a new board to your quiver"]
    },
    {
      id: "conditions",
      title: "Conditions",
      description: "How were the waves and conditions?",
      component: "ConditionsStep",
      isRequired: false,
      validation: () => true,
      hints: ["Rate the wave quality", "Record water temperature", "Note crowd levels"]
    },
    {
      id: "photos",
      title: "Photos",
      description: "Add photos from your session",
      component: "PhotoSelectionStep",
      isRequired: false,
      validation: () => true,
      hints: ["Upload session photos", "Capture the memories"]
    },
    {
      id: "notes",
      title: "Notes",
      description: "Reflect on your session",
      component: "NotesStep", 
      isRequired: false,
      validation: () => true,
      hints: ["Add session notes", "Record what you learned"]
    }
  ]
};

// Autosave configuration
export interface AutosaveConfig {
  enabled: boolean;
  debounceMs: number;
  storageKey: string;
}

// Wizard state and controls
export interface UseSessionWizardReturn {
  // Step management
  currentStep: number;
  totalSteps: number;
  currentWizardStep: WizardStep;
  canGoNext: boolean;
  canGoPrev: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  
  // Navigation
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  // Progress
  progress: number;
  completedSteps: number;
  
  // Validation
  isStepValid: (step: number) => boolean;
  isFormComplete: boolean;
  
  // Motion & Animation
  stepMotion: typeof WIZARD_MOTION.step;
  progressMotion: typeof WIZARD_MOTION.progress;
  
  // Autosave
  isAutosaving: boolean;
  lastSavedAt: Date | null;
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  
  // Form state (from useSessionForm)
  mode: SessionFormMode;
  setMode: (mode: SessionFormMode) => void;
  loading: boolean;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(field: K, value: SessionFormState[K]) => void;
  errors: any;
  reset: () => void;
  boards: any[];
  beaches: any[];
  refreshBoards: () => Promise<void>;
  isPlanning: boolean;
  
  // Analytics
  trackStepView: (stepId: string) => void;
  trackStepComplete: (stepId: string) => void;
}

export function useSessionWizard(
  initialMode: SessionFormMode = "plan",
  autosaveConfig: Partial<AutosaveConfig> = {}
): UseSessionWizardReturn {
  const { user } = useAuth();
  
  // Configure autosave
  const config: AutosaveConfig = {
    enabled: true,
    debounceMs: 2000,
    storageKey: `quiver-session-wizard-${initialMode}`,
    ...autosaveConfig
  };
  
  // Base session form functionality
  const sessionForm = useSessionForm(initialMode);
  const { mode, formState, updateField } = sessionForm;
  
  // Wizard-specific state
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  // Refs for autosave debouncing
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFormStateRef = useRef<SessionFormState>(formState);
  
  // Get current wizard configuration
  const wizardSteps = WIZARD_STEPS[mode];
  const totalSteps = wizardSteps.length;
  const currentWizardStep = wizardSteps[currentStep];
  
  // Step validation
  const isStepValid = useCallback((step: number): boolean => {
    const wizardStep = wizardSteps[step];
    if (!wizardStep) return false;
    return wizardStep.validation(formState, mode);
  }, [wizardSteps, formState, mode]);
  
  // Navigation logic
  const canGoPrev = currentStep > 0;
  const canGoNext = currentStep < totalSteps - 1 && isStepValid(currentStep);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  
  // Progress calculation
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const completedSteps = Array.from(visitedSteps).filter(step => isStepValid(step)).length;
  
  // Form completion check
  const isFormComplete = wizardSteps
    .filter(step => step.isRequired)
    .every((_, index) => isStepValid(index));
  
  // Navigation functions
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      setVisitedSteps(prev => new Set([...prev, step]));
      
      // Track step view for analytics
      trackStepView(wizardSteps[step].id);
    }
  }, [totalSteps, wizardSteps]);
  
  const nextStep = useCallback(() => {
    if (canGoNext) {
      trackStepComplete(currentWizardStep.id);
      goToStep(currentStep + 1);
    }
  }, [canGoNext, currentStep, currentWizardStep.id, goToStep]);
  
  const prevStep = useCallback(() => {
    if (canGoPrev) {
      goToStep(currentStep - 1);
    }
  }, [canGoPrev, currentStep, goToStep]);
  
  // Analytics tracking
  const trackStepView = useCallback((stepId: string) => {
    // TODO: Implement analytics tracking
    console.log(`Step viewed: ${stepId}`);
  }, []);
  
  const trackStepComplete = useCallback((stepId: string) => {
    // TODO: Implement analytics tracking  
    console.log(`Step completed: ${stepId}`);
  }, []);
  
  // Autosave functionality
  const performAutosave = useCallback(async (data: SessionFormState) => {
    if (!config.enabled || !user) return;
    
    setAutosaveStatus('saving');
    
    try {
      // Save to localStorage for persistence
      localStorage.setItem(config.storageKey, JSON.stringify({
        formState: data,
        currentStep,
        timestamp: Date.now()
      }));
      
      // TODO: Implement server-side draft saving
      // await saveDraftSession(data);
      
      setAutosaveStatus('saved');
      setLastSavedAt(new Date());
      
      // Reset to idle after a brief delay
      setTimeout(() => setAutosaveStatus('idle'), 2000);
      
    } catch (error) {
      console.error('Autosave failed:', error);
      setAutosaveStatus('error');
      setTimeout(() => setAutosaveStatus('idle'), 3000);
    }
  }, [config.enabled, config.storageKey, currentStep, user]);
  
  // Debounced autosave effect
  useEffect(() => {
    if (!config.enabled) return;
    
    // Check if form state has actually changed
    const formStateChanged = JSON.stringify(formState) !== JSON.stringify(lastFormStateRef.current);
    if (!formStateChanged) return;
    
    lastFormStateRef.current = formState;
    
    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }
    
    // Set new timeout for debounced save
    autosaveTimeoutRef.current = setTimeout(() => {
      performAutosave(formState);
    }, config.debounceMs);
    
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formState, config.enabled, config.debounceMs, performAutosave]);
  
  // Load saved draft on mount
  useEffect(() => {
    if (!config.enabled || !user) return;
    
    try {
      const saved = localStorage.getItem(config.storageKey);
      if (saved) {
        const { formState: savedFormState, currentStep: savedStep, timestamp } = JSON.parse(saved);
        
        // Only restore if saved within last 24 hours
        const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
        if (timestamp > dayAgo) {
          // Restore form state
          Object.entries(savedFormState).forEach(([key, value]) => {
            updateField(key as keyof SessionFormState, value as any);
          });
          
          // Restore step if valid
          if (savedStep >= 0 && savedStep < totalSteps) {
            setCurrentStep(savedStep);
            setVisitedSteps(new Set(Array.from({ length: savedStep + 1 }, (_, i) => i)));
          }
          
          toast.success("Draft restored from previous session");
        }
      }
    } catch (error) {
      console.error('Failed to restore draft:', error);
    }
  }, [config.enabled, config.storageKey, user, updateField, totalSteps]);
  
  // Enhanced updateField with autosave trigger
  const enhancedUpdateField = useCallback(<K extends keyof SessionFormState>(
    field: K, 
    value: SessionFormState[K]
  ) => {
    updateField(field, value);
    // Autosave will be triggered by the useEffect above
  }, [updateField]);
  
  return {
    // Step management
    currentStep,
    totalSteps,
    currentWizardStep,
    canGoNext,
    canGoPrev,
    isFirstStep,
    isLastStep,
    
    // Navigation
    goToStep,
    nextStep,
    prevStep,
    
    // Progress
    progress,
    completedSteps,
    
    // Validation
    isStepValid,
    isFormComplete,
    
    // Motion & Animation
    stepMotion: WIZARD_MOTION.step,
    progressMotion: WIZARD_MOTION.progress,
    
    // Autosave
    isAutosaving: autosaveStatus === 'saving',
    lastSavedAt,
    autosaveStatus,
    
    // Form state (from useSessionForm) - destructure to avoid conflicts
    mode: sessionForm.mode,
    setMode: sessionForm.setMode,
    loading: sessionForm.loading,
    formState: sessionForm.formState,
    updateField: enhancedUpdateField,
    errors: sessionForm.errors,
    reset: sessionForm.reset,
    boards: sessionForm.boards,
    beaches: sessionForm.beaches,
    refreshBoards: sessionForm.refreshBoards,
    isPlanning: sessionForm.isPlanning,
    
    // Analytics
    trackStepView,
    trackStepComplete,
  };
}