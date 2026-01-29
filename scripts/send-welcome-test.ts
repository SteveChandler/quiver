/**
 * Quick script to test welcome email
 * Usage: npx tsx scripts/send-welcome-test.ts [email]
 */
import * as dotenv from "dotenv";
// Load production env for Supabase credentials, then local for secrets
dotenv.config({ path: ".env.production.local" });
dotenv.config({ path: ".env.local" }); // This won't override existing vars
import { createClient } from "@supabase/supabase-js";
import { resend } from "../lib/mailer/client";

// Use Resend's test domain for local testing (quiversurf.app requires production Resend setup)
const TEST_MAIL_FROM = "Quiver Test <onboarding@resend.dev>";
import {
  generateWelcomeEmailHtml,
  generateWelcomeEmailText,
  WELCOME_EMAIL_SUBJECT,
} from "../lib/email/templates/welcome-email-html";
import { signEmailToken } from "../lib/utils/email-token";

const DEFAULT_EMAIL = "stcha0004@gmail.com";
// Always use production URL for testing preference links
const PROD_BASE_URL = "https://quiversurf.app";

async function main() {
  const testEmail = process.argv[2] || DEFAULT_EMAIL;
  console.log("Sending welcome email to:", testEmail);

  const secret = process.env.EMAIL_TOKEN_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("EMAIL_TOKEN_SECRET not set");
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  }

  // Look up the real user ID from auth.users using admin API
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Use RPC to find user by email (requires service role)
  const { data: users, error: userError } = await supabase.rpc(
    "get_user_id_by_email",
    { user_email: testEmail }
  );

  // If the RPC doesn't exist, try a direct approach via profiles
  let userId: string | null = null;

  if (userError || !users) {
    // Fallback: query profiles which may have email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", testEmail)
      .maybeSingle();

    if (profile?.id) {
      userId = profile.id;
    } else {
      // Last resort: list users via admin API
      const { data: authData } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });

      const foundUser = authData?.users?.find((u) => u.email === testEmail);
      if (foundUser) {
        userId = foundUser.id;
      }
    }
  } else {
    userId = users;
  }

  if (!userId) {
    throw new Error(`User not found for email: ${testEmail}`);
  }

  console.log("Found user ID:", userId);

  // Generate token with real user ID for preference links
  const token = await signEmailToken(
    { user_id: userId, purpose: "prefs" },
    secret
  );

  const html = generateWelcomeEmailHtml({ baseUrl: PROD_BASE_URL, token });
  const text = generateWelcomeEmailText({ baseUrl: PROD_BASE_URL, token });

  console.log("Subject:", WELCOME_EMAIL_SUBJECT);
  console.log("Base URL:", PROD_BASE_URL);
  console.log("Sample link:", `${PROD_BASE_URL}/api/prefs/set?time=dawn&token=${token.slice(0, 20)}...`);

  const result = await resend.emails.send({
    from: TEST_MAIL_FROM,
    to: testEmail,
    subject: `${WELCOME_EMAIL_SUBJECT} (TEST)`,
    html,
    text,
  });

  console.log("✅ Sent:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
