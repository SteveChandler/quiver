"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionWizard, SessionFormMode } from "@/hooks/useSessionWizard";
import { WIZARD_MOTION } from "@/lib/constants/animations";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Import wizard components
import { WizardStep } from "./WizardStep";
import { ProgressBar } from "./ProgressBar";
import { FieldFocus } from "./FieldFocus";
import { GuidanceHint } from "./GuidanceHint";
import { CompletionCelebration } from "./CompletionCelebration";

// Import form step components
import { LocationStep } from "@/components/session-forms/LocationStep";
import { DateTimeStep } from "@/components/session-forms/DateTimeStep";
import { EquipmentStep } from "@/components/session-forms/EquipmentStep";
import { ConditionsSection } from "@/components/session-forms/ConditionsSection";
import { GoalsSection } from "@/components/session-forms/GoalsSection";
import { NotesSection } from "@/components/session-forms/NotesSection";
import { PhotoSelectionSection } from "@/components/session-forms/PhotoSelectionSection";
import { OptimalTimesSection } from "@/components/session-forms/OptimalTimesSection";
import { GearSuggestionsSection } from "@/components/session-forms/GearSuggestionsSection";

interface SessionWizardProps {
  mode: SessionFormMode;
  onComplete?: (sessionData: any) => void;
  onCancel?: () => void;
  className?: string;
}

// Component map for dynamic step rendering
const STEP_COMPONENTS = {
  LocationStep,
  DateTimeStep,
  EquipmentStep,
  ConditionsStep: ConditionsSection,
  GoalsStep: GoalsSection, 
  NotesStep: NotesSection,
  PhotoSelectionStep: PhotoSelectionSection,
  OptimalTimesStep: OptimalTimesSection,
  GearSuggestionsStep: GearSuggestionsSection,
} as const;

export function SessionWizard({
  mode,
  onComplete,
  onCancel,
  className,
}: SessionWizardProps) {
  const wizard = useSessionWizard(mode, {
    enabled: true,
    debounceMs: 1500, // Slightly faster autosave for wizard
  });

  const {
    currentStep,
    totalSteps,
    currentWizardStep,
    canGoNext,
    canGoPrev,
    isFirstStep,
    isLastStep,
    progress,
    completedSteps,
    nextStep,
    prevStep,
    goToStep,
    isStepValid,
    isFormComplete,
    formState,
    updateField,
    boards,
    beaches,
    refreshBoards,
    loading,
    isAutosaving,
    autosaveStatus,
    lastSavedAt,
  } = wizard;

  // Handle step completion and form submission
  const handleStepComplete = async () => {
    if (isLastStep && isFormComplete) {
      // Handle final form submission
      if (onComplete) {
        onComplete(formState);
      }
    } else if (canGoNext) {
      nextStep();
    }
  };

  // Render the current step component
  const renderStepComponent = () => {
    const StepComponent = STEP_COMPONENTS[currentWizardStep.component as keyof typeof STEP_COMPONENTS];
    
    if (!StepComponent) {
      console.error(`Unknown step component: ${currentWizardStep.component}`);
      return (
        <div className="p-8 text-center text-gray-500">
          Step component not found: {currentWizardStep.component}
        </div>
      );
    }

    // Common props for all step components
    const commonProps = {
      formState,
      updateField,
      mode,
    };

    // Component-specific props
    const componentProps = {
      ...commonProps,
      ...(currentWizardStep.component === 'LocationStep' && { beaches }),
      ...(currentWizardStep.component === 'EquipmentStep' && { 
        boards, 
        onBoardsRefresh: refreshBoards 
      }),
      ...(currentWizardStep.component === 'PhotoSelectionStep' && {
        selectedFiles: [], // TODO: Handle photo state
        onFilesChange: () => {}, // TODO: Handle photo changes
        disabled: loading,
      }),
    };

    return <StepComponent {...componentProps} />;
  };

  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100/50", className)}>
      {/* Header with Progress */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200/80">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              )}
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === 'plan' ? 'Plan Session' : 'Log Session'}
                </h1>
                <p className="text-sm text-gray-500">
                  Step {currentStep + 1} of {totalSteps}
                </p>
              </div>
            </div>

            {/* Autosave Status */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <AnimatePresence mode="wait">
                {isAutosaving ? (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center space-x-2"
                  >
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </motion.div>
                ) : autosaveStatus === 'saved' && lastSavedAt ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center space-x-2"
                  >
                    <Save className="w-3 h-3" />
                    <span>
                      Saved {new Date(lastSavedAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Progress Bar */}
          <ProgressBar
            progress={progress}
            completedSteps={completedSteps}
            totalSteps={totalSteps}
            currentStep={currentStep}
            onStepClick={goToStep}
            isStepValid={isStepValid}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 py-6 h-full">
          <div className="max-w-2xl mx-auto h-full">
            
            {/* Step Header */}
            <motion.div
              key={`header-${currentStep}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mb-8"
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  isStepValid(currentStep) 
                    ? "bg-green-500 text-white" 
                    : "bg-blue-500 text-white"
                )}>
                  {isStepValid(currentStep) ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{currentStep + 1}</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentWizardStep.title}
                </h2>
              </div>
              <p className="text-gray-600 ml-11">
                {currentWizardStep.description}
              </p>
            </motion.div>

            {/* Step Content with Animation */}
            <AnimatePresence mode="wait">
              <WizardStep
                key={currentStep}
                stepId={currentWizardStep.id}
                isActive={true}
                motion={wizard.stepMotion}
              >
                <FieldFocus isValid={isStepValid(currentStep)}>
                  <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-6">
                      {renderStepComponent()}
                    </CardContent>
                  </Card>
                </FieldFocus>
              </WizardStep>
            </AnimatePresence>

            {/* Guidance Hints */}
            {currentWizardStep.hints && currentWizardStep.hints.length > 0 && (
              <div className="mt-6">
                <GuidanceHint
                  hints={currentWizardStep.hints}
                  isVisible={!isStepValid(currentStep)}
                />
              </div>
            )}

            {/* Completion Celebration */}
            {isLastStep && isFormComplete && (
              <div className="mt-8">
                <CompletionCelebration />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with Navigation */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/80 z-20">
        <div className="container mx-auto px-4 py-4 pb-6">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            
            {/* Previous Button */}
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={!canGoPrev || loading}
              className={cn(
                "flex items-center space-x-2 transition-opacity",
                !canGoPrev && "opacity-0 pointer-events-none"
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>

            {/* Step Counter */}
            <div className="text-sm text-gray-500 font-medium">
              {currentStep + 1} / {totalSteps}
            </div>

            {/* Next/Complete Button */}
            <Button
              onClick={handleStepComplete}
              disabled={(!isStepValid(currentStep) && currentWizardStep.isRequired) || loading}
              className={cn(
                "flex items-center space-x-2 transition-all",
                isLastStep && isFormComplete && "bg-green-600 hover:bg-green-700"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isLastStep ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{mode === 'plan' ? 'Plan Session' : 'Log Session'}</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}