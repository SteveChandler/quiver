import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getEmailTokenSecret,
  verifyEmailToken,
} from "@/lib/utils/email-token";

export const INVITE_COOKIE_NAME = "invite_token";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const INVITE_CONSUME_PATH = "/invite/consume";
export const SELF_INVITE_REDIRECT_PATH = "/community?tab=friends";
export const INVITE_EXPIRED_REDIRECT_PATH = "/?invite_expired=1";
export const INVITE_ERROR_REDIRECT_PATH = "/?invite_error=1";

type InviteRpcError = {
  code?: string;
  message?: string;
};

export type InviteAcceptanceFlags = {
  followCreated: boolean;
  followExisting: boolean;
  referralCreated: boolean;
  referralExisting: boolean;
};

export type InviteConsumeResult =
  | ({ status: "accepted"; inviterId: string } & InviteAcceptanceFlags)
  | { status: "self"; inviterId: string }
  | { status: "invalid" }
  | { status: "insert_error"; inviterId: string; error: InviteRpcError };

type AcceptInviteForUserRpcResult = {
  follow_created?: boolean;
  follow_existing?: boolean;
  referral_created?: boolean;
  referral_existing?: boolean;
};

export function buildInviteStartPath(token: string): string {
  const params = new URLSearchParams({ token });
  return `/invite/start?${params.toString()}`;
}

export function buildInviteSignupPath(): string {
  const params = new URLSearchParams({ redirectTo: INVITE_CONSUME_PATH });
  return `/auth/sign-up?${params.toString()}`;
}

export function buildInvitedProfilePath(inviterId: string): string {
  return `/profile/${encodeURIComponent(inviterId)}?invited=1`;
}

export function getInviteCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function getInviteInviterId(
  token: string | null | undefined,
): Promise<string | null> {
  if (!token) return null;

  const payload = await verifyEmailToken(token, getEmailTokenSecret());
  if (!payload || payload.purpose !== "invite") return null;

  return payload.user_id;
}

export async function consumeInviteForUser(
  supabase: SupabaseClient<Database>,
  token: string,
  followerId: string,
): Promise<InviteConsumeResult> {
  const inviterId = await getInviteInviterId(token);
  if (!inviterId) {
    return { status: "invalid" };
  }

  if (inviterId === followerId) {
    return { status: "self", inviterId };
  }

  const { data, error } = await supabase.rpc("accept_invite_for_user" as any, {
    inviter: inviterId,
    invitee: followerId,
  });

  if (error) {
    return { status: "insert_error", inviterId, error };
  }

  const flags = (data ?? {}) as AcceptInviteForUserRpcResult;

  return {
    status: "accepted",
    inviterId,
    followCreated: flags.follow_created === true,
    followExisting: flags.follow_existing === true,
    referralCreated: flags.referral_created === true,
    referralExisting: flags.referral_existing === true,
  };
}
