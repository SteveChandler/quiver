import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  withBotBlockingAndRateLimit,
  NO_STORE_CACHE_CONTROL,
  type RouteHandler,
} from "@/lib/middleware/api-wrappers";
import {
  APPLE_ORPHAN_PRECHECK_VERDICTS,
  detectAppleOrphanBeforeSignIn,
  type AppleOrphanPrecheckVerdict,
} from "@/lib/auth/apple-orphan-precheck";
import {
  AppleIdentityTokenError,
  verifyAppleIdentityToken,
} from "@/lib/auth/apple-identity-token";
import { checkAppleOrphanPrecheckIdentityRateLimits } from "@/lib/auth/apple-orphan-precheck-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  identityToken: z.string().min(1).max(16_384),
  nativeInstallId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(200).nullable(),
}).strict();

function jsonVerdict(
  verdict: AppleOrphanPrecheckVerdict,
  status: number,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    { verdict },
    {
      status,
      headers: {
        ...Object.fromEntries(new Headers(headers).entries()),
        "Cache-Control": NO_STORE_CACHE_CONTROL,
      },
    },
  );
}

export const precheckHandler: RouteHandler = async (request) => {
  const parsedBody = bodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsedBody.success) return jsonVerdict("indeterminate", 400);

  let verifiedIdentity;
  try {
    verifiedIdentity = await verifyAppleIdentityToken(
      parsedBody.data.identityToken,
    );
  } catch (error) {
    if (error instanceof AppleIdentityTokenError) {
      return jsonVerdict(
        "indeterminate",
        error.code === "configuration_error" ? 503 : 400,
      );
    }
    return jsonVerdict("indeterminate", 503);
  }

  const identityRateLimit = checkAppleOrphanPrecheckIdentityRateLimits({
    nativeInstallId: parsedBody.data.nativeInstallId,
    appleSub: verifiedIdentity.appleSub,
  });
  if (!identityRateLimit.allowed) {
    return jsonVerdict("indeterminate", 429, {
      "Retry-After": identityRateLimit.retryAfterSeconds.toString(),
    });
  }

  try {
    const result = await detectAppleOrphanBeforeSignIn({
      verifiedIdentity,
      nativeInstallId: parsedBody.data.nativeInstallId,
      fullName: parsedBody.data.fullName,
    });
    return jsonVerdict(
      result.verdict,
      result.verdict === "indeterminate" ? 503 : 200,
    );
  } catch {
    return jsonVerdict("indeterminate", 503);
  }
};

function isVerdict(value: unknown): value is AppleOrphanPrecheckVerdict {
  return typeof value === "string" && (
    APPLE_ORPHAN_PRECHECK_VERDICTS as readonly string[]
  ).includes(value);
}

function withVerdictOnly(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context) => {
    let response: NextResponse;
    try {
      response = await handler(request, context);
    } catch {
      return jsonVerdict("indeterminate", 503);
    }
    let verdict: AppleOrphanPrecheckVerdict = "indeterminate";

    try {
      const body = await response.clone().json() as { verdict?: unknown };
      if (isVerdict(body.verdict)) verdict = body.verdict;
    } catch {
      verdict = "indeterminate";
    }

    const headers = new Headers(response.headers);
    headers.delete("Content-Length");
    headers.set("Cache-Control", NO_STORE_CACHE_CONTROL);
    return NextResponse.json({ verdict }, { status: response.status, headers });
  };
}

export const POST = withVerdictOnly(
  withBotBlockingAndRateLimit(precheckHandler, "account-recovery"),
);
