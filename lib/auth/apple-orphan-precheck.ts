import { createServiceRoleClient } from "@/lib/supabase";
import type { VerifiedAppleIdentity } from "@/lib/auth/apple-identity-token";

export const APPLE_ORPHAN_PRECHECK_VERDICTS = [
  "apple_sub_claimed",
  "unclaimed_no_match",
  "prevent",
  "indeterminate",
] as const;

export type AppleOrphanPrecheckVerdict =
  (typeof APPLE_ORPHAN_PRECHECK_VERDICTS)[number];

interface PrecheckDatabaseInput {
  appleSub: string;
  nativeInstallId: string;
  fullName: string | null;
  tokenIssuedAt: string;
}

export interface AppleOrphanPrecheckDatabase {
  detect(input: PrecheckDatabaseInput): Promise<Record<string, unknown>>;
}

export type AppleOrphanPrecheckResult =
  | { verdict: Exclude<AppleOrphanPrecheckVerdict, "indeterminate"> }
  | {
      verdict: "indeterminate";
      reason:
        | "disabled"
        | "schema_coverage_incomplete"
        | "configuration_error";
    };

function createDatabase(): AppleOrphanPrecheckDatabase {
  const client = createServiceRoleClient();

  return {
    async detect(input: PrecheckDatabaseInput): Promise<Record<string, unknown>> {
      const { data, error } = await client.rpc(
        "detect_apple_orphan_before_sign_in" as never,
        {
          p_apple_sub: input.appleSub,
          p_native_install_id: input.nativeInstallId,
          p_full_name: input.fullName,
          p_token_issued_at: input.tokenIssuedAt,
        } as never,
      );
      if (error) throw new Error(error.message);
      return (data ?? {}) as Record<string, unknown>;
    },
  };
}

export async function detectAppleOrphanBeforeSignIn({
  verifiedIdentity,
  nativeInstallId,
  fullName,
  database,
}: {
  verifiedIdentity: VerifiedAppleIdentity;
  nativeInstallId: string;
  fullName: string | null;
  database?: AppleOrphanPrecheckDatabase;
}): Promise<AppleOrphanPrecheckResult> {
  if (process.env.APPLE_IDENTITY_RECOVERY_ENABLED !== "true") {
    return { verdict: "indeterminate", reason: "disabled" };
  }

  const result = await (database ?? createDatabase()).detect({
    appleSub: verifiedIdentity.appleSub,
    nativeInstallId,
    fullName,
    tokenIssuedAt: verifiedIdentity.issuedAt.toISOString(),
  });

  if (result.status === "apple_sub_claimed") {
    return { verdict: "apple_sub_claimed" };
  }
  if (result.status === "unclaimed_no_match") {
    return { verdict: "unclaimed_no_match" };
  }
  if (result.status === "prevent") return { verdict: "prevent" };
  if (result.status === "schema_coverage_incomplete") {
    return { verdict: "indeterminate", reason: "schema_coverage_incomplete" };
  }
  return { verdict: "indeterminate", reason: "configuration_error" };
}
