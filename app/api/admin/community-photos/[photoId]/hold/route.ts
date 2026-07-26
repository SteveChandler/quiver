import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  holdCommunityPhoto,
  parseCommunityPhotoMutation,
  releaseCommunityPhotoHold,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

const idSchema = z.string().uuid();
const holdSchema = z
  .object({
    reason: z.string().trim().min(1).max(280),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

async function postHandler(
  request: NextRequest,
  { params, user, supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const input = holdSchema.parse(await request.json());
    const hold = await holdCommunityPhoto(supabase, {
      photoId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { photoId, hold },
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
    await releaseCommunityPhotoHold(supabase, {
      photoId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { photoId, hold: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const POST = withAdminAuth(postHandler);
export const DELETE = withAdminAuth(deleteHandler);
