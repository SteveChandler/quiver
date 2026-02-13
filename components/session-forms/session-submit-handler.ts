/**
 * Session form submission handler.
 * Extracted from SessionForm.tsx to reduce component complexity.
 *
 * Orchestrates: validation, analytics, session creation (plan/log/conversion),
 * photo upload, invitation sending, and navigation.
 */

import { toast } from "sonner";
import {
  createPlannedSession,
  createLoggedSession,
} from "@/actions/session-actions";
import { createActivity } from "@/actions/activity-actions";
import { buildSessionPayload } from "@/lib/utils/session-data-builder";
import { handleSessionConversion } from "./session-conversion-handler";
import { uploadSessionPhotos } from "./session-photo-handler";
import { sendSessionInvitations } from "./session-invitation-handler";
import type { SessionFormState, SessionFormMode } from "@/hooks/use-session-form";

/** Dependencies injected from the component. */
export interface SubmitHandlerDeps {
  userId: string;
  formState: SessionFormState;
  mode: SessionFormMode;
  isPlanning: boolean;
  selectedPhotos: File[];
  convertingFromPlanned: string | null;
  updateField: <K extends keyof SessionFormState>(
    field: K,
    value: SessionFormState[K]
  ) => void;
  setLoading: (loading: boolean) => void;
  setSessionCreated: (created: boolean) => void;
  setCreatedSession: (session: any) => void;
  onSuccess?: () => void;
  routerPush: (path: string) => void;
}

/**
 * Handle session form submission.
 * This is the main orchestration function for both planned and logged sessions.
 */
export async function handleSessionSubmit(deps: SubmitHandlerDeps) {
  const {
    userId,
    formState,
    mode,
    isPlanning,
    selectedPhotos,
    convertingFromPlanned,
    updateField,
    setLoading,
    setSessionCreated,
    setCreatedSession,
    onSuccess,
    routerPush,
  } = deps;

  // Validate required fields
  if (!formState.selectedBeach) {
    toast.error("Please select a beach location");
    return;
  }

  if (!formState.selectedDate) {
    toast.error("Please select a date");
    return;
  }

  if (isPlanning && !formState.selectedTime) {
    toast.error("Please select a start time");
    return;
  }

  // Ensure a default duration exists
  if (!formState.duration) {
    updateField("duration", "60m");
  }

  setLoading(true);

  try {
    // Analytics: planning attempt (non-blocking)
    void createActivity("session_planning_attempt", "session", "", {
      beachId: formState.selectedBeachId || null,
      beachName: formState.selectedBeach || null,
      selectedDate: formState.selectedDate || null,
      selectedTime: formState.selectedTime || null,
      mode,
    });

    // Handle converting planned session to completed
    if (convertingFromPlanned && !isPlanning) {
      await handleSessionConversion(
        convertingFromPlanned,
        formState,
        userId,
        selectedPhotos
      );
      setSessionCreated(true);
      return;
    }

    // Build session payload using shared builder
    const sessionData = buildSessionPayload(formState, userId, isPlanning);

    if (isPlanning) {
      const result = await createPlannedSession(sessionData);
      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Session planned successfully!");

      // Analytics: success (non-blocking)
      void createActivity("session_planned", "session", result.data.id, {
        inviteesCount: formState.invitees?.length || 0,
      });

      // If embedded, let parent handle completion
      if (onSuccess) {
        onSuccess();
        return;
      }

      // Fire-and-forget invitations
      if (formState.invitees && formState.invitees.length > 0) {
        void sendSessionInvitations(
          result.data.id,
          formState.invitees,
          formState.invitationMessage
        );
      }
    } else {
      // Create logged session
      const sessionResult = await createLoggedSession(sessionData);
      if (!sessionResult.success || !sessionResult.data) {
        throw new Error(sessionResult.error || "Failed to create session");
      }
      const session = sessionResult.data;
      setCreatedSession(session);

      // Upload photos and show appropriate success toast
      await uploadSessionPhotos(session.id, selectedPhotos, "logged");

      setSessionCreated(true);

      // If embedded, let parent handle completion
      if (onSuccess) {
        onSuccess();
        return;
      }
    }

    // Handle completion - redirect to profile (only for planned sessions)
    // Logged sessions redirect via useEffect in SessionForm.tsx after feedback is completed
    if (isPlanning) {
      routerPush("/profile");
    }
  } catch (error) {
    console.error("Error saving session:", error);
    // Analytics: failure (non-blocking)
    void createActivity("session_plan_failed", "session", "n/a", {
      error: error instanceof Error ? error.message : "Unknown error",
      beachId: formState.selectedBeachId || null,
      selectedDate: formState.selectedDate || null,
      selectedTime: formState.selectedTime || null,
      mode,
    });
    toast.error(
      error instanceof Error
        ? error.message
        : "Failed to save session. Please try again."
    );
  } finally {
    setLoading(false);
  }
}
