import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  CommunityPhotoError,
  communityPhotoErrorResponse,
  getCommunityPhotoFeatureFlags,
  listOwnedRemovedCommunityPhotos,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.literal("removed");

async function handler(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    if (!getCommunityPhotoFeatureFlags(user.id).readEnabled) {
      throw new CommunityPhotoError("feature_disabled");
    }
    querySchema.parse(request.nextUrl.searchParams.get("status"));
    const photos = await listOwnedRemovedCommunityPhotos({
      uploaderId: user.id,
    });
    return NextResponse.json(
      { photos },
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

export const GET = withCommunityPhotoRouteObservability(
  {
    route: "/api/community-photos/mine",
    surface: "read",
  },
  withAuth(handler),
);
