import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildAppHandoffUrl } from "@/lib/constants/app-handoff";
import {
  resolveIosAppStoreCampaign,
} from "@/lib/constants/app-store";

export function GET(request: NextRequest): NextResponse {
  const campaign = resolveIosAppStoreCampaign({
    campaign: request.nextUrl.searchParams.get("ct") ?? undefined,
  });
  const destination = buildAppHandoffUrl({
    source:
      request.nextUrl.searchParams.get("source") ?? "app_store_route",
    surface: request.nextUrl.searchParams.get("surface") ?? "app_store",
    placement:
      request.nextUrl.searchParams.get("placement") ??
      "legacy_app_store_redirect",
    handoff_id: crypto.randomUUID(),
    utm_campaign: campaign,
  });

  return NextResponse.redirect(destination, 307);
}
