import { createHash } from "node:crypto";
import { RATE_LIMITS } from "@/lib/api/rate-limit-config";
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";

const limiter = getCachedRateLimiter(
  "apple-orphan-precheck-identity",
  RATE_LIMITS["account-recovery"],
);

export interface AppleOrphanPrecheckRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function hashIdentifier(kind: "install" | "sub", value: string): string {
  return `${kind}:${createHash("sha256").update(value).digest("hex")}`;
}

export function checkAppleOrphanPrecheckIdentityRateLimits({
  nativeInstallId,
  appleSub,
}: {
  nativeInstallId: string;
  appleSub: string;
}): AppleOrphanPrecheckRateLimitResult {
  const identifiers = [
    hashIdentifier("install", nativeInstallId),
    hashIdentifier("sub", appleSub),
  ];
  const blockedIdentifier = identifiers.find(
    (identifier) => !limiter.canMakeRequest(identifier),
  );

  if (blockedIdentifier) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        limiter.getRetryAfter(blockedIdentifier),
      ),
    };
  }

  for (const identifier of identifiers) {
    limiter.recordRequest(identifier, "/api/v1/auth/apple-orphan-precheck");
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
