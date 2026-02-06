"use client";

import { CalendarDays, Timer } from "lucide-react";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
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
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
  const baseInputClass = "h-12 min-w-0 appearance-none";

  const handleDurationChange = useCallback(
    (value: string) => {
      updateField("duration", `${value}m`);
    },
    [updateField]
  );

  // Get current duration value as number for the select - stabilize the value
  const currentDurationValue = useMemo(() => {
    if (!formState.duration) return "60";
    // Extract number from strings like "60m", "2h 30m", etc.
    const match = formState.duration.match(/(\d+)/);
    const parsed = match ? parseInt(match[1]) : 60;
    return parsed.toString();
  }, [formState.duration]);

  // Use state for date constraints to avoid hydration mismatches.
  // On initial SSR render, constraints are undefined. After hydration, they're set client-side.
  const [dateConstraints, setDateConstraints] = useState<{
    min: string | undefined;
    max: string | undefined;
  }>({ min: undefined, max: undefined });

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDateConstraints({
      min: isPlanning ? today : undefined,
      max: isPlanning ? undefined : today,
    });
  }, [isPlanning]);

  // Use ref to prevent infinite loops
  const dateInputRef = useRef<HTMLInputElement>(null);
  const updateFieldRef = useRef(updateField);
  updateFieldRef.current = updateField;

  // Stable date change handler that doesn't cause re-renders
  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateFieldRef.current("selectedDate", e.target.value);
    },
    []
  );

  // Update input value when formState changes (but not during typing)
  useEffect(() => {
    if (
      dateInputRef.current &&
      dateInputRef.current !== document.activeElement
    ) {
      dateInputRef.current.value = formState.selectedDate || "";
    }
  }, [formState.selectedDate]);

  // Memoize time change handler
  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateField("selectedTime", e.target.value);
    },
    [updateField]
  );

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
          <div className="min-w-0">
            <label className="block text-sm font-medium mb-2">
              {isPlanning ? "Session Date" : "Date Surfed"}
            </label>
            <Input
              ref={dateInputRef}
              type="date"
              className={cn(
                baseInputClass,
                "w-full rounded-lg border border-input bg-background px-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              )}
              defaultValue={formState.selectedDate || ""}
              onChange={handleDateChange}
              disabled={isDisabled}
              max={dateConstraints.max}
              min={dateConstraints.min}
              data-testid="session-date-input"
              suppressHydrationWarning
            />
            {isPlanning && (
              <p className="text-xs text-muted-foreground mt-1">
                Select a future date for your planned session
              </p>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-medium mb-2">
              {isPlanning ? "Start Time" : "Time Started"}
            </label>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                className={cn(
                  baseInputClass,
                  "w-full rounded-lg border border-input bg-background pl-10 pr-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
                )}
                value={formState.selectedTime || ""}
                onChange={handleTimeChange}
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
            defaultValue={currentDurationValue}
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
