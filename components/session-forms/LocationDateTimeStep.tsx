"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, CalendarDays, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DURATION_OPTIONS } from "@/lib/constants/session-form-constants";
import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { Beach } from "@/types/database";
import { BeachSelector } from "@/components/BeachSelector";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { cn } from "@/lib/utils";

interface LocationDateTimeStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  mode: SessionFormMode;
}

export function LocationDateTimeStep({
  formState,
  beaches,
  updateField,
  mode,
}: LocationDateTimeStepProps) {
  const isPlanning = mode === "plan";
  const baseInputClass = "h-12 min-w-0 appearance-none";

  const handleDurationChange = useCallback(
    (value: string) => {
      updateField("duration", `${value}m`);
    },
    [updateField]
  );

  const currentDurationValue = useMemo(() => {
    if (!formState.duration) return "60";
    const match = formState.duration.match(/(\d+)/);
    const parsed = match ? parseInt(match[1]) : 60;
    return parsed.toString();
  }, [formState.duration]);

  // Date constraints - client-side only to avoid hydration mismatch
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

  // Stable date input refs (from DateTimeSection pattern)
  const dateInputRef = useRef<HTMLInputElement>(null);
  const updateFieldRef = useRef(updateField);
  updateFieldRef.current = updateField;

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateFieldRef.current("selectedDate", e.target.value);
    },
    []
  );

  useEffect(() => {
    if (
      dateInputRef.current &&
      dateInputRef.current !== document.activeElement
    ) {
      dateInputRef.current.value = formState.selectedDate || "";
    }
  }, [formState.selectedDate]);

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateField("selectedTime", e.target.value);
    },
    [updateField]
  );

  return (
    <div className="space-y-6">
      {/* Beach Selection */}
      <div>
        <label className="flex items-center text-sm font-medium mb-2">
          <MapPin className="w-4 h-4 mr-1.5 text-primary" />
          {isPlanning ? "Where are you planning to surf?" : "Where did you surf?"}
        </label>
        <BeachSelector
          initialValue={formState.selectedBeach}
          onBeachSelected={(beach) => {
            updateField("selectedBeach", beach.name);
            updateField("selectedBeachId", beach.id);
            if (mode === "log" && beach?.name) {
              try {
                track("session_log_start", { beach_slug: slugify(beach.name) });
              } catch {}
            }
          }}
        />
      </div>

      {/* Date and Time row */}
      <div>
        <label className="flex items-center text-sm font-medium mb-2">
          <CalendarDays className="w-4 h-4 mr-1.5 text-primary" />
          {isPlanning ? "When are you planning to surf?" : "When did you surf?"}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <Input
              ref={dateInputRef}
              type="date"
              className={cn(
                baseInputClass,
                "w-full rounded-lg border border-input bg-background px-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              )}
              defaultValue={formState.selectedDate || ""}
              onChange={handleDateChange}
              max={dateConstraints.max}
              min={dateConstraints.min}
              data-testid="session-date-input"
              suppressHydrationWarning
            />
          </div>
          <div className="relative min-w-0">
            <Timer className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="time"
              className={cn(
                baseInputClass,
                "w-full rounded-lg border border-input bg-background pl-10 pr-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              )}
              value={formState.selectedTime || ""}
              onChange={handleTimeChange}
              data-testid="session-time-input"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isPlanning
            ? "Select a future date and time for your session"
            : "When did your session take place?"}
        </p>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {isPlanning ? "Expected Duration" : "How long was your session?"}
        </label>
        <Select
          value={currentDurationValue}
          defaultValue={currentDurationValue}
          onValueChange={handleDurationChange}
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
      </div>
    </div>
  );
}
