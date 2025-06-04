export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error checking session:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      hasSession: !!data.session,
      sessionData: data.session
        ? {
            userId: data.session.user?.id,
            email: data.session.user?.email,
            // Don't include sensitive data
          }
        : null,
    });
  } catch (error) {
    console.error("Unexpected error checking session:", error);
    return NextResponse.json(
      { error: "Failed to check session" },
      { status: 500 }
    );
  }
}
