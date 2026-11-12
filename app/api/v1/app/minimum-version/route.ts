import { NextResponse, type NextRequest } from "next/server";

import { withRateLimit } from "@/lib/middleware/api-wrappers";
import {
  parseNativePlatform,
  resolveNativeMinimumVersion,
} from "@/lib/native/minimum-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";

/**
 * GET /api/v1/app/minimum-version?platform=ios|android
 *
 * The oldest store version and OTA bundle the native app may run. Values come
 * from NATIVE_MIN_* env vars; unset or invalid = null = no forced update.
 */
async function getMinimumVersion(request: NextRequest): Promise<NextResponse> {
  const platform = parseNativePlatform(request.nextUrl.searchParams.get("platform"));
  if (platform === null) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  return NextResponse.json(resolveNativeMinimumVersion(platform), {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

export const GET = withRateLimit(
  getMinimumVersion as (request: NextRequest) => Promise<NextResponse>,
  "public-default",
);
