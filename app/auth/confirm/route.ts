import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveConfirmNext } from "@/lib/auth/confirm-utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Try URL param first, then fall back to cookie set during signup
  let nextParam = searchParams.get("next");
  if (!nextParam) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get("auth_return_to")?.value;
    if (cookieValue) {
      nextParam = decodeURIComponent(cookieValue);
    }
  }

  const next = resolveConfirmNext(type, nextParam);

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

    // Success — redirect to destination and clear the fallback cookie
    const redirectUrl = new URL(next, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("auth_return_to");
    return response;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    redirect("/error?reason=invalid_or_expired_link");
  }
}
