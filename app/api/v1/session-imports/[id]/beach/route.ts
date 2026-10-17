import { z } from "zod";
import { createErrorResponse, createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { isSessionImportsUserAllowed } from "@/lib/flags/session-imports";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { ImportNotFoundError, processImport } from "@/lib/sessions/imports/process-import";
import { TrackFileError } from "@/lib/sessions/tracks/types";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({ beachId: z.uuid() });

export const POST = withNoStore(withRateLimit(withAuth(async (request, { user, supabase, params }) => {
  if (!isSessionImportsUserAllowed(user.id) || !z.uuid().safeParse(params.id).success) {
    return createErrorResponse("not_found", undefined, 404);
  }
  const { data: imported, error } = await supabase.from("session_imports")
    .select("id, user_id, status").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!imported || imported.user_id !== user.id) return createErrorResponse("not_found", undefined, 404);
  if (imported.status !== "needs_beach") return createErrorResponse("not_needs_beach", undefined, 409);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return createErrorResponse("invalid_beach", undefined, 400);
  const { data: beach, error: beachError } = await supabase.from("beaches")
    .select("id, deleted_at").eq("id", parsed.data.beachId).maybeSingle();
  if (beachError) throw new Error(beachError.message);
  if (!beach || beach.deleted_at) return createErrorResponse("invalid_beach", undefined, 400);
  try {
    const result = await processImport({ userClient: supabase, serviceClient: createServiceRoleClient(), now: new Date() }, params.id, user.id, beach.id);
    if (result.status === "duplicate") return createErrorResponse("duplicate", { sessionId: result.sessionId }, 409);
    return createSuccessResponse(result, result.status === "needs_beach" ? 202 : 200);
  } catch (error) {
    if (error instanceof ImportNotFoundError) return createErrorResponse("not_found", undefined, 404);
    if (error instanceof TrackFileError) return createErrorResponse(error.code, undefined, 422);
    return handleApiError(error, "Failed to confirm import beach");
  }
}, { errorMessage: "Failed to confirm import beach" }), "authenticated-default"));
