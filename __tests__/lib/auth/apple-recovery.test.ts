import {
  assessAppleRecovery,
  confirmAppleRecovery,
  type AppleRecoveryDatabase,
} from "@/lib/auth/apple-recovery";
import { RATE_LIMITS } from "@/lib/api/rate-limit-config";

const NOW = new Date("2026-07-25T19:00:00.000Z");
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  last_sign_in_at: "2026-07-25T18:55:00.000Z",
};

function createDatabase(
  assessResult: Record<string, unknown>,
  confirmResult: Record<string, unknown> = {},
): AppleRecoveryDatabase {
  return {
    assess: jest.fn().mockResolvedValue(assessResult),
    confirm: jest.fn().mockResolvedValue(confirmResult),
  };
}

describe("Apple account recovery service", () => {
  beforeEach(() => {
    process.env.APPLE_IDENTITY_RECOVERY_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.APPLE_IDENTITY_RECOVERY_ENABLED;
  });

  it.each([
    ["unclaimed", { status: "unclaimed" }],
    ["already_linked", { status: "already_linked" }],
  ])("maps %s without using email or private-relay data", async (state, expected) => {
    const database = createDatabase({ status: state });
    const verifyToken = jest.fn().mockResolvedValue({
      appleSub: "stable-sub",
      issuedAt: NOW,
    });

    await expect(
      assessAppleRecovery({
        user: USER,
        identityToken: "token-with-private-relay-email",
        idempotencyKey: "assessment-key",
        database,
        verifyToken,
        now: NOW,
      }),
    ).resolves.toEqual(expected);
    expect(database.assess).toHaveBeenCalledWith(
      expect.objectContaining({ appleSub: "stable-sub" }),
    );
  });

  it("returns a confirmation-bound eligibility record for a data-empty secondary", async () => {
    const database = createDatabase({
      status: "eligible",
      recovery_id: "22222222-2222-4222-8222-222222222222",
      expires_at: "2026-07-25T19:10:00.000Z",
      secondary_created_at: "2026-06-01T12:00:00.000Z",
    });

    await expect(
      assessAppleRecovery({
        user: USER,
        identityToken: "token",
        idempotencyKey: "assessment-key",
        database,
        verifyToken: jest.fn().mockResolvedValue({
          appleSub: "stable-sub",
          issuedAt: NOW,
        }),
        now: NOW,
      }),
    ).resolves.toEqual({
      status: "eligible",
      recoveryId: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2026-07-25T19:10:00.000Z",
      canonicalAccount: { label: "Current signed-in account" },
      secondaryAccount: {
        label: "Apple-linked account",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    });
  });

  it("refuses a data-bearing secondary and returns an opaque support reference", async () => {
    const database = createDatabase({
      status: "support_required",
      support_reference: "AR-AB12CD34",
    });

    await expect(
      assessAppleRecovery({
        user: USER,
        identityToken: "token",
        idempotencyKey: "assessment-key",
        database,
        verifyToken: jest.fn().mockResolvedValue({
          appleSub: "stable-sub",
          issuedAt: NOW,
        }),
        now: NOW,
      }),
    ).resolves.toEqual({
      status: "support_required",
      supportReference: "AR-AB12CD34",
    });
  });

  it("requires recent canonical authentication independently of Apple proof", async () => {
    const database = createDatabase({ status: "unclaimed" });

    await expect(
      assessAppleRecovery({
        user: { ...USER, last_sign_in_at: "2026-07-25T18:40:00.000Z" },
        identityToken: "fresh-token",
        idempotencyKey: "assessment-key",
        database,
        verifyToken: jest.fn(),
        now: NOW,
      }),
    ).resolves.toEqual({ status: "recent_auth_required" });
    expect(database.assess).not.toHaveBeenCalled();
  });

  it("fails closed when recovery is disabled", async () => {
    delete process.env.APPLE_IDENTITY_RECOVERY_ENABLED;
    const database = createDatabase({ status: "eligible" });

    await expect(
      assessAppleRecovery({
        user: USER,
        identityToken: "token",
        idempotencyKey: "assessment-key",
        database,
        verifyToken: jest.fn(),
        now: NOW,
      }),
    ).resolves.toEqual({ status: "unavailable", reason: "disabled" });
  });

  it("records explicit confirmation but refuses unsupported auth-schema transfer", async () => {
    const database = createDatabase({}, {
      status: "identity_transfer_not_supported",
      support_reference: "AR-11223344",
    });

    await expect(
      confirmAppleRecovery({
        user: USER,
        recoveryId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "confirmation-key",
        database,
        now: NOW,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      reason: "identity_transfer_not_supported",
      supportReference: "AR-11223344",
    });
    expect(database.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalUserId: USER.id,
        recoveryId: "22222222-2222-4222-8222-222222222222",
      }),
    );
  });

  it("requires recent canonical authentication again at confirmation", async () => {
    const database = createDatabase({}, {
      status: "identity_transfer_not_supported",
      support_reference: "AR-11223344",
    });

    await expect(
      confirmAppleRecovery({
        user: { ...USER, last_sign_in_at: "2026-07-25T18:40:00.000Z" },
        recoveryId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "confirmation-key",
        database,
        now: NOW,
      }),
    ).resolves.toEqual({ status: "recent_auth_required" });
    expect(database.confirm).not.toHaveBeenCalled();
  });

  it("uses a strict recovery-specific rate limit", () => {
    expect(RATE_LIMITS["account-recovery"]).toMatchObject({
      requestsPerMinute: 5,
      requestsPerHour: 12,
      burstLimit: 2,
    });
  });
});
