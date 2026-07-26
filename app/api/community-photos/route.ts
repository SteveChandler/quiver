import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  getCommunityPhotoFeatureFlags,
  getCanonicalSpotPhotos,
} from "@/lib/community-photos";
import {
  withAuth,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  targetType: z.enum(["beach", "custom_spot"]),
  targetId: z.string().uuid(),
});

async function getHandler(
  request: NextRequest,
  { user }: OptionalAuthContext,
): Promise<NextResponse> {
  try {
    const parsed = querySchema.parse({
      targetType: request.nextUrl.searchParams.get("targetType"),
      targetId: request.nextUrl.searchParams.get("targetId"),
    });
    const photos = await getCanonicalSpotPhotos({
      target: { type: parsed.targetType, id: parsed.targetId },
      viewerId: user?.id ?? null,
    });
    return NextResponse.json(
      { photos, feature: getCommunityPhotoFeatureFlags(user?.id ?? null) },
      {
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const GET = withAuth(getHandler, { optional: true });
