"use client";

import { Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionFormState } from "@/hooks/use-session-form";

interface DateTimeStepProps {
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function DateTimeStep({ formState, updateField }: DateTimeStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="session-date">Date</Label>
        <Input
          id="session-date"
          type="date"
          value={formState.selectedDate}
          onChange={(e) => updateField("selectedDate", e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="session-time">Time</Label>
        <div className="flex items-center">
          <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
          <Input
            id="session-time"
            type="time"
            value={formState.selectedTime}
            onChange={(e) => updateField("selectedTime", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
