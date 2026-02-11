import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // First check if we have a session
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      console.log("No existing session to refresh");
      return NextResponse.json({
        success: false,
        hasSession: false,
        message: "No existing session to refresh",
      });
    }

    // If we have a session, attempt to refresh it
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.error("Error refreshing session in API:", error);
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        );
      }

      // Return success response with limited, verified user data
      // NOTE: Avoid trusting `data.session.user` as it can be sourced from cookie storage.
      let safeUser: { id: string; email?: string | null } | null = null;
      if (data.session) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          safeUser = { id: user.id, email: user.email };
        }
      }

      return NextResponse.json({
        success: true,
        hasSession: !!data.session,
        sessionData: data.session
          ? {
              userId: safeUser?.id,
              email: safeUser?.email,
            }
          : null,
      });
    } catch (refreshError) {
      console.error("Exception refreshing session:", refreshError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to refresh session",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Unexpected error in refresh-session API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to refresh session",
      },
      { status: 500 }
    );
  }
}
