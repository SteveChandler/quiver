"use client";

import React, { useId, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Waves,
  Wind,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Info,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Session, Forecast } from "@/types/database";

interface ForecastFeedbackFormProps {
  session: Session;
  forecast?: Forecast;
  onSubmit: (feedback: ForecastFeedback) => Promise<void>;
  onSkip?: () => void;
  loading?: boolean;
  className?: string;
}

export interface ForecastFeedback {
  waveHeight: number;
  windCondition: string;
  windSpeed?: number;
  notes?: string;
  overallAccuracy: number;
}

const windConditions = [
  { value: "glassy", label: "Glassy (0-2 mph)", speed: 1 },
  { value: "light_offshore", label: "Light Offshore (3-8 mph)", speed: 5 },
  {
    value: "moderate_offshore",
    label: "Moderate Offshore (9-15 mph)",
    speed: 12,
  },
  { value: "strong_offshore", label: "Strong Offshore (16+ mph)", speed: 18 },
  { value: "light_onshore", label: "Light Onshore (3-8 mph)", speed: 5 },
  {
    value: "moderate_onshore",
    label: "Moderate Onshore (9-15 mph)",
    speed: 12,
  },
  { value: "strong_onshore", label: "Strong Onshore (16+ mph)", speed: 18 },
  { value: "side_shore", label: "Side Shore", speed: 10 },
  { value: "variable", label: "Variable/Changing", speed: 8 },
];

export function ForecastFeedbackForm({
  session,
  forecast,
  onSubmit,
  onSkip,
  loading = false,
  className,
}: ForecastFeedbackFormProps) {
  const [waveHeight, setWaveHeight] = useState<number[]>([3]);
  const [windCondition, setWindCondition] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [overallAccuracy, setOverallAccuracy] = useState<number[]>([3]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const waveHeightLabelId = useId();
  const windConditionLabelId = useId();
  const overallAccuracyLabelId = useId();
  const notesFieldId = useId();

  // Get forecast values for comparison
  const forecastWaveHeight = forecast?.wave_height
    ? parseFloat(forecast.wave_height.toString())
    : null;
  const forecastWindSpeed = forecast?.wind_speed
    ? parseFloat(forecast.wind_speed.toString().replace(/[^\d.]/g, ""))
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const selectedWind = windConditions.find(
        (w) => w.value === windCondition
      );

      const feedback: ForecastFeedback = {
        waveHeight: waveHeight[0],
        windCondition,
        windSpeed: selectedWind?.speed,
        notes: notes.trim() || undefined,
        overallAccuracy: overallAccuracy[0],
      };

      await onSubmit(feedback);
    } catch (error) {
      console.error("Error submitting forecast feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccuracyColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccuracyLabel = (rating: number) => {
    switch (rating) {
      case 1:
        return "Poor";
      case 2:
        return "Below Average";
      case 3:
        return "Average";
      case 4:
        return "Good";
      case 5:
        return "Excellent";
      default:
        return "Rate Accuracy";
    }
  };

  const getWaveHeightDelta = () => {
    if (!forecastWaveHeight) return null;
    const delta = waveHeight[0] - forecastWaveHeight;
    return delta;
  };

  const waveHeightDelta = getWaveHeightDelta();

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="bg-gradient-to-r from-blue-500 to-ocean-blue text-white">
        <CardTitle className="flex items-center space-x-2">
          <Waves className="h-5 w-5" />
          <span>How did the forecast compare?</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 opacity-80" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  Your feedback helps improve future forecasts for this beach.
                  This is optional but helps the community!
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Wave Height Comparison */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Waves className="h-5 w-5 text-blue-500" />
                <span
                  id={waveHeightLabelId}
                  className="text-sm font-medium"
                >
                  Actual Wave Height
                </span>
              </div>
              {forecast?.wave_height && (
                <Badge variant="outline" className="text-xs">
                  Forecast: {forecast.wave_height}
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">0 ft</span>
                <span className="text-lg font-semibold text-blue-600">
                  {waveHeight[0]} ft
                </span>
                <span className="text-sm text-muted-foreground">15+ ft</span>
              </div>

              <Slider
                value={waveHeight}
                onValueChange={setWaveHeight}
                max={15}
                min={0}
                step={0.5}
                className="w-full"
                disabled={loading || isSubmitting}
                aria-labelledby={waveHeightLabelId}
              />

              {waveHeightDelta !== null && (
                <div className="flex items-center justify-center">
                  <Badge
                    variant={
                      Math.abs(waveHeightDelta) <= 1 ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {waveHeightDelta > 0 ? "+" : ""}
                    {waveHeightDelta.toFixed(1)}ft vs forecast
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Wind Conditions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wind className="h-5 w-5 text-green-500" />
                <span
                  id={windConditionLabelId}
                  className="text-sm font-medium"
                >
                  Wind Conditions
                </span>
              </div>
              {forecast?.wind_speed && (
                <Badge variant="outline" className="text-xs">
                  Forecast: {forecast.wind_speed} {forecast.wind_direction}
                </Badge>
              )}
            </div>

            <Select
              value={windCondition}
              onValueChange={setWindCondition}
              disabled={loading || isSubmitting}
            >
              <SelectTrigger aria-labelledby={windConditionLabelId}>
                <SelectValue placeholder="Select wind conditions you experienced" />
              </SelectTrigger>
              <SelectContent>
                {windConditions.map((condition) => (
                  <SelectItem key={condition.value} value={condition.value}>
                    {condition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Overall Accuracy Rating */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span
                id={overallAccuracyLabelId}
                className="text-sm font-medium"
              >
                Overall Forecast Accuracy
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Poor</span>
                <span
                  className={cn(
                    "text-lg font-semibold",
                    getAccuracyColor(overallAccuracy[0])
                  )}
                >
                  {getAccuracyLabel(overallAccuracy[0])}
                </span>
                <span className="text-sm text-muted-foreground">Excellent</span>
              </div>

              <Slider
                value={overallAccuracy}
                onValueChange={setOverallAccuracy}
                max={5}
                min={1}
                step={1}
                className="w-full"
                disabled={loading || isSubmitting}
                aria-labelledby={overallAccuracyLabelId}
              />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-purple-500" />
              <label
                className="text-sm font-medium"
                htmlFor={notesFieldId}
              >
                Additional Notes
              </label>
              <span className="text-xs text-muted-foreground">(Optional)</span>
            </div>

            <Textarea
              id={notesFieldId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other observations about the conditions vs forecast? (e.g., surf quality, crowd, unexpected changes...)"
              rows={3}
              disabled={loading || isSubmitting}
              className="resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={!windCondition || loading || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>

            {onSkip && (
              <Button
                type="button"
                variant="outline"
                onClick={onSkip}
                disabled={loading || isSubmitting}
                className="px-6"
              >
                Skip
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
