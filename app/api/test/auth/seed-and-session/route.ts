import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = body?.email || process.env.TEST_USER_EMAIL || "dev@local.test";
    const password = body?.password || process.env.TEST_USER_PASSWORD || "Passw0rd!";
    const token = request.headers.get("x-dev-auth") || body?.token || "";
    const devToken = process.env.DEV_AUTH_TOKEN || "dev-local-token";
    if (!token || token !== devToken) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    // Seed user via admin API (idempotent)
    const admin = createSupabaseServiceRoleClient();
    await admin.auth.admin.createUser({ email, password, email_confirm: true }).catch(() => null);

    // Prepare response to set cookies
    const res = NextResponse.json({ ok: true });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (n) => request.cookies.get(n)?.value,
          set: (n, v, o) => res.cookies.set({ name: n, value: v, ...o }),
          remove: (n, o) => res.cookies.delete({ name: n, ...o }),
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json(
      { ok: true, userId: data.session?.user?.id ?? null, access_token: data.session?.access_token ?? null },
      { headers: res.headers }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}


