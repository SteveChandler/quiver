import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";

export async function POST() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
      headers: headers(),
    });

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

      // Return success response with limited session data
      return NextResponse.json({
        success: true,
        hasSession: !!data.session,
        sessionData: data.session
          ? {
              userId: data.session.user?.id,
              email: data.session.user?.email,
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
