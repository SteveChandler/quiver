export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  DEFAULT_SECURITY_HEADERS,
  handleApiError,
} from "@/lib/middleware/api-wrappers";

export async function GET() {
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

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // If there's no valid user, treat as unauthenticated (NOT a server error).
    // This is intentionally 401 so callers/tests can rely on status codes.
    if (!user || error) {
      return NextResponse.json(
        {
          hasSession: false,
          sessionData: null,
        },
        { status: 401, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    return NextResponse.json(
      {
        hasSession: true,
        sessionData: {
          userId: user.id,
          email: user.email,
          // Don't include sensitive data
        },
      },
      { status: 200, headers: DEFAULT_SECURITY_HEADERS }
    );
  } catch (error) {
    return handleApiError(error, "Failed to check session");
  }
}
