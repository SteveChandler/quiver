import type { NextRequest, NextResponse } from "next/server";
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  withBotBlockingAndRateLimit,
  type OptionalAuthContext,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import {
  buildSurfDropTeaserPayload,
  viewerCanAccessDrop,
} from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

const SHARE_SLUG_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/;

async function goHandler(
  _request: NextRequest,
  { user, params }: OptionalAuthContext,
): Promise<NextResponse> {
  const shareSlug = params.shareSlug;
  if (!SHARE_SLUG_REGEX.test(shareSlug)) {
    return createValidationError("Invalid share slug");
  }

  const repository = createSurfDropsRepository(createSupabaseServiceRoleClient());
  const drop = await repository.findDropByShareSlug(shareSlug);
  const viewerAuthorized = drop
    ? await viewerCanAccessDrop(repository, drop, user?.id ?? null)
    : false;

  const response = createSuccessResponse(
    buildSurfDropTeaserPayload(drop, {
      viewerAuthorized,
      viewerSignedIn: Boolean(user),
      slug: shareSlug,
    }),
  );
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  return response;
}

export const GET = withBotBlockingAndRateLimit(
  withAuth(goHandler, {
    optional: true,
    errorMessage: "Failed to resolve Surf Drop link",
  }),
  { key: "public-default" },
);
