import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireOwnership, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
import type { Database } from "@/types/database.generated";

const MAX_SIZE = 62914560;
const noStore = (response: NextResponse): NextResponse => { response.headers.set("Cache-Control", "no-store"); return response; };
const error = (code: string, status = 422): NextResponse => noStore(NextResponse.json({ error: code }, { status }));

export const POST = withAuth(async (request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
  const ownership = await requireOwnership(supabase, "sessions", params.id, user.id, "Session");
  if ("error" in ownership) return noStore(ownership.error);
  let body: { storagePath?: unknown; durationSec?: unknown; sizeBytes?: unknown };
  try { body = await request.json(); } catch { return error("bad_path"); }
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const durationSec = typeof body.durationSec === "number" ? body.durationSec : NaN;
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;
  if (!Number.isFinite(durationSec) || durationSec > 60 || durationSec < 0) return error("too_long");
  if (!Number.isFinite(sizeBytes) || sizeBytes > MAX_SIZE || sizeBytes < 0) return error("too_large");
  const prefix = `${params.id}/${user.id}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) return error("bad_path");
  if (!/\.(mp4|mov)$/i.test(storagePath)) return error("bad_type");
  const insert: Database["public"]["Tables"]["session_media"]["Insert"] = {
    session_id: params.id, user_id: user.id, storage_path: storagePath, public_url: "",
    file_size: sizeBytes, media_type: "video", metadata: { durationSec },
    moderation_status: "pending", thumbnail_path: null,
  };
  const { data, error: insertError } = await supabase.from("session_media").insert(insert).select("id").single();
  if (insertError) throw insertError;
  return noStore(NextResponse.json({ mediaId: data.id }, { status: 201 }));
}, { errorMessage: "Failed to finalize session video" });

export const GET = () => error("Method Not Allowed", 405);
