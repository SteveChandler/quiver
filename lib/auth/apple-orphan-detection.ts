import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  verifyAppleIdentityToken,
  type VerifiedAppleIdentity,
} from "@/lib/auth/apple-identity-token";

const RECENT_AUTH_MS = 10 * 60 * 1000;

type DetectionUser = Pick<User, "id" | "last_sign_in_at">;
type VerifyToken = (
  token: string,
  now?: Date,
) => Promise<VerifiedAppleIdentity>;

interface DetectionDatabaseInput {
  currentUserId: string;
  appleSub: string;
  nativeInstallId: string;
  idempotencyKey: string;
}

export interface AppleOrphanDetectionDatabase {
  detect(input: DetectionDatabaseInput): Promise<Record<string, unknown>>;
}

export type AppleOrphanDetectionResult =
  | { status: "flagged" }
  | { status: "no_match" }
  | { status: "recent_auth_required" }
  | {
      status: "unavailable";
      reason:
        | "disabled"
        | "schema_coverage_incomplete"
        | "configuration_error";
    };

function createDatabase(): AppleOrphanDetectionDatabase {
  const client = createServiceRoleClient();

  return {
    async detect(input: DetectionDatabaseInput): Promise<Record<string, unknown>> {
      const { data, error } = await client.rpc(
        "detect_apple_orphan_after_sign_in" as never,
        {
          p_current_user_id: input.currentUserId,
          p_apple_sub: input.appleSub,
          p_native_install_id: input.nativeInstallId,
          p_idempotency_key: input.idempotencyKey,
        } as never,
      );
      if (error) throw new Error(error.message);
      return (data ?? {}) as Record<string, unknown>;
    },
  };
}

function isRecentAuthentication(user: DetectionUser, now: Date): boolean {
  if (!user.last_sign_in_at) return false;
  const ageMs = now.getTime() - new Date(user.last_sign_in_at).getTime();
  return ageMs >= 0 && ageMs <= RECENT_AUTH_MS;
}

export async function detectAppleOrphanAfterSignIn({
  user,
  identityToken,
  nativeInstallId,
  idempotencyKey,
  database,
  verifyToken = verifyAppleIdentityToken,
  now = new Date(),
}: {
  user: DetectionUser;
  identityToken: string;
  nativeInstallId: string;
  idempotencyKey: string;
  database?: AppleOrphanDetectionDatabase;
  verifyToken?: VerifyToken;
  now?: Date;
}): Promise<AppleOrphanDetectionResult> {
  if (process.env.APPLE_IDENTITY_RECOVERY_ENABLED !== "true") {
    return { status: "unavailable", reason: "disabled" };
  }
  if (!isRecentAuthentication(user, now)) {
    return { status: "recent_auth_required" };
  }

  const verified = await verifyToken(identityToken, now);
  const result = await (database ?? createDatabase()).detect({
    currentUserId: user.id,
    appleSub: verified.appleSub,
    nativeInstallId,
    idempotencyKey,
  });

  if (result.status === "flagged") return { status: "flagged" };
  if (result.status === "no_match") return { status: "no_match" };
  if (result.status === "schema_coverage_incomplete") {
    return { status: "unavailable", reason: "schema_coverage_incomplete" };
  }
  return { status: "unavailable", reason: "configuration_error" };
}
