"use client";

import { Target, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import {
  SKILL_GOALS,
  getFormText,
  getRatingDescription,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";

interface GoalsSectionProps {
  mode?: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function GoalsSection({
  mode,
  formState,
  updateField,
}: GoalsSectionProps) {
  // Add fallback handling with proper defaults
  const safeMode: SessionFormMode = mode || "plan";
  const text = getFormText(safeMode);
  
  // Provide comprehensive fallback object with proper null safety
  const defaultText = {
    goals: "Session Goals",
    notesPlaceholder: "Session notes...",
    showPerformanceRating: false,
    pageTitle: "Session",
    pageDescription: "Session details",
    location: "Location",
    dateTime: "Date & Time", 
    equipment: "Equipment",
    notes: "Notes",
    submitButton: "Submit",
    successMessage: "Success!",
    showInviteFriends: false,
    showConditions: false,
    showPhotos: false
  };
  
  const safeText = text && typeof text === 'object' ? text : defaultText;
  const isPlanning = safeMode === "plan";
  
  // Additional safety check - this should never happen with proper fallbacks
  if (!safeText?.goals) {
    console.warn('GoalsSection: safeText.goals is undefined, falling back to default');
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex items-center">
          <Target className="w-5 h-5 mr-2 text-primary" />
          Session Goals
        </div>
        <p className="text-muted-foreground mt-2">Loading goals section...</p>
      </div>
    );
  }

  const handleGoalToggle = (goal: string) => {
    const currentNotes = formState.notes || "";
    if (currentNotes.includes(goal)) {
      updateField(
        "notes",
        currentNotes
          .replace(goal, "")
          .replace(/,\s*,/g, ",")
          .replace(/^,\s*|,\s*$/g, "")
          .trim()
      );
    } else {
      updateField("notes", currentNotes ? `${currentNotes}, ${goal}` : goal);
    }
  };

  const handleRatingChange = (rating: number) => {
    updateField("overallRating", rating.toString());
  };

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <Target className="w-5 h-5 mr-2 text-primary" />
          {safeText?.goals || "Session Goals"}
        </div>
      }
    >
      {/* Goals/Skills Selection */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-3">
            {isPlanning ? "Focus Areas" : "Skills Practiced"}
          </label>
          <div className="flex flex-wrap gap-2">
            {SKILL_GOALS.map((goal) => (
              <Button
                key={goal}
                type="button"
                variant={
                  formState.notes?.includes(goal) ? "default" : "outline"
                }
                size="sm"
                onClick={() => handleGoalToggle(goal)}
                className="transition-all duration-200"
              >
                {goal}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isPlanning
              ? "Select skills you want to focus on during this session"
              : "Select skills you practiced or improved during this session"}
          </p>
        </div>

        {/* Overall Performance Rating - Only show for logged sessions */}
        {!isPlanning && (
          <div className="pt-4 border-t">
            <label className="block text-sm font-medium mb-3">
              Overall Goal Performance
            </label>
            <div className="text-center">
              <div className="flex justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleRatingChange(rating)}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      parseInt(formState.overallRating) >= rating
                        ? "text-blue-500 bg-blue-50"
                        : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"
                    }`}
                    title={getRatingDescription("overallRating", rating)}
                  >
                    <Star
                      className="w-6 h-6"
                      fill={
                        parseInt(formState.overallRating) >= rating
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">
                  {formState.overallRating
                    ? `${formState.overallRating}/5 - ${getRatingDescription(
                        "overallRating",
                        parseInt(formState.overallRating)
                      )}`
                    : "Rate your performance"}
                </span>
                <p className="text-xs text-muted-foreground">
                  How well did you achieve your session goals?
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SimpleCardLayout>
  );
}
