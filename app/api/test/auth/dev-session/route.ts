import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    const url = new URL(request.url);
    const token = request.headers.get("x-dev-auth") || url.searchParams.get("token") || "";
    const devToken = process.env.DEV_AUTH_TOKEN || "dev-local-token";
    const email = process.env.TEST_USER_EMAIL || "dev@local.test";
    const password = process.env.TEST_USER_PASSWORD || "Passw0rd!";

    if (!token || token !== devToken) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    // Prepare a response we can mutate with cookies (required by @supabase/ssr)
    const res = NextResponse.json({ ok: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value;
          },
          set(name, value, options) {
            res.cookies.set({ name, value, ...options });
          },
          remove(name, options) {
            res.cookies.delete({ name, ...options });
          },
        },
      }
    );

    // Attempt password sign-in using configured test user
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        userId: data.session?.user?.id ?? null,
        access_token: data.session?.access_token ?? null,
      },
      {
        headers: res.headers,
      }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}


