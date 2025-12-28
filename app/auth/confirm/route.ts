import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type OtpType =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | string;

function defaultNextForType(type: OtpType | null): string {
  if (type === "recovery") return "/auth/reset";
  // For signup/magiclink/invite/email_change, default to app entry so onboarding can run.
  return "/";
}

/**
 * Resolve a safe post-confirmation redirect path.
 * - Allows only relative paths starting with "/"
 * - Prevents open redirects
 */
export function resolveConfirmNext(type: OtpType | null, next: string | null) {
  const fallback = defaultNextForType(type);
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = resolveConfirmNext(type, searchParams.get("next"));

  if (!token_hash || !type) {
    redirect("/error?reason=invalid_or_expired_link");
  }

  const supabase = createSupabaseServerClient();

  try {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (error) {
      console.error("OTP verification failed:", error);
      redirect("/error?reason=invalid_or_expired_link");
    }

    // Success - redirect to next page (usually /auth/reset)
    redirect(next);
  } catch (error) {
    console.error("Error verifying OTP:", error);
    redirect("/error?reason=invalid_or_expired_link");
  }
}
