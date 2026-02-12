/**
 * Handles conversion of a planned session to a completed session.
 * Extracted from SessionForm.tsx to reduce component complexity.
 */

import {
  updatePlannedSessionToCompleted,
} from "@/actions/session-actions";
import { buildSessionPayload } from "@/lib/utils/session-data-builder";
import { uploadSessionPhotos } from "./session-photo-handler";
import type { SessionFormState } from "@/hooks/use-session-form";

interface ConversionResult {
  success: boolean;
}

/**
 * Convert a planned session to completed status, uploading any photos.
 *
 * @returns true if conversion succeeded
 */
export async function handleSessionConversion(
  plannedSessionId: string,
  formState: SessionFormState,
  userId: string,
  selectedPhotos: File[]
): Promise<ConversionResult> {
  // Build the payload to extract parsed values from the shared builder
  const conversionPayload = buildSessionPayload(formState, userId, false);

  // updatePlannedSessionToCompleted expects water_temp as string (legacy API)
  const completedData = {
    ...(conversionPayload.duration_minutes !== undefined && {
      duration_minutes: conversionPayload.duration_minutes,
    }),
    ...(conversionPayload.wave_quality !== undefined && {
      wave_quality: conversionPayload.wave_quality,
    }),
    ...(formState.waterTemp && { water_temp: formState.waterTemp }),
    ...(conversionPayload.crowd_level !== undefined && {
      crowd_level: conversionPayload.crowd_level,
    }),
    ...(conversionPayload.parking_ease !== undefined && {
      parking_ease: conversionPayload.parking_ease,
    }),
    ...(conversionPayload.rating !== undefined && {
      rating: conversionPayload.rating,
    }),
    ...(formState.notes && { notes: formState.notes }),
  };

  await updatePlannedSessionToCompleted(plannedSessionId, completedData);

  // Handle photo uploads for converted session
  await uploadSessionPhotos(plannedSessionId, selectedPhotos, "completed");

  return { success: true };
}
