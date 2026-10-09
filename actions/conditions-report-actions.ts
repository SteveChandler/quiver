"use server";

import { revalidatePath } from "next/cache";
import { makeAuthenticatedAction } from "@/lib/server-action-utils";
import type { ActionResult } from "@/lib/action-utils";
import type { ConditionsReportInput } from "@/types/conditions-report";
import { submitConditionsReportCore } from "@/lib/conditions-report/submit-conditions-report";

// ---------------------------------------------------------------------------
// submitConditionsReport
// ---------------------------------------------------------------------------

/**
 * Submit a conditions report for a beach.
 *
 * Creates:
 * 1. An intel_posts record with structured wave_size_range + vibe columns
 * 2. A minimal sessions record (source: 'conditions_report') for ML training
 *
 * Dedup: one report per user per beach per calendar day (local time).
 * If the user has already reported today, returns a specific error string so
 * the UI can show the "already reported" state.
 */
export const submitConditionsReport = makeAuthenticatedAction(
  async (
    user,
    supabase,
    input: ConditionsReportInput
  ): Promise<ActionResult<{ intelPostId: string; sessionId: string | null }>> => {
    const result = await submitConditionsReportCore(input, user, supabase);
    if (result.success) {
      revalidatePath(`/beach/${input.beachId}`);
    }
    return result;
  }
);
