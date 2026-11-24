import { NextResponse, type NextRequest } from "next/server";
import { withStoryPublisher } from "@/lib/middleware/api-wrappers/story-publisher-wrapper";
import { buildStoryInput, StoryInputError } from "@/lib/services/discovery/week-scout-story-source";
import { StoryStoreError } from "@/lib/services/discovery/week-scout-story-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handleGet = withStoryPublisher(async (request: NextRequest) => {
  const params = new URL(request.url).searchParams;
  const region = params.get("region")?.trim() ?? "";
  if (!region || region.length > 120 || /[\u0000-\u001f\u007f]/.test(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  // Without `capabilities=hedge` the input is today's: the installed worker refuses an unknown candidate key.
  // A comma-separated list; unknown values are ignored.
  const hedge = (params.get("capabilities") ?? "").split(",").some((name) => name.trim() === "hedge");
  try {
    return NextResponse.json(await buildStoryInput({ client: createSupabaseServiceRoleClient(), region, now: new Date(),
      ...(hedge ? { capabilities: { hedge: true } } : {}) }));
  } catch (error) {
    if (error instanceof StoryInputError || error instanceof StoryStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
});

export const GET = withErrorNoStore(handleGet, "/api/internal/week-scout-story/input");
