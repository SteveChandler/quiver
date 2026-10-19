import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { importStartedAt } from "@/lib/sessions/imports/import-start-time";
import { isGarminWatchUserAllowed } from "@/lib/flags/garmin-watch";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";

export const GET = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase }) => {
  if (!isGarminWatchUserAllowed(user.id)) return createErrorResponse("not_found", undefined, 404);
  const { data: devices, error: devicesError } = await supabase.from("watch_devices")
    .select("id, user_id, platform, device_uid, device_part_number, device_name, app_version, created_at, last_seen_at, revoked_at")
    .eq("user_id", user.id).is("revoked_at", null).order("created_at", { ascending: false });
  if (devicesError) throw devicesError;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: imports, error: importsError } = await supabase.from("session_imports")
    .select("id, user_id, device_id, status, origin, error, summary, session_id, created_at")
    .eq("user_id", user.id).eq("origin", "garmin_watch")
    .or("error.is.null,error.neq.duplicate")
    .in("status", ["failed", "needs_beach"]).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(50);
  if (importsError) throw importsError;

  const problems = imports ?? [];
  const ids = problems.filter(row => !importStartedAt(row.summary)).map(row => row.id);
  const headers = new Map<string, string>();
  if (ids.length) {
    const { data: uploads, error: uploadsError } = await supabase.from("watch_uploads")
      .select("import_id, header").eq("user_id", user.id).in("import_id", ids);
    if (uploadsError) throw uploadsError;
    for (const upload of uploads ?? []) {
      if (upload.import_id) {
        const value = importStartedAt(upload.header);
        if (value) headers.set(upload.import_id, value);
      }
    }
  }

  return createSuccessResponse({
    devices: (devices ?? []).map(device => ({
      id: device.id, name: device.device_name ?? "Garmin watch",
      partNumber: device.device_part_number ?? "", linkedAt: device.created_at ?? "",
      lastSeenAt: device.last_seen_at,
    })),
    problems: problems.map(imported => ({
      importId: imported.id, status: imported.status, startedAt: importStartedAt(imported.summary) ?? headers.get(imported.id) ?? null,
      reason: imported.error,
    })),
  });
}, { errorMessage: "Failed to load watch devices" }), "authenticated-default"));
