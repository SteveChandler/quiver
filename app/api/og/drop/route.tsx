import type { NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { isValidSurfDropSlug } from "@/lib/surf-drops/go-page-action";
import {
  renderFallbackSurfDropOgImage,
  renderSurfDropOgImage,
} from "@/app/api/og/drop/og-card";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") ?? "";
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
