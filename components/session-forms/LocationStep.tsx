"use client";

import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { Beach } from "@/types/database";
import { BeachSelector } from "@/components/BeachSelector";
import { track, slugify } from "@/lib/analytics";

interface LocationStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  mode: SessionFormMode;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function LocationStep({
  formState,
  beaches,
  mode,
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
          // Fire session_log_start when starting log mode and picking a beach
          if (mode === "log" && beach?.name) {
            try {
              track("session_log_start", { beach_slug: slugify(beach.name) });
            } catch {}
          }
        }}
      />
    </div>
  );
}
