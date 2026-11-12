import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  listOwnedRemovedCommunityPhotos,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.literal("removed");

async function handler(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
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

const handleGet = withCommunityPhotoRouteObservability(
  {
    route: "/api/community-photos/mine",
    surface: "read",
  },
  withAuth(handler),
);

export const GET = withErrorNoStore(handleGet);
