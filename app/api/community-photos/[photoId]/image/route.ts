import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  CommunityPhotoError,
  communityPhotoErrorResponse,
  downloadCommunityPhoto,
  getCommunityPhotoFeatureFlags,
} from "@/lib/community-photos";
import {
  withAuth,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().uuid();

async function imageHandler(
  _request: NextRequest,
  { params, user }: OptionalAuthContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    if (!getCommunityPhotoFeatureFlags(user?.id ?? null).readEnabled) {
      throw new CommunityPhotoError("feature_disabled");
    }
    const image = await downloadCommunityPhoto({
      photoId,
      viewerId: user?.id ?? null,
    });
    return new NextResponse(image.bytes, {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("photo_not_found") : error,
    );
  }
}

export const GET = withAuth(imageHandler, { optional: true });
