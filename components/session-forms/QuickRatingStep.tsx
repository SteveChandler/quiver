"use client";

import { useCallback } from "react";
import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SessionFormState } from "@/hooks/use-session-form";
import { cn } from "@/lib/utils";

interface QuickRatingStepProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

/**
 * Quick log mode Step 2: Simplified rating.
 * Only collects overall rating (1-5 stars) and an optional note.
 * Skips wave quality, crowd, parking, equipment, forecast accuracy.
 */
export function QuickRatingStep({
  formState,
  updateField,
}: QuickRatingStepProps) {
  const currentRating = formState.overallRating
    ? parseInt(formState.overallRating)
    : 0;

  const handleRatingClick = useCallback(
    (rating: number) => {
      updateField("overallRating", rating.toString());
    },
    [updateField]
  );

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateField("notes", e.target.value);
    },
    [updateField]
  );

  const ratingLabels = ["", "Rough", "Meh", "Decent", "Good", "Epic"];

  return (
    <div className="space-y-8">
      {/* Overall Rating */}
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-1">How was your session?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Tap a star to rate your overall experience
        </p>

        <div className="flex items-center justify-center gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingClick(star)}
              className={cn(
                "transition-all duration-150 p-1 rounded-full",
                "hover:scale-110 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              )}
              aria-label={`Rate ${star} out of 5 stars`}
              data-testid={`quick-rating-star-${star}`}
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-colors",
                  star <= currentRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-none text-gray-300"
                )}
              />
            </button>
          ))}
        </div>

        {currentRating > 0 && (
          <p className="text-sm font-medium text-primary animate-in fade-in duration-200">
            {ratingLabels[currentRating]}
          </p>
        )}
      </div>

      {/* Optional Notes */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Anything to note? <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          type="text"
          placeholder="Quick thought about your session..."
          value={formState.notes || ""}
          onChange={handleNotesChange}
          className="h-12"
          maxLength={500}
          data-testid="quick-session-notes-input"
        />
      </div>
    </div>
  );
}
