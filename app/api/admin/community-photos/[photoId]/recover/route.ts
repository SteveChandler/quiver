import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  parseCommunityPhotoMutation,
  recoverCommunityPhoto,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

const idSchema = z.string().uuid();

async function handler(
  request: NextRequest,
  { params, user, supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const input = parseCommunityPhotoMutation(await request.json());
    await recoverCommunityPhoto(supabase, {
      photoId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { photoId, status: "active" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const POST = withCommunityPhotoRouteObservability(
  {
    route: "/api/admin/community-photos/:photoId/recover",
    surface: "admin",
  },
  withAdminAuth(handler),
);
