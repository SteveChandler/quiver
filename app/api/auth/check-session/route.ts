export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createBearerTokenClient } from "@/lib/supabase/bearer-client";
import {
  DEFAULT_SECURITY_HEADERS,
  handleApiError,
} from "@/lib/middleware/api-wrappers";

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}

export async function GET(request?: NextRequest) {
  try {
    const bearerToken = request ? extractBearerToken(request) : null;
    if (bearerToken) {
      const supabase = createBearerTokenClient(bearerToken);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(bearerToken);

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
          },
        },
        { status: 200, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

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
