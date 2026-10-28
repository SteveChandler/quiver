import { NextResponse, type NextRequest } from "next/server";
import { withStoryPublisher } from "@/lib/middleware/api-wrappers/story-publisher-wrapper";
import { activeStoryRegions } from "@/lib/services/discovery/week-scout-story-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withStoryPublisher(async (_request: NextRequest) => {
  const regions = await activeStoryRegions(createSupabaseServiceRoleClient());
  return NextResponse.json({ schemaVersion: 3, regions });
});
