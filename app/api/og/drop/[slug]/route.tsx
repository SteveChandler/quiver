import type { NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { isValidSurfDropSlug } from "@/lib/surf-drops/go-page-action";
import {
  renderFallbackSurfDropOgImage,
  renderSurfDropOgImage,
} from "@/app/api/og/drop/og-card";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ slug: string }> | { slug: string };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;
    if (!isValidSurfDropSlug(slug)) {
      return renderFallbackSurfDropOgImage();
    }

    const repository = createSurfDropsRepository(createSupabaseServiceRoleClient());
    const drop = await repository.findDropByShareSlug(slug);
    return renderSurfDropOgImage(drop);
  } catch {
    return renderFallbackSurfDropOgImage();
  }
}
