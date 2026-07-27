import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  CommunityPhotoError,
  communityPhotoErrorResponse,
  getCommunityPhotoFeatureFlags,
  parseCommunityPhotoReport,
  reportCommunityPhoto,
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

async function reportHandler(
  request: NextRequest,
  { params, user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    if (!getCommunityPhotoFeatureFlags(user.id).writeEnabled) {
      throw new CommunityPhotoError("feature_disabled");
    }
    const photoId = idSchema.parse(params.photoId);
    const input = parseCommunityPhotoReport(await request.json());
    const result = await reportCommunityPhoto({
      photoId,
      reporterId: user.id,
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

export const POST = withCommunityPhotoRouteObservability(
  {
    route: "/api/community-photos/:photoId/report",
    surface: "write",
  },
  withRateLimit(withAuth(reportHandler), "authenticated-default"),
);
