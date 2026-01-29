import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveConfirmNext } from "@/lib/auth/confirm-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = resolveConfirmNext(type, searchParams.get("next"));

  if (!token_hash || !type) {
    redirect("/error?reason=invalid_or_expired_link");
  }

  const supabase = await createSupabaseServerClient();

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
