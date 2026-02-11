import { NextResponse, NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

// GET = fetch current session
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error getting user in API route:", error);
      return NextResponse.json(null);
    }

    // Do not return raw session objects (tokens/user payload can be sensitive and/or unverified).
    return NextResponse.json(
      user
        ? {
            id: user.id,
            email: user.email,
          }
        : null
    );
  } catch (error) {
    console.error("Error getting user in API route:", error);
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
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set({ name, value, ...options })
            );
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();
  return new Response(null, { status: 204 });
}
