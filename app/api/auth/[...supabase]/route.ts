import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";

// GET = fetch current session
export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore,
    headers: headers(),
  });

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
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
      headers: headers(),
    });

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

    // The handler will emit Set-Cookie for you
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
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore,
    headers: headers(),
  });
  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}
