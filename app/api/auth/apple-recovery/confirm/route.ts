import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withRateLimit,
  type AuthenticatedHandler,
  type RouteHandler,
} from "@/lib/middleware/api-wrappers";
import { confirmAppleRecovery } from "@/lib/auth/apple-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  recoveryId: z.uuid(),
}).strict();
const idempotencySchema = z.string().min(8).max(128);

function jsonNoStore(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const confirmHandler: AuthenticatedHandler = async (
  request,
  { user },
) => {
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  const parsedIdempotency = idempotencySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  if (!parsedBody.success || !parsedIdempotency.success) {
    return jsonNoStore(
      { status: "unavailable", reason: "invalid_request" },
      400,
    );
  }

  const result = await confirmAppleRecovery({
    user,
    recoveryId: parsedBody.data.recoveryId,
    idempotencyKey: parsedIdempotency.data,
  });

  const status =
    result.status === "recent_auth_required"
      ? 428
      : result.status === "support_required"
        ? 409
        : result.status === "unavailable"
          ? 503
          : 200;

  return jsonNoStore(result, status);
};

function withNoStore(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context) => {
    const response = await handler(request, context);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}

export const POST = withNoStore(
  withRateLimit(withAuth(confirmHandler), "account-recovery"),
);
