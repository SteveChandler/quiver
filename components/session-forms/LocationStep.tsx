"use client";

import { SessionFormMode, SessionFormState } from "@/hooks/use-session-form";
import { Beach } from "@/types/database";
import { BeachSelector } from "@/components/BeachSelector";
import { track } from "@/lib/analytics";
import { buildSessionLogEventMetadata } from "@/lib/analytics/session-log-funnel";
import { slugify } from "@/lib/utils/text-utils";

interface LocationStepProps {
  formState: SessionFormState;
  beaches: Beach[];
  mode: SessionFormMode;
  sessionLogFlowId?: string;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function LocationStep({
  formState,
  beaches,
  mode,
  sessionLogFlowId,
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
              track(
                "session_log_start",
                sessionLogFlowId
                  ? {
                      ...buildSessionLogEventMetadata(sessionLogFlowId, {
                        event_id: `session-log:${sessionLogFlowId}:start:web:v1`,
                      }),
                      beach_slug: slugify(beach.name),
                    }
                  : { beach_slug: slugify(beach.name) },
              );
            } catch {}
          }
        }}
      />
    </div>
  );
}
