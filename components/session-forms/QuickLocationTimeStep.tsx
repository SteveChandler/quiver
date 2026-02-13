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
import { SessionFormState } from "@/hooks/use-session-form";
import { Beach } from "@/types/database";
import { BeachSelector } from "@/components/BeachSelector";
import { track } from "@/lib/analytics";
import { slugify } from "@/lib/utils/text-utils";
import { cn } from "@/lib/utils";

interface QuickLocationTimeStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

/**
 * Quick log mode Step 1: Combined location + date/time selection.
 * Designed for minimal friction - pre-fills date to today and time based on
 * morning/afternoon with sensible defaults.
 */
export function QuickLocationTimeStep({
  formState,
  beaches,
  updateField,
}: QuickLocationTimeStepProps) {
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

  // Date constraints: log mode only allows past/today
  const [maxDate, setMaxDate] = useState<string | undefined>(undefined);
  useEffect(() => {
    setMaxDate(new Date().toISOString().split("T")[0]);
  }, []);

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
          Where did you surf?
        </label>
        <BeachSelector
          initialValue={formState.selectedBeach}
          onBeachSelected={(beach) => {
            updateField("selectedBeach", beach.name);
            updateField("selectedBeachId", beach.id);
            if (beach?.name) {
              try {
                track("session_log_start", { beach_slug: slugify(beach.name), quick: true });
              } catch {}
            }
          }}
        />
      </div>

      {/* Date and Time row */}
      <div>
        <label className="flex items-center text-sm font-medium mb-2">
          <CalendarDays className="w-4 h-4 mr-1.5 text-primary" />
          When did you surf?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            ref={dateInputRef}
            type="date"
            className={cn(
              baseInputClass,
              "w-full rounded-lg border border-input bg-background px-3 text-base shadow-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
            )}
            defaultValue={formState.selectedDate || ""}
            onChange={handleDateChange}
            max={maxDate}
            data-testid="quick-session-date-input"
            suppressHydrationWarning
          />
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
              data-testid="quick-session-time-input"
            />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-2">
          How long was your session?
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
