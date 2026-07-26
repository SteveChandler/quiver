import { createHash } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  verifyAppleIdentityToken,
  type VerifiedAppleIdentity,
} from "@/lib/auth/apple-identity-token";

const RECENT_AUTH_MS = 10 * 60 * 1000;

type RecoveryUser = Pick<User, "id" | "last_sign_in_at">;

interface AssessDatabaseInput {
  canonicalUserId: string;
  appleSub: string;
  appleTokenSha256: string;
  idempotencyKey: string;
}

interface ConfirmDatabaseInput {
  canonicalUserId: string;
  recoveryId: string;
  idempotencyKey: string;
}

type DatabaseResult = Record<string, unknown>;

export interface AppleRecoveryDatabase {
  assess(input: AssessDatabaseInput): Promise<DatabaseResult>;
  confirm(input: ConfirmDatabaseInput): Promise<DatabaseResult>;
}

export type AppleRecoveryAssessment =
  | { status: "unclaimed" }
  | { status: "already_linked" }
  | { status: "recent_auth_required" }
  | {
      status: "eligible";
      recoveryId: string;
      expiresAt: string;
      canonicalAccount: { label: string };
      secondaryAccount: { label: string; createdAt: string };
    }
  | { status: "support_required"; supportReference: string }
  | { status: "replayed" }
  | {
      status: "unavailable";
      reason:
        | "disabled"
        | "schema_coverage_incomplete"
        | "configuration_error";
    };

export type AppleRecoveryConfirmation =
  | { status: "already_recovered"; rollbackUntil: string }
  | { status: "recent_auth_required" }
  | { status: "support_required"; supportReference: string }
  | {
      status: "unavailable";
      reason:
        | "disabled"
        | "expired"
        | "identity_transfer_not_supported"
        | "configuration_error";
      supportReference?: string;
    };

type VerifyToken = (
  token: string,
  now?: Date,
) => Promise<VerifiedAppleIdentity>;

function isRecentAuthentication(user: RecoveryUser, now: Date): boolean {
  if (!user.last_sign_in_at) return false;
  const signedInAt = new Date(user.last_sign_in_at).getTime();
  const ageMs = now.getTime() - signedInAt;
  return ageMs >= 0 && ageMs <= RECENT_AUTH_MS;
}

function isRecoveryEnabled(): boolean {
  return process.env.APPLE_IDENTITY_RECOVERY_ENABLED === "true";
}

function requireString(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Apple recovery database omitted ${label}`);
  }
  return value;
}

function createDatabase(): AppleRecoveryDatabase {
  const client = createServiceRoleClient();

  return {
    async assess(input: AssessDatabaseInput): Promise<DatabaseResult> {
      const { data, error } = await client.rpc(
        "assess_apple_identity_recovery" as never,
        {
          p_canonical_user_id: input.canonicalUserId,
          p_apple_sub: input.appleSub,
          p_apple_token_sha256: input.appleTokenSha256,
          p_idempotency_key: input.idempotencyKey,
        } as never,
      );
      if (error) throw new Error(error.message);
      return (data ?? {}) as DatabaseResult;
    },
    async confirm(input: ConfirmDatabaseInput): Promise<DatabaseResult> {
      const { data, error } = await client.rpc(
        "confirm_apple_identity_recovery" as never,
        {
          p_canonical_user_id: input.canonicalUserId,
          p_recovery_id: input.recoveryId,
          p_idempotency_key: input.idempotencyKey,
        } as never,
      );
      if (error) throw new Error(error.message);
      return (data ?? {}) as DatabaseResult;
    },
  };
}

export async function assessAppleRecovery({
  user,
  identityToken,
  idempotencyKey,
  database,
  verifyToken = verifyAppleIdentityToken,
  now = new Date(),
}: {
  user: RecoveryUser;
  identityToken: string;
  idempotencyKey: string;
  database?: AppleRecoveryDatabase;
  verifyToken?: VerifyToken;
  now?: Date;
}): Promise<AppleRecoveryAssessment> {
  if (!isRecoveryEnabled()) {
    return { status: "unavailable", reason: "disabled" };
  }
  if (!isRecentAuthentication(user, now)) {
    return { status: "recent_auth_required" };
  }

  const resolvedDatabase = database ?? createDatabase();
  const verified = await verifyToken(identityToken, now);
  const result = await resolvedDatabase.assess({
    canonicalUserId: user.id,
    appleSub: verified.appleSub,
    appleTokenSha256: createHash("sha256")
      .update(identityToken)
      .digest("hex"),
    idempotencyKey,
  });

  switch (result.status) {
    case "unclaimed":
      return { status: "unclaimed" };
    case "already_linked":
      return { status: "already_linked" };
    case "replayed":
      return { status: "replayed" };
    case "schema_coverage_incomplete":
      return { status: "unavailable", reason: "schema_coverage_incomplete" };
    case "support_required":
      return {
        status: "support_required",
        supportReference: requireString(
          result.support_reference,
          "support reference",
        ),
      };
    case "eligible":
      return {
        status: "eligible",
        recoveryId: requireString(result.recovery_id, "recovery id"),
        expiresAt: requireString(result.expires_at, "expiry"),
        canonicalAccount: { label: "Current signed-in account" },
        secondaryAccount: {
          label: "Apple-linked account",
          createdAt: requireString(
            result.secondary_created_at,
            "secondary creation time",
          ),
        },
      };
    default:
      return { status: "unavailable", reason: "configuration_error" };
  }
}

export async function confirmAppleRecovery({
  user,
  recoveryId,
  idempotencyKey,
  database,
  now = new Date(),
}: {
  user: RecoveryUser;
  recoveryId: string;
  idempotencyKey: string;
  database?: AppleRecoveryDatabase;
  now?: Date;
}): Promise<AppleRecoveryConfirmation> {
  if (!isRecoveryEnabled()) {
    return { status: "unavailable", reason: "disabled" };
  }
  if (!isRecentAuthentication(user, now)) {
    return { status: "recent_auth_required" };
  }

  const resolvedDatabase = database ?? createDatabase();
  const result = await resolvedDatabase.confirm({
    canonicalUserId: user.id,
    recoveryId,
    idempotencyKey,
  });

  switch (result.status) {
    case "already_recovered":
      return {
        status: "already_recovered",
        rollbackUntil: requireString(result.rollback_until, "rollback deadline"),
      };
    case "support_required":
      return {
        status: "support_required",
        supportReference: requireString(
          result.support_reference,
          "support reference",
        ),
      };
    case "expired":
      return { status: "unavailable", reason: "expired" };
    case "identity_transfer_not_supported":
      return {
        status: "unavailable",
        reason: "identity_transfer_not_supported",
        supportReference: requireString(
          result.support_reference,
          "support reference",
        ),
      };
    default:
      return { status: "unavailable", reason: "configuration_error" };
  }
}
