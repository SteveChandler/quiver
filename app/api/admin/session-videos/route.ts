import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, type AdminAuthenticatedContext } from "@/lib/middleware/api-wrappers";
import type { Database } from "@/types/database.generated";

const headers = { "Cache-Control": "private, no-store" };
export const GET = withAdminAuth(async (_request: NextRequest, { supabase }: AdminAuthenticatedContext) => {
  const { data, error } = await supabase
    .from("session_media")
    .select("id, session_id, user_id, storage_path, file_size, metadata, created_at, moderation_status, sessions!inner(is_public, beach_name)")
    .eq("media_type", "video").eq("moderation_status", "pending").is("deleted_at", null).order("created_at", { ascending: true });
  if (error) throw error;
  const rows = await Promise.all((data ?? []).map(async (row) => {
    const signed = await supabase.storage.from("session-videos").createSignedUrl(row.storage_path, 300);
    return { ...row, previewUrl: signed.data?.signedUrl ?? null };
  }));
  return NextResponse.json({ videos: rows }, { headers });
});

export const POST = withAdminAuth(async (request: NextRequest, { supabase }: AdminAuthenticatedContext) => {
  const body = await request.json().catch(() => null) as { mediaId?: unknown; action?: unknown; reason?: unknown } | null;
  if (typeof body?.mediaId !== "string" || !["approve", "reject"].includes(String(body.action))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 422, headers });
  }
  if (body.action === "reject" && (typeof body.reason !== "string" || !body.reason.trim())) {
    return NextResponse.json({ error: "reason_required" }, { status: 422, headers });
  }
  const update: Database["public"]["Tables"]["session_media"]["Update"] = {
    moderation_status: body.action === "approve" ? "approved" : "rejected",
    moderation_reason: typeof body.reason === "string" ? body.reason.trim() : null,
  };
  const { error } = await supabase.from("session_media").update(update)
    .eq("id", body.mediaId).eq("media_type", "video").eq("moderation_status", "pending");
  if (error) throw error;
  return NextResponse.json({ ok: true }, { headers });
});
