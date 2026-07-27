import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";

import {
  communityPhotoErrorResponse,
  downloadAdminCommunityPhoto,
  withCommunityPhotoRouteObservability,
} from "@/lib/community-photos";
import {
  withAdminAuth,
  type AdminAuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.string().uuid();

async function handler(
  request: NextRequest,
  { params, user }: AdminAuthenticatedContext,
): Promise<NextResponse> {
  try {
    const photoId = idSchema.parse(params.photoId);
    const auditId = idSchema.parse(
      request.nextUrl.searchParams.get("auditId"),
    );
    const image = await downloadAdminCommunityPhoto({
      photoId,
      actorId: user.id,
      auditId,
    });
    return new NextResponse(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return communityPhotoErrorResponse(
      error instanceof z.ZodError ? new Error("invalid_request") : error,
    );
  }
}

export const GET = withCommunityPhotoRouteObservability(
  {
    route: "/api/admin/community-photos/:photoId/image",
    surface: "admin",
    successResultClass: "admin_audited_media_served",
  },
  withAdminAuth(handler),
);
