import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  listCommunityPhotosForAdmin,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  status: z.enum(["all", "visible", "hidden", "removed"]).default("all"),
  targetType: z.enum(["beach", "custom_spot"]).nullable(),
  targetId: z.string().uuid().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime({ offset: true }).nullable(),
});

async function listHandler(
  request: NextRequest,
  { supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const params = request.nextUrl.searchParams;
    const input = querySchema.parse({
      status: params.get("status") ?? undefined,
      targetType: params.get("targetType"),
      targetId: params.get("targetId"),
      limit: params.get("limit") ?? undefined,
      before: params.get("cursor"),
    });
    const result = await listCommunityPhotosForAdmin({
      client: supabase,
      ...input,
    });
    return NextResponse.json(result, {
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

export const GET = withAdminAuth(listHandler);
