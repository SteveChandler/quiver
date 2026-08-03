jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockDetect = jest.fn();
const mockVerify = jest.fn();
const mockIdentityRateLimit = jest.fn();

jest.mock("@/lib/auth/apple-orphan-precheck", () => ({
  APPLE_ORPHAN_PRECHECK_VERDICTS: [
    "apple_sub_claimed",
    "unclaimed_no_match",
    "prevent",
    "indeterminate",
  ],
  detectAppleOrphanBeforeSignIn: (...args: unknown[]) => mockDetect(...args),
}));

jest.mock("@/lib/auth/apple-identity-token", () => ({
  AppleIdentityTokenError: class AppleIdentityTokenError extends Error {
    constructor(
      readonly code: "configuration_error" | "invalid_apple_challenge",
      message: string,
    ) {
      super(message);
    }
  },
  verifyAppleIdentityToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock("@/lib/auth/apple-orphan-precheck-rate-limit", () => ({
  checkAppleOrphanPrecheckIdentityRateLimits: (...args: unknown[]) =>
    mockIdentityRateLimit(...args),
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withBotBlockingAndRateLimit:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, context),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/auth/apple-orphan-precheck/route";
import { AppleIdentityTokenError } from "@/lib/auth/apple-identity-token";

const VERIFIED_IDENTITY = {
  appleSub: "stable-apple-sub",
  issuedAt: new Date("2026-08-03T18:00:00.000Z"),
  expiresAt: new Date("2026-08-03T18:10:00.000Z"),
};

function request(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/v1/auth/apple-orphan-precheck",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function validBody(): Record<string, unknown> {
  return {
    identityToken: "fresh-apple-token",
    nativeInstallId: "22222222-2222-4222-8222-222222222222",
    fullName: "Kai Surfer",
  };
}

describe("pre-sign-in Apple orphan precheck route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue(VERIFIED_IDENTITY);
    mockIdentityRateLimit.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it.each([
    ["apple_sub_claimed", 200],
    ["unclaimed_no_match", 200],
    ["prevent", 200],
    ["indeterminate", 503],
  ] as const)("returns only verdict %s with HTTP %s", async (verdict, status) => {
    mockDetect.mockResolvedValue({
      verdict,
      candidateUserId: "11111111-1111-4111-8111-111111111111",
      email: "surfer@example.com",
      displayName: "Kai Surfer",
      productData: { sessions: 12 },
    });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ verdict });
    expect(mockIdentityRateLimit).toHaveBeenCalledWith({
      nativeInstallId: "22222222-2222-4222-8222-222222222222",
      appleSub: "stable-apple-sub",
    });
  });

  it("rejects malformed requests without attempting Apple verification", async () => {
    const response = await POST(request({
      identityToken: "token",
      nativeInstallId: "not-a-uuid",
      fullName: null,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ verdict: "indeterminate" });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_apple_challenge", 400],
    ["configuration_error", 503],
  ] as const)("rejects %s token errors with HTTP %s", async (code, status) => {
    mockVerify.mockRejectedValue(new AppleIdentityTokenError(code, code));

    const response = await POST(request(validBody()));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ verdict: "indeterminate" });
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it("rate-limits the verified Apple sub and native install before database work", async () => {
    mockIdentityRateLimit.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 60,
    });

    const response = await POST(request(validBody()));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ verdict: "indeterminate" });
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it("never returns candidate PII or product data", async () => {
    mockDetect.mockResolvedValue({
      verdict: "prevent",
      candidateUserId: "11111111-1111-4111-8111-111111111111",
      email: "surfer@example.com",
      displayName: "Kai Surfer",
      productData: { sessions: 12 },
    });

    const response = await POST(request(validBody()));
    const payload = await response.json();

    expect(Object.keys(payload)).toEqual(["verdict"]);
    expect(JSON.stringify(payload)).not.toMatch(
      /candidate|user.?id|email|display.?name|session|surfer@example/i,
    );
  });
});
