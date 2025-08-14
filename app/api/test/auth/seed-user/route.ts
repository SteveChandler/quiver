import { NextRequest, NextResponse } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ success: false, error: "Not allowed" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { email, password } = body || {};
    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Missing email/password" }, { status: 400 });
    }

    const supabase = createSupabaseServiceRoleClient();

    // Try to create, but if exists, treat as success
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error && !String(error.message || "").toLowerCase().includes("already")) {
      throw error;
    }

    return createSuccessResponse({ ok: true, userId: data?.user?.id || null });
  } catch (error) {
    return handleApiError(error);
  }
}


