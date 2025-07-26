"use client";

import { CalendarDays, Timer } from "lucide-react";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import { FormInput } from "@/components/ui/form-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DURATION_OPTIONS,
  getFormText,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";
import { useCallback, useMemo } from "react";

interface DateTimeSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  sessionCreated?: boolean;
}

export function DateTimeSection({
  mode,
  formState,
  updateField,
  sessionCreated = false,
}: DateTimeSectionProps) {
  const text = getFormText(mode);
  const isPlanning = mode === "plan";
  const isDisabled = !isPlanning && sessionCreated;

  const handleDurationChange = useCallback(
    (value: string) => {
      updateField("duration", `${value}m`);
    },
    [updateField]
  );

  // Get current duration value as number for the select - stabilize the value
  const currentDurationValue = useMemo(() => {
    if (!formState.duration) return "60";
    const parsed = parseInt(formState.duration);
    return isNaN(parsed) ? "60" : parsed.toString();
  }, [formState.duration]);

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <CalendarDays className="w-5 h-5 mr-2 text-primary" />
          {text.dateTime}
        </div>
      }
      description={
        isPlanning
          ? "When are you planning to surf?"
          : "When did your session take place?"
      }
    >
      <div className="space-y-4">
        {/* Date and Time in same row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {isPlanning ? "Session Date" : "Date Surfed"}
            </label>
            <input
              type="date"
              className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={formState.selectedDate || ""}
              onChange={(e) => updateField("selectedDate", e.target.value)}
              disabled={isDisabled}
              max={
                isPlanning ? undefined : new Date().toISOString().split("T")[0]
              }
              min={
                isPlanning ? new Date().toISOString().split("T")[0] : undefined
              }
              data-testid="session-date-input"
            />
            {isPlanning && (
              <p className="text-xs text-muted-foreground mt-1">
                Select a future date for your planned session
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {isPlanning ? "Start Time" : "Time Started"}
            </label>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="time"
                className="w-full border rounded-lg p-3 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formState.selectedTime || ""}
                onChange={(e) => updateField("selectedTime", e.target.value)}
                disabled={isDisabled}
                data-testid="session-time-input"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isPlanning
                ? "When do you plan to start?"
                : "What time did you start surfing?"}
            </p>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {text.durationLabel}
          </label>
          <Select
            value={currentDurationValue}
            onValueChange={handleDurationChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {isPlanning
              ? "How long are you planning to surf?"
              : "How long did your session last?"}
          </p>
        </div>
      </div>
    </SimpleCardLayout>
  );
}
