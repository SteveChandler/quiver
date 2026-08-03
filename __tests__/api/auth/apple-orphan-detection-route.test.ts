jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockDetect = jest.fn();

jest.mock("@/lib/auth/apple-orphan-detection", () => ({
  detectAppleOrphanAfterSignIn: (...args: unknown[]) => mockDetect(...args),
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
}));

jest.mock("@/lib/middleware/api-wrappers", () => ({
  withAuth:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, context),
  withRateLimit:
    (handler: (...args: unknown[]) => unknown) =>
    (request: unknown, context: unknown) =>
      handler(request, context),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/v1/auth/apple-orphan-detection/route";
import { AppleIdentityTokenError } from "@/lib/auth/apple-identity-token";

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  last_sign_in_at: "2026-08-02T18:55:00.000Z",
};
const AUTH_CONTEXT = { user: USER } as never;

function request(body: unknown, idempotencyKey?: string): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/v1/auth/apple-orphan-detection",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    },
  );
}

describe("post-sign-in Apple orphan detection route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a non-cacheable flag from the additive v1 contract", async () => {
    mockDetect.mockResolvedValue({ status: "flagged" });

    const response = await POST(
      request(
        {
          identityToken: "fresh-apple-token",
          nativeInstallId: "22222222-2222-4222-8222-222222222222",
        },
        "detection-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "flagged" });
    expect(mockDetect).toHaveBeenCalledWith({
      user: USER,
      identityToken: "fresh-apple-token",
      nativeInstallId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "detection-key",
    });
  });

  it.each([
    [{ status: "recent_auth_required" }, 428],
    [{ status: "unavailable", reason: "disabled" }, 503],
    [{ status: "no_match" }, 200],
  ])("maps %j to HTTP %s", async (result, status) => {
    mockDetect.mockResolvedValue(result);
    const response = await POST(
      request(
        {
          identityToken: "fresh-apple-token",
          nativeInstallId: "22222222-2222-4222-8222-222222222222",
        },
        "detection-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects malformed identifiers and missing idempotency", async () => {
    const response = await POST(
      request({ identityToken: "token", nativeInstallId: "not-a-uuid" }),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(mockDetect).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_apple_challenge", 400],
    ["configuration_error", 503],
  ] as const)("maps %s token errors to HTTP %s", async (code, status) => {
    mockDetect.mockRejectedValue(new AppleIdentityTokenError(code, code));
    const response = await POST(
      request(
        {
          identityToken: "fresh-apple-token",
          nativeInstallId: "22222222-2222-4222-8222-222222222222",
        },
        "detection-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ status: "unavailable", reason: code });
  });
});
