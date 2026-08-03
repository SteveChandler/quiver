import {
  detectAppleOrphanAfterSignIn,
  type AppleOrphanDetectionDatabase,
} from "@/lib/auth/apple-orphan-detection";

const NOW = new Date("2026-08-02T19:00:00.000Z");
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  last_sign_in_at: "2026-08-02T18:55:00.000Z",
};

function createDatabase(
  result: Record<string, unknown>,
): AppleOrphanDetectionDatabase {
  return { detect: jest.fn().mockResolvedValue(result) };
}

describe("post-sign-in Apple orphan detection service", () => {
  beforeEach(() => {
    process.env.APPLE_IDENTITY_RECOVERY_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.APPLE_IDENTITY_RECOVERY_ENABLED;
  });

  it("flags only the database-confirmed strong-evidence pair", async () => {
    const database = createDatabase({ status: "flagged" });
    const verifyToken = jest.fn().mockResolvedValue({
      appleSub: "stable-apple-sub",
      issuedAt: NOW,
    });

    await expect(
      detectAppleOrphanAfterSignIn({
        user: USER,
        identityToken: "fresh-apple-token",
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "detection-key",
        database,
        verifyToken,
        now: NOW,
      }),
    ).resolves.toEqual({ status: "flagged" });
    expect(database.detect).toHaveBeenCalledWith({
      currentUserId: USER.id,
      appleSub: "stable-apple-sub",
      nativeInstallId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "detection-key",
    });
  });

  it.each([
    [{ status: "no_match" }, { status: "no_match" }],
    [
      { status: "schema_coverage_incomplete" },
      { status: "unavailable", reason: "schema_coverage_incomplete" },
    ],
    [
      { status: "unexpected" },
      { status: "unavailable", reason: "configuration_error" },
    ],
  ])("maps database result %j without guessing", async (databaseResult, expected) => {
    await expect(
      detectAppleOrphanAfterSignIn({
        user: USER,
        identityToken: "fresh-apple-token",
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "detection-key",
        database: createDatabase(databaseResult),
        verifyToken: jest.fn().mockResolvedValue({
          appleSub: "stable-apple-sub",
          issuedAt: NOW,
        }),
        now: NOW,
      }),
    ).resolves.toEqual(expected);
  });

  it("does no token or database work when disabled", async () => {
    delete process.env.APPLE_IDENTITY_RECOVERY_ENABLED;
    const database = createDatabase({ status: "flagged" });
    const verifyToken = jest.fn();

    await expect(
      detectAppleOrphanAfterSignIn({
        user: USER,
        identityToken: "fresh-apple-token",
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "detection-key",
        database,
        verifyToken,
        now: NOW,
      }),
    ).resolves.toEqual({ status: "unavailable", reason: "disabled" });
    expect(verifyToken).not.toHaveBeenCalled();
    expect(database.detect).not.toHaveBeenCalled();
  });

  it("requires recent authentication before checking a pair", async () => {
    const database = createDatabase({ status: "flagged" });

    await expect(
      detectAppleOrphanAfterSignIn({
        user: { ...USER, last_sign_in_at: "2026-08-02T18:40:00.000Z" },
        identityToken: "fresh-apple-token",
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "detection-key",
        database,
        verifyToken: jest.fn(),
        now: NOW,
      }),
    ).resolves.toEqual({ status: "recent_auth_required" });
    expect(database.detect).not.toHaveBeenCalled();
  });
});
