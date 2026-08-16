import { NextRequest, NextResponse } from "next/server";
import { withAuth, type OptionalAuthContext } from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";
const noStore = (r: NextResponse): NextResponse => { r.headers.set("Cache-Control", "no-store"); return r; };
export const GET = withAuth(async (_request: NextRequest, { params, user, supabase }: OptionalAuthContext) => {
  const { data: media, error: mediaError } = await supabase
    .from("session_media")
    .select("id, session_id, user_id, storage_path, moderation_status, sessions!inner(is_public)")
    .eq("id", params.mediaId).eq("session_id", params.id).eq("media_type", "video").is("deleted_at", null).maybeSingle();
  if (mediaError) throw mediaError;
  if (!media) return noStore(NextResponse.json({ error: "Not found" }, { status: 404 }));
  const visible = media.user_id === user?.id || (media.moderation_status === "approved" && media.sessions?.is_public === true);
  if (!visible) return noStore(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  // DB visibility is enforced above with the user-scoped client. Signing must
  // bypass object-owner storage RLS so approved public clips can play for other users.
  const { data, error: signError } = await createServiceRoleClient().storage.from("session-videos").createSignedUrl(media.storage_path, 300);
  if (signError) {
    const storageStatus = String((signError as { statusCode?: unknown }).statusCode ?? "");
    const storageMessage = String((signError as { message?: unknown }).message ?? "").toLowerCase();
    if (storageStatus === "404" || storageMessage.includes("object not found")) {
      return noStore(NextResponse.json({ error: "Not found" }, { status: 404 }));
    }
    throw signError;
  }
  return noStore(NextResponse.json({ url: data.signedUrl, expiresIn: 300 }));
}, { optional: true });
