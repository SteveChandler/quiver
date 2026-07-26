import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  moderateCommunityPhoto,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

const idSchema = z.string().uuid();
const bodySchema = z
  .object({
    action: z.enum(["hide", "restore"]),
    reason: z.string().trim().min(1).max(280),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

async function handler(
  request: NextRequest,
  { params, user, supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const input = bodySchema.parse(await request.json());
    const status = await moderateCommunityPhoto(supabase, {
      photoId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { photoId, status },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const POST = withAdminAuth(handler);
