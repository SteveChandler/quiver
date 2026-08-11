import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  iosAppStoreUrlWithCampaign,
  resolveIosAppStoreCampaign,
} from "@/lib/constants/app-store";

export function GET(request: NextRequest): NextResponse {
  const campaign = resolveIosAppStoreCampaign({
    campaign: request.nextUrl.searchParams.get("ct") ?? undefined,
  });
  const destination = iosAppStoreUrlWithCampaign(
    campaign,
    process.env.IOS_APP_STORE_PROVIDER_TOKEN,
  );

  return NextResponse.redirect(destination, 307);
}
