import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET = fetch current session
export async function GET() {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error getting session in API route:", error);
    return NextResponse.json(null);
  }
}

// POST = sign in (and set cookies)
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createSupabaseServerClient();

    // First sign out to ensure clean state
    await supabase.auth.signOut();

    // Now sign in with provided credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Log session info (without sensitive details)
    console.log("API route: Sign-in result:", {
      success: !error,
      hasSession: !!data?.session,
      userId: data?.session?.user?.id,
    });

    return NextResponse.json({ data, error });
  } catch (error) {
    console.error("Exception in sign-in API route:", error);
    return NextResponse.json(
      {
        data: null,
        error: { message: "Internal server error during authentication" },
      },
      { status: 500 }
    );
  }
}

// DELETE = sign out (clears cookies)
export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}
