import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);
const FRESH_CHALLENGE_MS = 5 * 60 * 1000;

export interface VerifiedAppleIdentity {
  appleSub: string;
  issuedAt: Date;
  expiresAt: Date;
}

export type AppleIdentityTokenErrorCode =
  | "configuration_error"
  | "invalid_apple_challenge";

export class AppleIdentityTokenError extends Error {
  readonly code: AppleIdentityTokenErrorCode;

  constructor(code: AppleIdentityTokenErrorCode, message: string) {
    super(message);
    this.name = "AppleIdentityTokenError";
    this.code = code;
  }
}

function getAppleAudiences(): string[] {
  const configured = [
    ...(process.env.APPLE_RECOVERY_AUDIENCES ?? "").split(","),
    process.env.APPLE_APP_BUNDLE_ID,
    process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(configured)];
}

export async function verifyAppleIdentityToken(
  identityToken: string,
  now: Date = new Date(),
): Promise<VerifiedAppleIdentity> {
  const audiences = getAppleAudiences();
  if (audiences.length === 0) {
    throw new AppleIdentityTokenError(
      "configuration_error",
      "Apple recovery audience is not configured",
    );
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: audiences,
      currentDate: now,
    }));
  } catch {
    throw new AppleIdentityTokenError(
      "invalid_apple_challenge",
      "Apple identity token is invalid",
    );
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new AppleIdentityTokenError(
      "invalid_apple_challenge",
      "Apple identity token is missing a stable subject",
    );
  }
  if (typeof payload.iat !== "number") {
    throw new AppleIdentityTokenError(
      "invalid_apple_challenge",
      "Apple identity token is missing its issue time",
    );
  }
  if (typeof payload.exp !== "number") {
    throw new AppleIdentityTokenError(
      "invalid_apple_challenge",
      "Apple identity token is missing its expiry time",
    );
  }

  const issuedAt = new Date(payload.iat * 1000);
  const expiresAt = new Date(payload.exp * 1000);
  const ageMs = now.getTime() - issuedAt.getTime();
  if (ageMs < -30_000 || ageMs > FRESH_CHALLENGE_MS) {
    throw new AppleIdentityTokenError(
      "invalid_apple_challenge",
      "Apple challenge is no longer fresh",
    );
  }
  if (expiresAt.getTime() <= now.getTime()) {
    throw new AppleIdentityTokenError(
      "invalid_apple_challenge",
      "Apple identity token has expired",
    );
  }

  return {
    appleSub: payload.sub,
    issuedAt,
    expiresAt,
  };
}
