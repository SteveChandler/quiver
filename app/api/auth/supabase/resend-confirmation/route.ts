import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    const supabase = await createSupabaseServerClient();

    // Use the resend confirmation email API
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Confirmation email sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error resending confirmation email:", error);
    return NextResponse.json(
      { error: { message: "Failed to resend confirmation email" } },
      { status: 500 }
    );
  }
}
