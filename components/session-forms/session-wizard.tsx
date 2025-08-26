"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  CheckCircle2,
  Calendar,
  MapPin,
  Waves,
  Target,
  Camera,
  Sparkles
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useSessionForm, SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

// Import existing step components
import { DateTimeStep } from "./DateTimeStep";
import { LocationStep } from "./LocationStep";
import { EquipmentStep } from "./EquipmentStep";
import { GoalsSection } from "./GoalsSection";
import { ConditionsSection } from "./ConditionsSection";
import { PhotoSelectionSection } from "./PhotoSelectionSection";

// Import Phase 2 animations
import { PHASE2_ANIMATIONS, PHASE2_EASING } from "@/lib/constants/animations";

// Import session actions
import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";

// Wizard step configuration
interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ComponentType<WizardStepProps>;
  validateStep?: (formState: SessionFormState) => string | null;
}

interface WizardStepProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  boards: any[];
  beaches: any[];
  mode: SessionFormMode;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

// Auto-save hook with animation feedback
function useAutoSave(formState: SessionFormState, delay: number = 2000) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const saveCallback = useCallback(async () => {
    // Simulate auto-save with localStorage for draft
    localStorage.setItem("sessionWizardDraft", JSON.stringify(formState));
    return { success: true };
  }, [formState]);

  const { data, loading } = useDataFetcher(saveCallback);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Object.values(formState).some(v => v !== "" && v !== undefined)) {
        setIsSaving(true);
        // Simulate save delay
        setTimeout(() => {
          setIsSaving(false);
          setLastSaved(new Date());
        }, 500);
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [formState, delay]);

  return { isSaving, lastSaved };
}

// Validation functions
const validateDateTimeStep = (formState: SessionFormState): string | null => {
  if (!formState.selectedDate) return "Please select a date";
  if (!formState.selectedTime) return "Please select a time";
  return null;
};

const validateLocationStep = (formState: SessionFormState): string | null => {
  if (!formState.selectedBeachId) return "Please select a beach location";
  return null;
};

const validateEquipmentStep = (formState: SessionFormState): string | null => {
  if (!formState.boardId) return "Please select a board";
  return null;
};

// Step wrapper components that integrate with existing components
const DateTimeStepWrapper: React.FC<WizardStepProps> = ({ formState, updateField, onNext, mode }) => (
  <motion.div
    className="space-y-6"
    variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-foreground">When do you want to surf?</h3>
      <p className="text-muted-foreground">Choose your perfect surf session timing</p>
    </div>
    <DateTimeStep 
      formState={formState}
      updateField={updateField}
      onNext={onNext}
    />
  </motion.div>
);

const LocationStepWrapper: React.FC<WizardStepProps> = ({ formState, updateField, beaches, onNext, mode }) => (
  <motion.div
    className="space-y-6"
    variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-foreground">Where will you surf?</h3>
      <p className="text-muted-foreground">Select your surf spot for the session</p>
    </div>
    <LocationStep 
      formState={formState}
      updateField={updateField}
      beaches={beaches}
      onNext={onNext}
    />
  </motion.div>
);

const EquipmentStepWrapper: React.FC<WizardStepProps> = ({ formState, updateField, boards, onNext, mode }) => (
  <motion.div
    className="space-y-6"
    variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-foreground">Choose your gear</h3>
      <p className="text-muted-foreground">Select the perfect board for your session</p>
    </div>
    <EquipmentStep 
      formState={formState}
      updateField={updateField}
      boards={boards}
      onNext={onNext}
    />
  </motion.div>
);

const GoalsStepWrapper: React.FC<WizardStepProps> = ({ formState, updateField, mode }) => (
  <motion.div
    className="space-y-6"
    variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-foreground">Set your goals</h3>
      <p className="text-muted-foreground">What do you want to achieve in this session?</p>
    </div>
    <GoalsSection formState={formState} updateField={updateField} mode={mode} />
  </motion.div>
);

const ConditionsStepWrapper: React.FC<WizardStepProps> = ({ formState, updateField, mode }) => (
  <motion.div
    className="space-y-6"
    variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <div className="space-y-4">
      <h3 className="text-xl font-semibold text-foreground">How was the session?</h3>
      <p className="text-muted-foreground">Rate the conditions and your experience</p>
    </div>
    <ConditionsSection formState={formState} updateField={updateField} />
  </motion.div>
);

const PhotoStepWrapper: React.FC<WizardStepProps> = ({ formState, updateField, mode }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  return (
    <motion.div
      className="space-y-6"
      variants={PHASE2_ANIMATIONS.sessionWizard.stepTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground">Share your session</h3>
        <p className="text-muted-foreground">Add photos to capture the memories</p>
      </div>
      <PhotoSelectionSection 
        formState={formState} 
        updateField={updateField}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
      />
    </motion.div>
  );
};

// Main SessionWizard component
interface SessionWizardProps {
  initialMode?: SessionFormMode;
  onComplete?: (sessionId: string) => void;
}

export function SessionWizard({ 
  initialMode = "plan", 
  onComplete 
}: SessionWizardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get mode from URL params or use initial
  const paramMode = (searchParams.get("mode") as SessionFormMode) || initialMode;
  
  const {
    mode,
    setMode,
    loading,
    setLoading,
    boards,
    beaches,
    formState,
    updateField,
    resetForm,
  } = useSessionForm(paramMode);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [validationErrors, setValidationErrors] = useState<string>("");
  const [showCelebration, setShowCelebration] = useState(false);

  // Auto-save functionality
  const { isSaving, lastSaved } = useAutoSave(formState);

  // Define wizard steps based on mode
  const getWizardSteps = useCallback((mode: SessionFormMode): WizardStep[] => {
    const baseSteps = [
      {
        id: "datetime",
        title: "When",
        description: "Set date & time",
        icon: <Calendar className="w-5 h-5" />,
        component: DateTimeStepWrapper,
        validateStep: validateDateTimeStep,
      },
      {
        id: "location",
        title: "Where",
        description: "Choose location",
        icon: <MapPin className="w-5 h-5" />,
        component: LocationStepWrapper,
        validateStep: validateLocationStep,
      },
      {
        id: "equipment",
        title: "Gear",
        description: "Select board",
        icon: <Waves className="w-5 h-5" />,
        component: EquipmentStepWrapper,
        validateStep: validateEquipmentStep,
      },
    ];

    if (mode === "plan") {
      return [
        ...baseSteps,
        {
          id: "goals",
          title: "Goals",
          description: "Set objectives",
          icon: <Target className="w-5 h-5" />,
          component: GoalsStepWrapper,
        },
      ];
    } else {
      return [
        ...baseSteps,
        {
          id: "conditions",
          title: "Conditions",
          description: "Rate session",
          icon: <Sparkles className="w-5 h-5" />,
          component: ConditionsStepWrapper,
        },
        {
          id: "photos",
          title: "Photos",
          description: "Add memories",
          icon: <Camera className="w-5 h-5" />,
          component: PhotoStepWrapper,
        },
      ];
    }
  }, []);

  const steps = getWizardSteps(mode);
  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Navigation handlers
  const handleNext = useCallback(() => {
    // Validate current step
    if (currentStep.validateStep) {
      const error = currentStep.validateStep(formState);
      if (error) {
        setValidationErrors(error);
        return;
      }
    }

    setValidationErrors("");
    setCompletedSteps(prev => new Set([...prev, currentStepIndex]));

    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }, [currentStep, formState, currentStepIndex, isLastStep]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
      setValidationErrors("");
    }
  }, [isFirstStep, currentStepIndex]);

  const handleStepClick = useCallback((stepIndex: number) => {
    // Allow navigation to completed steps or the next step
    if (completedSteps.has(stepIndex) || stepIndex <= currentStepIndex + 1) {
      setCurrentStepIndex(stepIndex);
      setValidationErrors("");
    }
  }, [completedSteps, currentStepIndex]);

  // Form submission
  const handleComplete = useCallback(async () => {
    setLoading(true);
    try {
      let result;
      
      if (mode === "plan") {
        result = await createPlannedSession(formState);
      } else {
        result = await createLoggedSession(formState);
      }

      if (result.success && result.data) {
        // Show celebration animation
        setShowCelebration(true);
        
        // Clear draft
        localStorage.removeItem("sessionWizardDraft");
        
        // Call completion handler or navigate
        setTimeout(() => {
          if (onComplete) {
            onComplete(result.data.id);
          } else {
            router.push(`/sessions/${result.data.id}`);
          }
        }, 2000);

        toast.success(
          mode === "plan" 
            ? "Session planned successfully!" 
            : "Session logged successfully!"
        );
      } else {
        toast.error("Failed to save session. Please try again.");
      }
    } catch (error) {
      console.error("Error saving session:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [mode, formState, onComplete, router, setLoading]);

  // Load saved draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("sessionWizardDraft");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        Object.keys(draft).forEach(key => {
          if (key in formState) {
            updateField(key as keyof SessionFormState, draft[key]);
          }
        });
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    }
  }, []);

  // Update mode when URL changes
  useEffect(() => {
    setMode(paramMode);
  }, [paramMode, setMode]);

  if (!user) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please log in to use the session wizard.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center space-y-4"
              variants={PHASE2_ANIMATIONS.formValidation.completion}
              initial="initial"
              animate="animate"
            >
              <motion.div
                className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 360, 0],
                }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground">
                {mode === "plan" ? "Session Planned!" : "Session Logged!"}
              </h2>
              <p className="text-muted-foreground">
                {mode === "plan" 
                  ? "Your surf session has been scheduled."
                  : "Your surf session has been recorded."
                }
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            {mode === "plan" ? "Plan Your Session" : "Log Your Session"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "plan" 
              ? "Set up your perfect surf session in just a few steps"
              : "Record your surf session experience"
            }
          </p>
        </div>

        {/* Progress indicator */}
        <div className="relative">
          <motion.div
            className="absolute top-4 left-0 h-1 bg-primary rounded-full"
            variants={PHASE2_ANIMATIONS.sessionWizard.progressBar}
            initial="initial"
            animate="animate"
            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
          />
          <div className="flex items-center justify-between relative z-10">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.has(index);
              const isCurrent = index === currentStepIndex;
              const isClickable = isCompleted || index <= currentStepIndex + 1;

              return (
                <motion.button
                  key={step.id}
                  className={`flex flex-col items-center space-y-2 p-3 rounded-lg transition-colors ${
                    isClickable ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
                  }`}
                  onClick={() => isClickable && handleStepClick(index)}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                >
                  <motion.div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                    variants={PHASE2_ANIMATIONS.sessionWizard.fieldFocus}
                    animate={isCurrent ? "focus" : "initial"}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      step.icon
                    )}
                  </motion.div>
                  <div className="text-center">
                    <div className={`text-sm font-medium ${
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {step.description}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Auto-save indicator */}
        <AnimatePresence>
          {(isSaving || lastSaved) && (
            <motion.div
              className="flex items-center justify-center space-x-2 text-sm text-muted-foreground"
              variants={PHASE2_ANIMATIONS.sessionWizard.autoSave}
              initial="initial"
              animate={isSaving ? "saving" : "saved"}
              exit="initial"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving 
                  ? "Saving draft..." 
                  : `Draft saved ${lastSaved?.toLocaleTimeString()}`
                }
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <Card className="min-h-[500px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  {currentStep.icon}
                  <span>{currentStep.title}</span>
                </CardTitle>
                <Badge variant="outline" className="mt-2">
                  Step {currentStepIndex + 1} of {steps.length}
                </Badge>
              </div>
              <Badge variant={mode === "plan" ? "default" : "secondary"}>
                {mode === "plan" ? "Planning" : "Logging"}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Validation errors */}
            <AnimatePresence>
              {validationErrors && (
                <motion.div
                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800"
                  variants={PHASE2_ANIMATIONS.formValidation.error}
                  initial="initial"
                  animate="error"
                  exit="initial"
                >
                  {validationErrors}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step content */}
            <AnimatePresence mode="wait" key={currentStepIndex}>
              <currentStep.component
                formState={formState}
                updateField={updateField}
                boards={boards}
                mode={mode}
                beaches={beaches}
                onNext={handleNext}
                onPrev={handlePrev}
                isFirst={isFirstStep}
                isLast={isLastStep}
              />
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirstStep}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={resetForm}
              disabled={loading}
            >
              Reset
            </Button>
            
            <Button
              onClick={handleNext}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <span>
                {isLastStep 
                  ? (mode === "plan" ? "Plan Session" : "Log Session")
                  : "Next"
                }
              </span>
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}