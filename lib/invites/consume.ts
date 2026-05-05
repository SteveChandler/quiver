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

const UNIQUE_VIOLATION = "23505";

type InviteInsertError = {
  code?: string;
  message?: string;
};

export type InviteConsumeResult =
  | { status: "accepted"; inviterId: string }
  | { status: "self"; inviterId: string }
  | { status: "invalid" }
  | { status: "insert_error"; inviterId: string; error: InviteInsertError };

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

  const { error } = await supabase
    .from("user_follows")
    .insert({ follower_id: followerId, following_id: inviterId });

  if (error && error.code !== UNIQUE_VIOLATION) {
    return { status: "insert_error", inviterId, error };
  }

  return { status: "accepted", inviterId };
}
