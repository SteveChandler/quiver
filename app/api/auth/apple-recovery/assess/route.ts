import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  withRateLimit,
  type AuthenticatedHandler,
  type RouteHandler,
} from "@/lib/middleware/api-wrappers";
import { assessAppleRecovery } from "@/lib/auth/apple-recovery";
import { AppleIdentityTokenError } from "@/lib/auth/apple-identity-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  identityToken: z.string().min(1).max(16_384),
}).strict();
const idempotencySchema = z.string().min(8).max(128);

function jsonNoStore(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const assessHandler: AuthenticatedHandler = async (
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

  let result;
  try {
    result = await assessAppleRecovery({
      user,
      identityToken: parsedBody.data.identityToken,
      idempotencyKey: parsedIdempotency.data,
    });
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) {
      if (error.code === "configuration_error") {
        return jsonNoStore(
          { status: "unavailable", reason: "configuration_error" },
          503,
        );
      }
      return jsonNoStore(
        { status: "unavailable", reason: "invalid_apple_challenge" },
        400,
      );
    }
    throw error;
  }

  const status =
    result.status === "recent_auth_required"
      ? 428
      : result.status === "replayed" ||
          result.status === "support_required"
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
  withRateLimit(withAuth(assessHandler), "account-recovery"),
);
