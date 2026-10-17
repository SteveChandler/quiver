import { z } from "zod";
import { createErrorResponse, createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { isSessionImportsUserAllowed } from "@/lib/flags/session-imports";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { processImport } from "@/lib/sessions/imports/process-import";
import { TrackFileError } from "@/lib/sessions/tracks/types";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

export const POST = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!isSessionImportsUserAllowed(user.id) || !z.uuid().safeParse(params.id).success) {
    return createErrorResponse("not_found", undefined, 404);
  }
  const { data: imported, error } = await supabase.from("session_imports")
    .select("id, user_id, status").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!imported || imported.user_id !== user.id) return createErrorResponse("not_found", undefined, 404);
  try {
    const result = await processImport({ userClient: supabase, serviceClient: createServiceRoleClient(), now: new Date() }, params.id, user.id);
    if (result.status === "duplicate") return createErrorResponse("duplicate", { sessionId: result.sessionId }, 409);
    return createSuccessResponse(result, result.status === "needs_beach" ? 202 : 200);
  } catch (error) {
    if (error instanceof TrackFileError) return createErrorResponse(error.code, undefined, 422);
    return handleApiError(error, "Failed to process session import");
  }
}, { errorMessage: "Failed to process session import" }), "authenticated-default"));
