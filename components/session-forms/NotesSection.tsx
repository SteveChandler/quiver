"use client";

import { ClipboardList, Users, Mail } from "lucide-react";
import { SimpleCardLayout } from "@/components/ui/form-layout";
import { FormTextarea, FormInput } from "@/components/ui/form-fields";
import {
  getFormText,
  SessionFormMode,
} from "@/lib/constants/session-form-constants";
import { SessionFormState } from "@/hooks/use-session-form";
import { GroupInvitationsSection } from "./GroupInvitationsSection";

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
  const isPlanning = mode === "plan";

  return (
    <SimpleCardLayout
      title={
        <div className="flex items-center">
          <ClipboardList className="w-5 h-5 mr-2 text-primary" />
          {text.notes}
        </div>
      }
      description={
        isPlanning
          ? "Add notes and invite friends to join your session"
          : "Share details about your session experience"
      }
    >
      <div className="space-y-4">
        {/* Session Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">
            {isPlanning ? "Session Notes" : "Session Experience"}
          </label>
          <textarea
            placeholder={text.notesPlaceholder}
            className="w-full border rounded-lg p-3 min-h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            value={formState.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {isPlanning
              ? "Share your goals, expectations, or any important details"
              : "Describe how your session went, memorable moments, or lessons learned"}
          </p>
        </div>

        {/* Invite Friends - Only show for planning */}
        {isPlanning && (
          <GroupInvitationsSection
            formState={formState}
            updateField={updateField}
          />
        )}

        {/* Session Summary for Logged Sessions */}
        {!isPlanning && (
          <div className="pt-4 border-t">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start">
                <ClipboardList className="w-4 h-4 mt-0.5 mr-2 text-green-600 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-800 mb-1">
                    Session Summary Tips:
                  </p>
                  <ul className="text-green-700 space-y-1 text-xs">
                    <li>• Describe the wave conditions you experienced</li>
                    <li>• Note any new skills you practiced or learned</li>
                    <li>• Share memorable moments or challenges</li>
                    <li>• Help other surfers with local knowledge</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SimpleCardLayout>
  );
}
