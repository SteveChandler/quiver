import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
const noStore = (r: NextResponse): NextResponse => { r.headers.set("Cache-Control", "no-store"); return r; };
export const GET = withAuth(async (_request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
  const { data: media, error: mediaError } = await (supabase.from("session_media") as any)
    .select("id, session_id, user_id, storage_path, moderation_status, sessions!inner(is_public)")
    .eq("id", params.mediaId).eq("session_id", params.id).eq("media_type", "video").is("deleted_at", null).maybeSingle();
  if (mediaError) throw mediaError;
  if (!media) return noStore(NextResponse.json({ error: "Not found" }, { status: 404 }));
  const visible = media.user_id === user.id || (media.moderation_status === "approved" && media.sessions?.is_public === true);
  if (!visible) return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  const { data, error: signError } = await supabase.storage.from("session-videos").createSignedUrl(media.storage_path, 300);
  if (signError) throw signError;
  return noStore(NextResponse.json({ url: data.signedUrl, expiresIn: 300 }));
});
