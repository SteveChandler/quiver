import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import type { MergeResult } from "@/lib/sessions/imports/watch-claims";

export const runtime = "nodejs";

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

export type WatchStatusResponse = {
  claim: "pending" | "claimed" | "none";
  importId: string | null;
  importStatus: string | null;
  claimedAt: string | null;
  mergedFields: string[];
  keptFields: MergeResult["keptFields"];
};

const mergeResultSchema = z.object({
  mergedFields: z.array(z.string()),
  keptFields: z.array(z.object({ field: z.string(), phoneValue: z.unknown(), watchValue: z.unknown() })),
});

// The phone polls this after saving a session that claimed a watch recording. Reads run as the
// user, so RLS on sessions, session_watch_claims and session_imports scopes every row.
export const GET = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!z.uuid().safeParse(params.id).success) return createErrorResponse("invalid_request", undefined, 400);

  const { data: session, error: sessionError } = await supabase.from("sessions")
    .select("id").eq("id", params.id).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session) return createErrorResponse("not_found", undefined, 404);

  const { data: claim, error: claimError } = await supabase.from("session_watch_claims")
    .select("claimed_import_id, claimed_at, merge_result").eq("session_id", session.id)
    .eq("user_id", user.id).maybeSingle();
  const none: WatchStatusResponse = { claim: "none", importId: null, importStatus: null, claimedAt: null,
    mergedFields: [], keptFields: [] };
  // Before the claims migration reaches an environment there are no claims, not an error.
  if (claimError && MISSING_TABLE_CODES.has(claimError.code)) return createSuccessResponse(none);
  if (claimError) throw new Error(claimError.message);
  if (!claim) return createSuccessResponse(none);
  if (!claim.claimed_import_id) return createSuccessResponse({ ...none, claim: "pending" });

  const { data: imported, error: importError } = await supabase.from("session_imports")
    .select("status").eq("id", claim.claimed_import_id).eq("user_id", user.id).maybeSingle();
  if (importError) throw new Error(importError.message);
  const merge = mergeResultSchema.safeParse(claim.merge_result);
  return createSuccessResponse({
    claim: "claimed", importId: claim.claimed_import_id, importStatus: imported?.status ?? null,
    claimedAt: claim.claimed_at, mergedFields: merge.success ? merge.data.mergedFields : [],
    keptFields: merge.success ? merge.data.keptFields : [],
  } satisfies WatchStatusResponse);
}, { errorMessage: "Failed to load watch status" }), "authenticated-default"));
