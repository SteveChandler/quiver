import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Comprehensive test data seeding function
 * Creates all the data that tests expect to exist
 */
async function seedTestData(admin: any, userId: string, email: string) {
  try {
    // 1. Create/update user profile
    await admin.from("profiles").upsert({
      id: userId,
      email: email,
      display_name: "Test User",
      bio: "Test user for Playwright tests",
      location: "San Diego, CA",
      skill_level: "intermediate",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Create additional test users for following/discovery tests
    const testUsers = [
      { email: "testuser2@test.com", display_name: "Test User 2" },
      { email: "testuser3@test.com", display_name: "Test User 3" },
    ];

    for (const testUser of testUsers) {
      const { data: newUser } = await admin.auth.admin.createUser({
        email: testUser.email,
        password: "TestPass123!",
        email_confirm: true,
      }).catch(() => ({ data: null }));

      if (newUser?.user) {
        await admin.from("profiles").upsert({
          id: newUser.user.id,
          email: testUser.email,
          display_name: testUser.display_name,
          bio: `Bio for ${testUser.display_name}`,
          location: "San Diego, CA",
          skill_level: "beginner",
        });
      }
    }

    // 3. Create test boards for the user
    const boardsData = [
      { name: "Test Shortboard", type: "shortboard", length: 6.0, width: 18.5, thickness: 2.25 },
      { name: "Test Longboard", type: "longboard", length: 9.0, width: 22.0, thickness: 3.0 },
    ];

    for (const board of boardsData) {
      await admin.from("boards").upsert({
        ...board,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    }

    // 4. Get some beach IDs to use for sessions
    const { data: beaches } = await admin.from("beaches").select("id").limit(3);
    const beachIds = beaches?.map((b: any) => b.id) || [];

    if (beachIds.length > 0) {
      // 5. Create test sessions (mix of planned and completed)
      const sessionsData = [
        {
          beach_id: beachIds[0],
          session_date: new Date().toISOString().split('T')[0],
          session_time: "morning",
          duration: 120,
          wave_count: 15,
          fun_factor: 8,
          notes: "Great morning session with clean waves",
          is_planned: false, // completed session
        },
        {
          beach_id: beachIds[0],
          session_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // tomorrow
          session_time: "afternoon",
          notes: "Planning afternoon session at Malibu",
          is_planned: true, // planned session
        },
        {
          beach_id: beachIds.length > 1 ? beachIds[1] : beachIds[0],
          session_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // yesterday
          session_time: "evening",
          duration: 90,
          wave_count: 10,
          fun_factor: 6,
          notes: "Evening glass-off session",
          is_planned: false,
        },
      ];

      for (const session of sessionsData) {
        await admin.from("sessions").upsert({
          ...session,
          user_id: userId,
          created_at: new Date().toISOString(),
        });
      }

      // 6. Create beach reviews for testing
      if (beachIds.length > 0) {
        await admin.from("beach_reviews").upsert({
          beach_id: beachIds[0],
          user_id: userId,
          overall_rating: 4,
          wave_quality: 4,
          crowd_level: 3,
          amenities: 3,
          safety: 5,
          accessibility: 4,
          review_text: "Great beach for testing! Consistent waves and good vibes.",
          visit_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        });
      }

      // 7. Create beach check-ins
      if (beachIds.length > 0) {
        await admin.from("beach_check_ins").upsert({
          beach_id: beachIds[0],
          user_id: userId,
          conditions_text: "Clean 3-4ft waves, light offshore wind",
          created_at: new Date().toISOString(),
        });
      }
    }

    console.log("✅ Comprehensive test data seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding test data:", error);
    // Don't throw - let authentication still work even if seeding fails partially
  }
}

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
    const { data: userData } = await admin.auth.admin.createUser({ 
      email, 
      password, 
      email_confirm: true 
    }).catch(() => ({ data: null }));

    // Sign in the user to get a session
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

    const userId = data.session?.user?.id;
    if (userId) {
      // Comprehensive test data seeding
      await seedTestData(admin, userId, email);
    }

    return NextResponse.json(
      { ok: true, userId: data.session?.user?.id ?? null, access_token: data.session?.access_token ?? null },
      { headers: res.headers }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}


