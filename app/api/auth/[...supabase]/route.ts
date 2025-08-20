import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

// GET = fetch current session
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          cookieStore.delete(name);
        },
      },
    }
  );

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
export async function POST(request: NextRequest) {
  try {
    // Get request data
    const { email, password } = await request.json();

    // Create a response to modify
    const response = NextResponse.json({ success: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value;
          },
          set(name, value, options) {
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name, options) {
            response.cookies.delete({
              name,
            });
          },
        },
      }
    );

    // Perform sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Sign-in error:", error);
      return NextResponse.json({ error }, { status: 400 });
    }

    // Log session info (without sensitive details)
    console.log("Sign-in successful for user:", data?.session?.user?.id);

    // Return the response with cookies set by the createServerClient
    return response;
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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          cookieStore.delete(name);
        },
      },
    }
  );

  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}
