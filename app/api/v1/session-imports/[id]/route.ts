import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { resolveImportBeach, type ImportBeach } from "@/lib/sessions/imports/resolve-import-beach";
import { canViewSessionWaves } from "@/lib/sessions/waves/waves-access";

export const runtime = "nodejs";

function summaryData(summary: unknown): { startedAt: string | null; centroid: { lat: number; lon: number } | null } {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return { startedAt: null, centroid: null };
  const value = summary as Record<string, unknown>;
  const start = value.inWaterStart ?? value.startedAt;
  const startedAt = typeof start === "string" ? start : null;
  const point = value.centroid;
  if (!point || typeof point !== "object" || Array.isArray(point)) return { startedAt, centroid: null };
  const centroid = point as Record<string, unknown>;
  if (typeof centroid.lat !== "number" || typeof centroid.lon !== "number"
    || !Number.isFinite(centroid.lat) || !Number.isFinite(centroid.lon)) return { startedAt, centroid: null };
  return { startedAt, centroid: { lat: centroid.lat, lon: centroid.lon } };
}

export const GET = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!canViewSessionWaves(user.id) || !z.uuid().safeParse(params.id).success) {
    return createErrorResponse("not_found", undefined, 404);
  }
  const { data: imported, error } = await supabase.from("session_imports")
    .select("id, user_id, status, origin, summary, session_id")
    .eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!imported || imported.user_id !== user.id) return createErrorResponse("not_found", undefined, 404);

  const summary = summaryData(imported.summary);
  let startedAt = summary.startedAt;
  if (!startedAt && imported.origin === "garmin_watch") {
    const { data: upload, error: uploadError } = await supabase.from("watch_uploads")
      .select("header").eq("import_id", imported.id).eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (uploadError) throw uploadError;
    startedAt = summaryData(upload?.header).startedAt;
  }
  let candidates: ImportBeach[] = [];
  if (imported.status === "needs_beach" && summary.centroid) {
    const resolution = await resolveImportBeach(supabase, summary.centroid);
    candidates = resolution.status === "resolved" ? [resolution.beach] : resolution.candidates;
  }
  return createSuccessResponse({
    id: imported.id, status: imported.status, origin: imported.origin,
    startedAt, candidates, sessionId: imported.session_id,
  });
}, { errorMessage: "Failed to load session import" }), "authenticated-default"));
