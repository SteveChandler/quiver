import { NextResponse, type NextRequest } from "next/server";
import { withStoryPublisher } from "@/lib/middleware/api-wrappers/story-publisher-wrapper";
import { activeStoryRegions } from "@/lib/services/discovery/week-scout-story-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleGet = withStoryPublisher(async (_request: NextRequest) => {
  const regions = await activeStoryRegions(createSupabaseServiceRoleClient());
  return NextResponse.json({ schemaVersion: 3, regions });
});

export const GET = withErrorNoStore(handleGet, "/api/internal/week-scout-story/regions");
