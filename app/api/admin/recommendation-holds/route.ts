import { NextRequest, NextResponse } from "next/server";

import { withAdminAuth } from "@/lib/middleware/api-wrappers";
import {
  createSupabaseMajorEventHoldCacheInvalidationStore,
  invalidateMajorEventHoldTransitions,
} from "@/lib/recommendations/major-event-hold/cache-invalidation";
import {
  createSupabaseManualHoldStore,
  executeManualHoldCommand,
  HoldControlError,
  listAdminHoldViews,
  parseManualHoldCommand,
  type ManualHoldCommand,
} from "@/lib/recommendations/major-event-hold/control";
import { deterministicUuidV8 } from "@/lib/recommendations/major-event-hold/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestId(request: NextRequest): string {
  const supplied = request.headers.get("X-Request-ID");
  return supplied && UUID_PATTERN.test(supplied)
    ? supplied.toLowerCase()
    : crypto.randomUUID();
}

function jsonNoStore(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function withNoStore(
  handler: ReturnType<typeof withAdminAuth>,
): ReturnType<typeof withAdminAuth> {
  return async (request, context) => {
    const response = await handler(request, context);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}

interface SafeLogContext {
  holdId: string | null;
  transition:
    | "activation"
    | "extension"
    | "replacement"
    | "cancellation"
    | null;
  reasonCode: string | null;
}

const EMPTY_LOG_CONTEXT: SafeLogContext = {
  holdId: null,
  transition: null,
  reasonCode: null,
};

function safeLogContext(
  command: ManualHoldCommand,
  idempotencyKey: string | null,
): SafeLogContext {
  const transition =
    command.operation === "activate"
      ? "activation"
      : command.operation === "extend"
        ? "extension"
        : command.operation === "replace"
          ? "replacement"
          : "cancellation";
  const holdId =
    command.operation === "activate"
      ? idempotencyKey && UUID_PATTERN.test(idempotencyKey)
        ? deterministicUuidV8(
            `quiver:regional-hold:manual:activation:${idempotencyKey.toLowerCase()}`,
          )
        : null
      : command.holdId;
  return { holdId, transition, reasonCode: command.reasonCode };
}

function errorResponse(
  error: unknown,
  traceId: string,
  context: SafeLogContext = EMPTY_LOG_CONTEXT,
): NextResponse {
  const controlError =
    error instanceof HoldControlError
      ? error
      : new HoldControlError("hold_state_unavailable", 503);
  console.error("recommendation_hold_admin", {
    requestId: traceId,
    holdId: context.holdId,
    transition: context.transition,
    reasonCode: context.reasonCode,
    outcome: controlError.code,
  });
  return jsonNoStore(
    {
      success: false,
      error: { code: controlError.code },
      requestId: traceId,
    },
    { status: controlError.status },
  );
}

export const GET = withNoStore(
  withAdminAuth(
    async (request: NextRequest, { supabase }) => {
      const traceId = requestId(request);
      try {
        const holds = await listAdminHoldViews({
          store: createSupabaseManualHoldStore(supabase),
        });
        return jsonNoStore({
          success: true,
          data: { holds },
          requestId: traceId,
        });
      } catch (error) {
        return errorResponse(error, traceId);
      }
    },
    { errorMessage: "Recommendation hold admin request failed" },
  ),
);

export const POST = withNoStore(
  withAdminAuth(
    async (request: NextRequest, { user, supabase }) => {
      const traceId = requestId(request);
      const idempotencyKey = request.headers.get("Idempotency-Key");
      let logContext = EMPTY_LOG_CONTEXT;
      try {
        const body: unknown = await request.json().catch(() => undefined);
        const command = parseManualHoldCommand(body);
        logContext = safeLogContext(command, idempotencyKey);
        const result = await executeManualHoldCommand(command, {
          store: createSupabaseManualHoldStore(supabase),
          operatorUserId: user.id,
          idempotencyKey,
        });
        try {
          await invalidateMajorEventHoldTransitions([result.confirmedRecord], {
            store: createSupabaseMajorEventHoldCacheInvalidationStore(supabase),
          });
        } catch {
          throw new HoldControlError("cache_invalidation_failed", 503);
        }
        const publicResult = {
          hold: result.hold,
          outcome: result.outcome,
        };
        console.info("recommendation_hold_admin", {
          requestId: traceId,
          holdId: result.hold.holdId,
          transition: result.hold.transition,
          reasonCode: result.hold.reasonCode,
          outcome: result.outcome,
        });
        return jsonNoStore({
          success: true,
          data: publicResult,
          requestId: traceId,
        });
      } catch (error) {
        return errorResponse(error, traceId, logContext);
      }
    },
    { errorMessage: "Recommendation hold admin request failed" },
  ),
);
