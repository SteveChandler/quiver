import {
  detectAppleOrphanBeforeSignIn,
  type AppleOrphanPrecheckDatabase,
} from "@/lib/auth/apple-orphan-precheck";

const VERIFIED_IDENTITY = {
  appleSub: "stable-apple-sub",
  issuedAt: new Date("2026-08-03T18:00:00.000Z"),
  expiresAt: new Date("2026-08-03T18:10:00.000Z"),
};

function createDatabase(
  result: Record<string, unknown>,
): AppleOrphanPrecheckDatabase {
  return { detect: jest.fn().mockResolvedValue(result) };
}

describe("pre-sign-in Apple orphan detection service", () => {
  beforeEach(() => {
    process.env.APPLE_IDENTITY_RECOVERY_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.APPLE_IDENTITY_RECOVERY_ENABLED;
  });

  it.each([
    ["apple_sub_claimed", "apple_sub_claimed"],
    ["unclaimed_no_match", "unclaimed_no_match"],
    ["prevent", "prevent"],
  ] as const)("maps database status %s to verdict %s", async (status, verdict) => {
    await expect(
      detectAppleOrphanBeforeSignIn({
        verifiedIdentity: VERIFIED_IDENTITY,
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        fullName: "Kai Surfer",
        database: createDatabase({ status }),
      }),
    ).resolves.toEqual({ verdict });
  });

  it("treats an ambiguous database match as proceed", async () => {
    await expect(
      detectAppleOrphanBeforeSignIn({
        verifiedIdentity: VERIFIED_IDENTITY,
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        fullName: "Kai Surfer",
        database: createDatabase({ status: "unclaimed_no_match" }),
      }),
    ).resolves.toEqual({ verdict: "unclaimed_no_match" });
  });

  it("passes only the verified subject, install, name, and token issue time to the RPC", async () => {
    const database = createDatabase({ status: "prevent" });

    await detectAppleOrphanBeforeSignIn({
      verifiedIdentity: VERIFIED_IDENTITY,
      nativeInstallId: "22222222-2222-4222-8222-222222222222",
      fullName: "Kai Surfer",
      database,
    });

    expect(database.detect).toHaveBeenCalledWith({
      appleSub: "stable-apple-sub",
      nativeInstallId: "22222222-2222-4222-8222-222222222222",
      fullName: "Kai Surfer",
      tokenIssuedAt: "2026-08-03T18:00:00.000Z",
    });
  });

  it.each([
    ["schema_coverage_incomplete", "schema_coverage_incomplete"],
    ["unexpected", "configuration_error"],
  ])("fails open for database status %s", async (status, reason) => {
    await expect(
      detectAppleOrphanBeforeSignIn({
        verifiedIdentity: VERIFIED_IDENTITY,
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        fullName: "Kai Surfer",
        database: createDatabase({ status }),
      }),
    ).resolves.toEqual({ verdict: "indeterminate", reason });
  });

  it("does no database work when the recovery gate is disabled", async () => {
    delete process.env.APPLE_IDENTITY_RECOVERY_ENABLED;
    const database = createDatabase({ status: "prevent" });

    await expect(
      detectAppleOrphanBeforeSignIn({
        verifiedIdentity: VERIFIED_IDENTITY,
        nativeInstallId: "22222222-2222-4222-8222-222222222222",
        fullName: "Kai Surfer",
        database,
      }),
    ).resolves.toEqual({ verdict: "indeterminate", reason: "disabled" });
    expect(database.detect).not.toHaveBeenCalled();
  });
});
