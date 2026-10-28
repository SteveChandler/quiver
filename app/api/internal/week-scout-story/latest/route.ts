import { NextResponse, type NextRequest } from "next/server";
import { withStoryPublisher } from "@/lib/middleware/api-wrappers/story-publisher-wrapper";
import { loadLatestStoryEdition, StoryStoreError } from "@/lib/services/discovery/week-scout-story-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withStoryPublisher(async (request: NextRequest) => {
  const region = new URL(request.url).searchParams.get("region")?.trim() ?? "";
  if (!region || region.length > 120 || /[\u0000-\u001f\u007f]/.test(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  try {
    const edition = await loadLatestStoryEdition(createSupabaseServiceRoleClient(), region);
    return edition ? NextResponse.json(edition) : NextResponse.json({ error: "no_edition" }, { status: 404 });
  } catch (error) {
    if (error instanceof StoryStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
});
