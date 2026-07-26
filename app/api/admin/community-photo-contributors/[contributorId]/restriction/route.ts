import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  parseCommunityPhotoMutation,
  restrictCommunityPhotoContributor,
  unrestrictCommunityPhotoContributor,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

const idSchema = z.string().uuid();
const restrictionSchema = z
  .object({
    reasonCode: z.string().regex(/^[a-z0-9_]{1,64}$/),
    restrictedUntil: z.string().datetime({ offset: true }).nullable(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

async function postHandler(
  request: NextRequest,
  { params, user, supabase }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const contributorId = idSchema.parse(params.contributorId);
    const input = restrictionSchema.parse(await request.json());
    await restrictCommunityPhotoContributor(supabase, {
      contributorId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      {
        contributorId,
        restricted: true,
        restrictedUntil: input.restrictedUntil,
      },
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
    const contributorId = idSchema.parse(params.contributorId);
    const input = parseCommunityPhotoMutation(await request.json());
    await unrestrictCommunityPhotoContributor(supabase, {
      contributorId,
      actorId: user.id,
      ...input,
    });
    return NextResponse.json(
      { contributorId, restricted: false, restrictedUntil: null },
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
