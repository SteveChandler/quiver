import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAPIServerClient();
    const body = await request.json();
    const { spotId, accurate, reasons, note } = body || {};
    if (!spotId || typeof accurate !== "boolean") {
      return createSuccessResponse({ ok: false });
    }

    const { data: user } = await supabase.auth.getUser();
    const userId = user?.user?.id || null;
    if (!userId) {
      return createSuccessResponse({ ok: false });
    }

    const ins = await supabase.from("spot_feedback").insert({
      user_id: userId,
      spot_id: spotId,
      accurate,
      reasons: Array.isArray(reasons) ? reasons.slice(0, 6) : null,
      note: typeof note === "string" ? note.slice(0, 280) : null,
    });
    if (ins.error) throw ins.error;
    return createSuccessResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}


