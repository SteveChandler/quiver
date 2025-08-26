"use client";

import React from "react";
import { Calendar, Clock, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SessionFormState } from "@/hooks/use-session-form";

// Support both old and new session form interfaces
interface DateTimeStepProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  mode?: "plan" | "log";
}

export function DateTimeStep({ formState, updateField, mode = "plan" }: DateTimeStepProps) {
  const isPlanning = mode === "plan";

  return (
    <div className="space-y-6">
      
      {/* Date Selection */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          <Label htmlFor="date-input" className="text-sm font-medium">
            {isPlanning ? "Session Date" : "When did you surf?"}
          </Label>
        </div>
        <Input
          id="date-input"
          type="date"
          value={formState.selectedDate}
          onChange={(e) => updateField("selectedDate", e.target.value)}
          min={isPlanning ? new Date().toISOString().split('T')[0] : undefined}
          max={isPlanning ? undefined : new Date().toISOString().split('T')[0]}
          className="w-full"
          data-testid="date-input"
        />
        {isPlanning && (
          <p className="text-xs text-gray-500">
            Select a future date for your planned session
          </p>
        )}
      </div>

      {/* Time Selection - Required for planning, optional for logging */}
      {(isPlanning || formState.selectedTime) && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <Label htmlFor="time-input" className="text-sm font-medium">
              {isPlanning ? "Start Time" : "Start Time (optional)"}
            </Label>
          </div>
          <Input
            id="time-input"
            type="time"
            value={formState.selectedTime}
            onChange={(e) => updateField("selectedTime", e.target.value)}
            className="w-full"
            data-testid="time-input"
          />
          {isPlanning && (
            <p className="text-xs text-gray-500">
              When do you plan to arrive at the beach?
            </p>
          )}
        </div>
      )}

      {/* Duration Selection */}
      {formState.duration !== undefined && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Timer className="w-4 h-4 text-blue-500" />
            <Label className="text-sm font-medium">
              {isPlanning ? "Planned Duration" : "Session Duration"}
            </Label>
          </div>
          <Select
            value={formState.duration}
            onValueChange={(value) => updateField("duration", value)}
          >
            <SelectTrigger data-testid="duration-select">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30m">30 minutes</SelectItem>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="1h30m">1.5 hours</SelectItem>
              <SelectItem value="2h">2 hours</SelectItem>
              <SelectItem value="2h30m">2.5 hours</SelectItem>
              <SelectItem value="3h">3 hours</SelectItem>
              <SelectItem value="4h">4+ hours</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500">
            How long {isPlanning ? "do you plan to surf" : "did you surf"}?
          </p>
        </div>
      )}

      {/* Helpful Tips */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              {isPlanning ? (
                <span>
                  <strong>Pro tip:</strong> Check tide times and weather forecasts to pick the optimal time for your session.
                </span>
              ) : (
                <span>
                  <strong>Note:</strong> Time and duration help track your surfing patterns and progress over time.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
