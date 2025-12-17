import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_SECURITY_HEADERS, createSuccessResponse } from "@/lib/api-utils";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const host = url.host;

    if (host !== "dev.quiversurf.app") {
      return NextResponse.json(
        { error: "host not allowed" },
        { status: 403, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    const secret = url.searchParams.get("secret");
    if (!secret || secret !== process.env.E2E_SECRET) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    const missingEnv = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "E2E_USER_EMAIL",
      "E2E_USER_PASSWORD",
    ].filter((k) => !process.env[k as keyof NodeJS.ProcessEnv]);

    if (missingEnv.length) {
      return NextResponse.json(
        { error: `missing env: ${missingEnv.join(",")}` },
        { status: 500, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () =>
            cookieStore.getAll().map(({ name, value }) => ({ name, value })),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.E2E_USER_EMAIL!,
      password: process.env.E2E_USER_PASSWORD!,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    return createSuccessResponse({ ok: true }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unexpected error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: DEFAULT_SECURITY_HEADERS }
    );
  }
}


