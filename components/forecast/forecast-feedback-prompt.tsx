"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Waves,
  Star,
  Users,
  TrendingUp,
  MessageSquare,
  X,
  CheckCircle,
  Clock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ForecastFeedbackForm,
  type ForecastFeedback,
} from "./forecast-feedback-form";
import type { Session, Forecast } from "@/types/database";

interface ForecastFeedbackPromptProps {
  session: Session;
  forecast?: Forecast | null;
  onSubmitFeedback: (feedback: ForecastFeedback) => Promise<void>;
  onDismiss?: () => void;
  className?: string;
  autoShow?: boolean;
}

export function ForecastFeedbackPrompt({
  session,
  forecast,
  onSubmitFeedback,
  onDismiss,
  className,
  autoShow = false,
}: ForecastFeedbackPromptProps) {
  const [isOpen, setIsOpen] = useState(autoShow);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = async (feedback: ForecastFeedback) => {
    setIsSubmitting(true);
    try {
      await onSubmitFeedback(feedback);
      setHasSubmitted(true);
      setIsOpen(false);
    } catch (error) {
      // Error handled in the feedback form and hook
      console.error("Feedback submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  const handleDismiss = () => {
    setIsOpen(false);
    onDismiss?.();
  };

  // Format session date
  const sessionDate = new Date(
    session.arrival_time || session.created_at
  ).toLocaleDateString();
  const timeSinceSession = Math.floor(
    (Date.now() -
      new Date(session.arrival_time || session.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (hasSubmitted) {
    return (
      <Card className={cn("border-green-200 bg-green-50", className)}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Thank you for your feedback!
              </p>
              <p className="text-xs text-green-600">
                Your input helps improve forecasts for the entire community.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Prompt Card */}
      <Card
        className={cn(
          "border-blue-200 bg-gradient-to-r from-blue-50 to-ocean-blue/10",
          className
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center space-x-2">
              <Waves className="h-5 w-5 text-blue-500" />
              <span>Help Improve Forecasts</span>
              <Badge variant="secondary" className="text-xs">
                Optional
              </Badge>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              How did the forecast compare to actual conditions during your
              session on {sessionDate}?
            </p>

            {timeSinceSession <= 3 && (
              <div className="flex items-center space-x-1 text-xs text-blue-600">
                <Clock className="h-3 w-3" />
                <span>
                  Perfect timing! Recent sessions provide the best feedback.
                </span>
              </div>
            )}
          </div>

          {/* Quick stats to encourage participation */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-white rounded-lg border">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-xs font-medium">Accuracy</span>
              </div>
              <p className="text-xs text-muted-foreground">Help improve</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Users className="h-3 w-3 text-blue-500" />
                <span className="text-xs font-medium">Community</span>
              </div>
              <p className="text-xs text-muted-foreground">Join effort</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span className="text-xs font-medium">Quality</span>
              </div>
              <p className="text-xs text-muted-foreground">Better forecasts</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1" variant="default">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Share Feedback
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Forecast Feedback for {sessionDate}</DialogTitle>
                  <DialogDescription>
                    Compare how the forecast matched your actual experience.
                    Your feedback helps improve future forecasts for everyone.
                  </DialogDescription>
                </DialogHeader>

                <ForecastFeedbackForm
                  session={session}
                  forecast={forecast}
                  onSubmit={handleSubmit}
                  onSkip={handleSkip}
                  loading={isSubmitting}
                />
              </DialogContent>
            </Dialog>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="px-4"
                  >
                    Skip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">
                    You can always provide feedback later
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Educational note */}
          <div className="flex items-start space-x-2 p-2 bg-blue-50 rounded border-l-2 border-blue-200">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p className="font-medium">Why feedback matters:</p>
              <p>
                Your input creates a community-driven forecast that gets more
                accurate over time. Even a 2-minute submission helps everyone!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
