import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  CommunityPhotoError,
  communityPhotoErrorResponse,
  getCommunityPhotoFeatureFlags,
  parseCommunityPhotoMutation,
  recoverOwnedCommunityPhoto,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().uuid();

async function handler(
  request: NextRequest,
  { params, user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    if (!getCommunityPhotoFeatureFlags(user.id).writeEnabled) {
      throw new CommunityPhotoError("feature_disabled");
    }
    const photoId = idSchema.parse(params.photoId);
    const { idempotencyKey } = parseCommunityPhotoMutation(
      await request.json(),
    );
    const result = await recoverOwnedCommunityPhoto({
      photoId,
      uploaderId: user.id,
      idempotencyKey,
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

export const POST = withCommunityPhotoRouteObservability(
  {
    route: "/api/community-photos/:photoId/recover",
    surface: "write",
  },
  withRateLimit(withAuth(handler), "authenticated-default"),
);
