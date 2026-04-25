/**
 * Bot Blocking Middleware
 *
 * Wraps API route handlers to block bot traffic before processing.
 * Uses detection logic from bot-detection.ts
 *
 * Features:
 * - Returns 403 for blocked bots
 * - Logs blocked requests with masked IP (GDPR compliant)
 * - Applies security headers to responses
 */

import { NextRequest, NextResponse } from "next/server";
import { detectBot, BotDetectionResult } from "@/lib/security/bot-detection";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import type { RouteContext } from "@/lib/middleware/api-wrappers/types";

/**
 * Log bot blocking event with privacy-safe IP masking
 *
 * @param detection - Bot detection result
 * @param request - The blocked request
 */
function logBotBlocked(
  detection: BotDetectionResult,
  request: NextRequest
): void {
  const identifier =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Mask IP for privacy (GDPR compliance)
  const maskedIp = identifier.includes(".")
    ? identifier.split(".").slice(0, 3).join(".") + ".x"
    : identifier.substring(0, 8) + "...";

  console.warn("[BOT_BLOCKED]", {
    reason: detection.reason,
    botName: detection.botName,
    path: request.nextUrl.pathname,
    ip: maskedIp,
    userAgent: request.headers.get("user-agent")?.substring(0, 100),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Bot blocking middleware wrapper
 *
 * Wraps an API route handler to block bot traffic before processing.
 * Bot detection is fast (string matching) so minimal performance impact.
 *
 * @param handler - The API route handler to wrap
 * @returns Wrapped handler that blocks bots
 *
 * @example
 * ```typescript
 * import { withBotBlocking } from '@/lib/middleware/bot-blocker';
 *
 * async function myHandler(request: NextRequest) {
 *   // ... handler logic
 * }
 *
 * export const GET = withBotBlocking(myHandler);
 * ```
 */
export function withBotBlocking<T extends NextRequest>(
  handler: (req: T, context?: RouteContext) => Promise<NextResponse>
): (req: T, context?: RouteContext) => Promise<NextResponse> {
  return async (req: T, context?: RouteContext): Promise<NextResponse> => {
    const detection = detectBot(req);

    if (detection.shouldBlock) {
      logBotBlocked(detection, req);

      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          timestamp: new Date().toISOString(),
        },
        {
          status: 403,
          headers: DEFAULT_SECURITY_HEADERS,
        }
      );
    }

    return handler(req, context);
  };
}
