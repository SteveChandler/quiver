import { NextResponse, type NextRequest } from "next/server";

import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";
import {
  parseNativePlatform,
  readNativeMinimumVersion,
  type NativeMinimumReadOutcome,
} from "@/lib/native/minimum-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";
// A null that comes from a failed read must not stay in the CDN after the read recovers.
const NO_STORE = "no-store";

function cacheControlFor(outcome: NativeMinimumReadOutcome): string {
  return outcome === "found" || outcome === "missing" ? CACHE_CONTROL : NO_STORE;
}

/**
 * GET /api/v1/app/minimum-version?platform=ios|android
 *
 * The oldest store version and OTA bundle the native app may run. Values come
 * from the public.native_app_minimums row for the platform; a null, a missing
 * row, an invalid value or a failed read = null = no forced update.
 */
async function getMinimumVersion(request: NextRequest): Promise<NextResponse> {
  const platform = parseNativePlatform(request.nextUrl.searchParams.get("platform"));
  if (platform === null) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const { result, outcome } = await readNativeMinimumVersion(platform);
  return NextResponse.json(result, {
    headers: { "Cache-Control": cacheControlFor(outcome) },
  });
}

const handleGet = withRateLimit(
  getMinimumVersion as (request: NextRequest) => Promise<NextResponse>,
  "public-default",
);

export const GET = withErrorNoStore(handleGet, "/api/v1/app/minimum-version");
