import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getSwellBriefingPilotUserId,
  getSwellBriefingPublisherToken,
  getSwellBriefingRegion,
  isSwellBriefingEnabled,
} from "@/lib/flags/swell-briefing";
import { NO_STORE_CACHE_CONTROL } from "./cache-wrappers";
import type { RouteContext, RouteHandler } from "./types";

export interface BriefingPublisherContext {
  /** The one account this credential may act for. */
  userId: string;
  region: string;
}

export type BriefingPublisherHandler = (
  request: NextRequest,
  context: BriefingPublisherContext,
) => Promise<NextResponse> | NextResponse;

function deny(status: number, error: string): NextResponse {
  // Diagnostic codes only: the worker logs these, and a precise reason would
  // tell an unauthenticated caller which part of the configuration to probe.
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": NO_STORE_CACHE_CONTROL } },
  );
}

/** Constant-time compare that does not leak length through an early return. */
function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still burn a comparison so a wrong length is not measurably faster.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

/**
 * Authenticates the local briefing worker.
 *
 * This is deliberately not `withBearerAuth`, which accepts the Supabase
 * service-role key or an admin session. The worker holds neither: its
 * credential is scoped to one account and the three briefing routes, so a
 * leaked token cannot read or write anything else.
 *
 * Every request rereads the `SWELL_BRIEFING_*` configuration rather than
 * trusting the token alone, so turning the briefing off or clearing the pilot
 * stops publication. It is deliberately independent of `SWELL_OUTLOOK_*`: the
 * Outlook screen is being retired while Week Scout notes keep publishing.
 */
export function withBriefingPublisher(handler: BriefingPublisherHandler): RouteHandler {
  return async (request: NextRequest, _context?: RouteContext) => {
    const expected = getSwellBriefingPublisherToken();
    const userId = getSwellBriefingPilotUserId();

    // An unconfigured deployment must look exactly like a wrong credential.
    if (!isSwellBriefingEnabled() || expected === null || userId === null) {
      return deny(404, "not_found");
    }

    const presented = bearerToken(request);
    if (presented === null || !tokenMatches(presented, expected)) {
      return deny(401, "unauthorized");
    }

    try {
      const response = await handler(request, { userId, region: getSwellBriefingRegion() });
      response.headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
      return response;
    } catch (error) {
      const code = error instanceof Error ? error.message : "error";
      return deny(500, code.startsWith("briefing_") ? code : "internal_error");
    }
  };
}
