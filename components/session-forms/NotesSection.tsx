"use client";

import { ClipboardList } from "lucide-react";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import {
  getFormText,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";
import { useId } from "react";

interface NotesSectionProps {
  mode: SessionFormMode;
  formState: SessionFormState;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
}

export function NotesSection({
  mode,
  formState,
  updateField,
}: NotesSectionProps) {
  const text = getFormText(mode);
  const notesId = useId();
  const notesHintId = useId();

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <ClipboardList className="w-5 h-5 mr-2 text-primary" />
          {text.notes}
        </div>
      }
      description="Share details about your session experience"
    >
      <div className="space-y-4">
        {/* Session Notes */}
        <div>
          <label htmlFor={notesId} className="block text-sm font-medium mb-2">
            Session Experience
          </label>
          <textarea
            id={notesId}
            aria-describedby={notesHintId}
            placeholder={text.notesPlaceholder}
            className="w-full border border-[#404C92] bg-[#354090] text-[#F0F0F0] placeholder:text-[#B8C7E0] rounded-lg p-3 min-h-24 focus:ring-2 focus:ring-[#F78E42] focus:border-transparent resize-vertical"
            value={formState.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={4}
          />
          <p id={notesHintId} className="text-xs text-muted-foreground mt-1">
            Describe how your session went, memorable moments, or lessons learned
          </p>
        </div>

        <div className="pt-4 border-t">
          <div className="bg-[#354090] border border-[#404C92] rounded-lg p-3">
            <div className="flex items-start">
              <ClipboardList className="w-4 h-4 mt-0.5 mr-2 text-[#7BFF5C] flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-[#7BFF5C] mb-1">
                  Session Summary Tips:
                </p>
                <ul className="text-[#A8B8D0] space-y-1 text-xs">
                  <li>• Describe the wave conditions you experienced</li>
                  <li>• Note any new skills you practiced or learned</li>
                  <li>• Share memorable moments or challenges</li>
                  <li>• Help other surfers with local knowledge</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimpleCardLayout>
  );
}
