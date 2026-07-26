jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockAssess = jest.fn();
const mockConfirm = jest.fn();

jest.mock("@/lib/auth/apple-recovery", () => ({
  assessAppleRecovery: (...args: unknown[]) => mockAssess(...args),
  confirmAppleRecovery: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock("@/lib/auth/apple-identity-token", () => ({
  AppleIdentityTokenError: class AppleIdentityTokenError extends Error {},
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
import { POST as assessPOST } from "@/app/api/auth/apple-recovery/assess/route";
import { POST as confirmPOST } from "@/app/api/auth/apple-recovery/confirm/route";
import { AppleIdentityTokenError } from "@/lib/auth/apple-identity-token";

const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  last_sign_in_at: "2026-07-25T18:55:00.000Z",
};
const AUTH_CONTEXT = { user: USER } as never;

function request(path: string, body: unknown, idempotencyKey?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Apple recovery API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("assesses a signed Apple token and always disables caching", async () => {
    mockAssess.mockResolvedValue({
      status: "eligible",
      recoveryId: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2026-07-25T19:10:00.000Z",
      canonicalAccount: { label: "Current signed-in account" },
      secondaryAccount: {
        label: "Apple-linked account",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    });

    const response = await assessPOST(
      request(
        "/api/auth/apple-recovery/assess",
        { identityToken: "signed-token" },
        "assessment-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: "eligible" });
    expect(mockAssess).toHaveBeenCalledWith(
      expect.objectContaining({
        user: USER,
        identityToken: "signed-token",
        idempotencyKey: "assessment-key",
      }),
    );
  });

  it.each([
    [{ status: "recent_auth_required" }, 428],
    [{ status: "replayed" }, 409],
    [{ status: "support_required", supportReference: "AR-12345678" }, 409],
    [{ status: "unavailable", reason: "schema_coverage_incomplete" }, 503],
  ])("maps assessment %j to HTTP %s", async (result, status) => {
    mockAssess.mockResolvedValue(result);
    const response = await assessPOST(
      request(
        "/api/auth/apple-recovery/assess",
        { identityToken: "signed-token" },
        "assessment-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects missing idempotency and malformed token input before service work", async () => {
    const response = await assessPOST(
      request("/api/auth/apple-recovery/assess", { identityToken: "" }),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(mockAssess).not.toHaveBeenCalled();
  });

  it("returns a non-cacheable client error for an invalid Apple challenge", async () => {
    mockAssess.mockRejectedValue(
      new AppleIdentityTokenError("Apple identity token is invalid"),
    );

    const response = await assessPOST(
      request(
        "/api/auth/apple-recovery/assess",
        { identityToken: "invalid-token" },
        "assessment-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "unavailable",
      reason: "invalid_apple_challenge",
    });
  });

  it("records explicit confirmation and exposes the fail-closed transfer blocker", async () => {
    mockConfirm.mockResolvedValue({
      status: "unavailable",
      reason: "identity_transfer_not_supported",
      supportReference: "AR-12345678",
    });

    const response = await confirmPOST(
      request(
        "/api/auth/apple-recovery/confirm",
        { recoveryId: "22222222-2222-4222-8222-222222222222" },
        "confirmation-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "unavailable",
      reason: "identity_transfer_not_supported",
      supportReference: "AR-12345678",
    });
  });

  it("returns idempotent completion when a future supported transfer already completed", async () => {
    mockConfirm.mockResolvedValue({
      status: "already_recovered",
      rollbackUntil: "2026-08-01T19:00:00.000Z",
    });

    const response = await confirmPOST(
      request(
        "/api/auth/apple-recovery/confirm",
        { recoveryId: "22222222-2222-4222-8222-222222222222" },
        "confirmation-key",
      ),
      AUTH_CONTEXT,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "already_recovered",
    });
  });
});
