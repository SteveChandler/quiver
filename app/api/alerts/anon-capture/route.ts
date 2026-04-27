import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withErrorHandler, withRateLimit } from "@/lib/middleware/api-wrappers";
import { validateAnonCapture } from "@/lib/alerts/anon-capture-validator";

export const dynamic = "force-dynamic";

/**
 * POST /api/alerts/anon-capture
 *
 * Accepts an anonymous email + beach + preset choice, persists a pending
 * capture row, and triggers a Supabase magic-link OTP email. On the
 * /auth/callback redirect, the RPC `finalize_anon_alert_capture` will
 * materialize a real alert_rule for the freshly-authenticated user.
 *
 * Behavior:
 * - Honeypot ("website" non-empty) → silent 200 success, no side effects.
 * - Validation failures → 200 { success: false, error: <code> } so the
 *   client can surface the specific reason without leaking via status code.
 * - Idempotent on (email, beach_id, preset_type) — reuses any unconsumed,
 *   unexpired pending row instead of inserting a duplicate.
 * - On OTP send failure, deletes the pending row IFF this request inserted
 *   it (a reused row stays put for the next attempt).
 * - Best-effort `user_events` insert for funnel tracking.
 *
 * Rate-limited: 5/hour per IP via "anon-alert-capture" key.
 */
export const POST = withErrorHandler(
  withRateLimit(
    async (request: NextRequest) => {
      const json = await request.json().catch(() => ({}));
      const validation = validateAnonCapture(json);

      // Honeypot: silent 200 success with no side effect.
      if (!validation.ok && validation.error === "honeypot") {
        return NextResponse.json({ success: true });
      }
      if (!validation.ok) {
        return NextResponse.json({ success: false, error: validation.error });
      }
      const { email, beach_id, preset_type, return_path } = validation.value;

      const supabase = await createSupabaseServiceRoleClient();

      // Verify beach exists.
      const { data: beach } = await supabase
        .from("beaches")
        .select("id")
        .eq("id", beach_id)
        .maybeSingle();
      if (!beach) {
        return NextResponse.json({ success: false, error: "beach_not_found" });
      }

      // Idempotent insert. If a row already exists for (email, beach_id,
      // preset_type) that is unconsumed and unexpired, reuse it.
      const { data: existing } = await supabase
        .from("pending_alert_captures")
        .select("id")
        .eq("email", email)
        .eq("beach_id", beach_id)
        .eq("preset_type", preset_type)
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      let insertedId: string | null = existing?.id ?? null;
      if (!insertedId) {
        const { data: inserted, error: insertError } = await supabase
          .from("pending_alert_captures")
          .insert({ email, beach_id, preset_type, return_path })
          .select("id")
          .single();
        if (insertError || !inserted) {
          return NextResponse.json({ success: false, error: "insert_failed" });
        }
        insertedId = inserted.id;
      }

      // Send OTP. On failure, clean up the just-inserted pending row.
      const origin = new URL(request.url).origin;
      const redirectUrl = `${origin}/auth/callback?redirect=${encodeURIComponent(
        return_path
      )}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: redirectUrl },
      });

      if (otpError) {
        // Only delete if WE inserted it (not if we reused an existing row).
        if (!existing && insertedId) {
          await supabase
            .from("pending_alert_captures")
            .delete()
            .eq("id", insertedId);
        }
        return NextResponse.json({ success: false, error: "otp_send_failed" });
      }

      // Fire submit event (best-effort — failure here doesn't roll back).
      await supabase.from("user_events").insert({
        event_type: "anon_alert_capture_submit",
        user_id: null,
        session_id: crypto.randomUUID(),
        metadata: { beach_id, preset_type, return_path },
      });

      return NextResponse.json({ success: true });
    },
    { key: "anon-alert-capture" }
  ),
  { errorMessage: "Failed to capture alert" }
);
