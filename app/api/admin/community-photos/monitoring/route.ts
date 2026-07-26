import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import { communityPhotoErrorResponse } from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const sinceSchema = z.string().datetime({ offset: true }).nullable();

async function handler(
  request: NextRequest,
  { supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const since = sinceSchema.parse(request.nextUrl.searchParams.get("since"));
    const { data, error } = await supabase.rpc(
      "get_community_photo_monitoring_v1" as never,
      { p_since: since ?? new Date(Date.now() - 86_400_000).toISOString() } as never,
    );
    if (error) throw new Error("database_failed");
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const GET = withAdminAuth(handler);
