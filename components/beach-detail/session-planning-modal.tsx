"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Clock, Wind, Waves, TrendingUp, Check } from "lucide-react";
import dynamic from "next/dynamic";
import type { Beach } from "@/types/database";
import { useMagicHour } from "@/hooks/use-magic-hour";
import { cn } from "@/lib/utils";
import { decimalToConfidence } from "@/lib/services/forecast/confidence-scorer";

// Dynamically import session form components
const SessionForm = dynamic(
  () =>
    import("@/components/session-forms/SessionForm").then((m) => ({
      default: m.SessionForm,
    })),
  { ssr: false }
);

interface SessionPlanningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beach: Beach;
  initialMode?: "log" | "plan";
}

/**
 * Magic Hour suggestion component that displays the optimal surf window
 * and allows users to apply it to their session planning.
 */
function MagicHourSuggestion({
  beachId,
  selectedDate,
  onApply,
  appliedTime,
}: {
  beachId: string;
  selectedDate?: Date;
  onApply: (time: string) => void;
  appliedTime: string | null;
}) {
  const { magicHour, isLoading } = useMagicHour(beachId, {
    targetDate: selectedDate,
    enabled: true,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-sm font-medium">Finding optimal surf window...</span>
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // No magic hour found
  if (!magicHour?.found || !magicHour.windowStart || !magicHour.windowEnd) {
    return null;
  }

  // Extract time from window for the form (use start time)
  const extractTimeFromWindow = (windowStart: string): string => {
    // windowStart is in format "8:30 AM" - convert to "08:30"
    const match = windowStart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return "";

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toUpperCase();

    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  };

  const suggestedTime = extractTimeFromWindow(magicHour.windowStart);
  const isApplied = appliedTime === suggestedTime;

  // Get wind quality display
  const getWindQualityDisplay = (quality: string | null) => {
    switch (quality) {
      case "perfect":
        return { label: "Offshore", className: "bg-green-500 text-white" };
      case "acceptable":
        return { label: "Light", className: "bg-blue-500 text-white" };
      case "cross":
        return { label: "Cross", className: "bg-yellow-500 text-white" };
      case "onshore":
        return { label: "Onshore", className: "bg-orange-500 text-white" };
      default:
        return { label: "Variable", className: "bg-gray-500 text-white" };
    }
  };

  const windDisplay = getWindQualityDisplay(magicHour.windQuality);
  const confidencePercent = decimalToConfidence(magicHour.confidence);

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        isApplied
          ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
          : "border-primary/20 bg-primary/5 hover:border-primary/40"
      )}
      data-testid="magic-hour-suggestion"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Suggested Optimal Time</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {confidencePercent}% confidence
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          {/* Time window display */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-lg font-semibold">
              {magicHour.windowStart} - {magicHour.windowEnd}
            </span>
          </div>

          {/* Condition badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("text-xs", windDisplay.className)}>
              <Wind className="w-3 h-3 mr-1" />
              {windDisplay.label}
            </Badge>
            {magicHour.swellMatch && (
              <Badge className="text-xs bg-blue-500 text-white">
                <Waves className="w-3 h-3 mr-1" />
                Good Swell
              </Badge>
            )}
            {magicHour.tideInRange && (
              <Badge className="text-xs bg-cyan-500 text-white">
                <TrendingUp className="w-3 h-3 mr-1" />
                Ideal Tide
              </Badge>
            )}
          </div>
        </div>

        {/* Apply button */}
        <Button
          type="button"
          size="sm"
          variant={isApplied ? "secondary" : "default"}
          onClick={() => onApply(suggestedTime)}
          className={cn(
            "ml-4 shrink-0",
            isApplied && "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
          )}
          data-testid="apply-magic-hour"
        >
          {isApplied ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Applied
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </div>
  );
}

export function SessionPlanningModal({
  open,
  onOpenChange,
  beach,
  initialMode = "log",
}: SessionPlanningModalProps) {
  const [activeTab, setActiveTab] = useState<string>(initialMode);
  const [appliedMagicHourTime, setAppliedMagicHourTime] = useState<string | null>(null);
  const [sessionFormKey, setSessionFormKey] = useState(0);

  // Handle applying the magic hour time to the session form
  const handleApplyMagicHour = useCallback((time: string) => {
    setAppliedMagicHourTime(time);
    // Force re-render of SessionForm with new initial time
    // This is a workaround since SessionForm manages its own state
    setSessionFormKey((prev) => prev + 1);
  }, []);

  // Reset applied time when modal closes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setAppliedMagicHourTime(null);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Session at {beach.name}</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue={initialMode}
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="log">Log Session</TabsTrigger>
            <TabsTrigger value="plan">Plan Session</TabsTrigger>
          </TabsList>

          <TabsContent value="log" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Record your surf session at {beach.name}. Track waves,
                conditions, and your experience.
              </p>
              <SessionForm
                beachId={beach.id}
                beachName={beach.name}
                onSuccess={() => handleOpenChange(false)}
                initialMode="log"
              />
            </div>
          </TabsContent>

          <TabsContent value="plan" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Plan an upcoming session at {beach.name}. Set a date and time
                based on forecast conditions.
              </p>

              {/* Magic Hour Suggestion */}
              <MagicHourSuggestion
                beachId={beach.id}
                onApply={handleApplyMagicHour}
                appliedTime={appliedMagicHourTime}
              />

              <SessionForm
                key={sessionFormKey}
                beachId={beach.id}
                beachName={beach.name}
                initialTime={appliedMagicHourTime || undefined}
                onSuccess={() => handleOpenChange(false)}
                initialMode="plan"
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
