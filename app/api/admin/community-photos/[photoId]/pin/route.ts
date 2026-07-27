import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  parseCommunityPhotoMutation,
  pinCommunityPhoto,
  unpinCommunityPhoto,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

const idSchema = z.string().uuid();
const pinSchema = z
  .object({
    targetType: z.enum(["beach", "custom_spot"]),
    targetId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

async function postHandler(
  request: NextRequest,
  { params, user, supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const input = pinSchema.parse(await request.json());
    await pinCommunityPhoto(supabase, {
      photoId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { photoId, isPinned: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

async function deleteHandler(
  request: NextRequest,
  { params, user, supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const input = parseCommunityPhotoMutation(await request.json());
    await unpinCommunityPhoto(supabase, {
      photoId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { photoId, isPinned: false },
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
    route: "/api/admin/community-photos/:photoId/pin",
    surface: "admin",
  },
  withAdminAuth(postHandler),
);
export const DELETE = withCommunityPhotoRouteObservability(
  {
    route: "/api/admin/community-photos/:photoId/pin",
    surface: "admin",
  },
  withAdminAuth(deleteHandler),
);
