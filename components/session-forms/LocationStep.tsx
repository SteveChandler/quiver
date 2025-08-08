"use client";

import { SessionFormState } from "@/hooks/use-session-form";
import { Beach } from "@/types/database";
import { BeachSelector } from "@/components/BeachSelector";

interface LocationStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function LocationStep({
  formState,
  beaches,
  updateField,
}: LocationStepProps) {
  return (
    <div className="space-y-4">
      <BeachSelector
        data-testid="beach-selector"
        initialValue={formState.selectedBeach}
        onBeachSelected={(beach) => {
          updateField("selectedBeach", beach.name);
          updateField("selectedBeachId", beach.id);
        }}
      />
    </div>
  );
}
