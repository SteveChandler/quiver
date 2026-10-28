import { NextResponse, type NextRequest } from "next/server";
import { withStoryPublisher } from "@/lib/middleware/api-wrappers/story-publisher-wrapper";
import { buildStoryInput, StoryInputError } from "@/lib/services/discovery/week-scout-story-source";
import { StoryStoreError } from "@/lib/services/discovery/week-scout-story-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withStoryPublisher(async (request: NextRequest) => {
  const region = new URL(request.url).searchParams.get("region")?.trim() ?? "";
  if (!region || region.length > 120 || /[\u0000-\u001f\u007f]/.test(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  try {
    return NextResponse.json(await buildStoryInput({ client: createSupabaseServiceRoleClient(), region, now: new Date() }));
  } catch (error) {
    if (error instanceof StoryInputError || error instanceof StoryStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});
