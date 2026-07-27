import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  CommunityPhotoError,
  communityPhotoErrorResponse,
  getCommunityPhotoFeatureFlags,
  parseCommunityPhotoVote,
  voteCommunityPhoto,
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

async function voteHandler(
  request: NextRequest,
  { params, user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    if (!getCommunityPhotoFeatureFlags(user.id).writeEnabled) {
      throw new CommunityPhotoError("feature_disabled");
    }
    const photoId = idSchema.parse(params.photoId);
    const input = parseCommunityPhotoVote(await request.json());
    const result = await voteCommunityPhoto({
      photoId,
      voterId: user.id,
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

export const PUT = withCommunityPhotoRouteObservability(
  {
    route: "/api/community-photos/:photoId/vote",
    surface: "write",
  },
  withRateLimit(withAuth(voteHandler), "authenticated-default"),
);
