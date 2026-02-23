"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ForecastFeedbackForm,
  type ForecastFeedback,
} from "@/components/forecast/forecast-feedback-form";

interface ForecastFeedbackFlowProps {
  open: boolean;
  session: any | null;
  forecast: any | null;
  submitting: boolean;
  onSubmit: (feedback: ForecastFeedback) => Promise<void>;
  onSkip: () => void;
}

export function ForecastFeedbackFlow({
  open,
  session,
  forecast,
  submitting,
  onSubmit,
  onSkip,
}: ForecastFeedbackFlowProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>How did the forecast compare?</DialogTitle>
        </DialogHeader>

        {session ? (
          <ForecastFeedbackForm
            session={session as any}
            forecast={forecast as any}
            onSubmit={onSubmit}
            onSkip={onSkip}
            loading={submitting}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            Preparing feedback…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
