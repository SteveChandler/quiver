import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  parseCommunityPhotoMutation,
  removeCommunityPhoto,
} from "@/lib/community-photos";
import {
  withAuth,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().uuid();

async function removeHandler(
  request: NextRequest,
  { params, user }: AuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const input = parseCommunityPhotoMutation(await request.json());
    const result = await removeCommunityPhoto({
      photoId,
      uploaderId: user.id,
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

export const DELETE = withAuth(removeHandler);
