/**
 * One-off: send the rewritten welcome email to a target address.
 *
 * Bypasses the /api/internal/send-welcome-email auth + dedupe check
 * so we can render + send the D1-era template against a real inbox.
 * Does NOT write to email_send_log — this is a preview send, not a
 * real delivery.
 *
 * Run: npx tsx scripts/send-test-welcome.ts stcha0004@gmail.com
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { generateWelcomeEmail } from "../lib/mailer/welcome-email";

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npx tsx scripts/send-test-welcome.ts <email>");
    process.exit(1);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const mailFrom = process.env.MAIL_FROM?.trim() || "Quiver <steven@quiversurf.app>";
  const mailReplyTo = process.env.MAIL_REPLY_TO?.trim() || mailFrom;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app").trim();

  // Look up the recipient's profile (if any) so we render the
  // "has home beach" variant when they actually have one.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  );

  let homeBeachName: string | null = null;
  let homeBeachSlug: string | null = null;

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 200 });
  const profileUser = users.find((u) => u.email?.toLowerCase() === to.toLowerCase());
  if (profileUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", profileUser.id)
      .maybeSingle();
    if (profile?.home_beach_id) {
      const { data: beach } = await supabase
        .from("beaches")
        .select("name, slug")
        .eq("id", profile.home_beach_id)
        .maybeSingle();
      if (beach?.name && beach?.slug) {
        homeBeachName = beach.name;
        homeBeachSlug = beach.slug;
      }
    }
  }

  console.log("[send-test-welcome]", {
    to,
    hasHomeBeach: Boolean(homeBeachName && homeBeachSlug),
    homeBeachName,
    homeBeachSlug,
    baseUrl,
  });

  const { subject, react, text } = generateWelcomeEmail({
    baseUrl,
    homeBeachName,
    homeBeachSlug,
    messageInstanceId: crypto.randomUUID(),
  });

  const { data, error } = await resend.emails.send({
    from: mailFrom,
    replyTo: mailReplyTo,
    to,
    subject: `[PREVIEW] ${subject}`,
    react,
    text,
  });

  if (error) {
    console.error("[send-test-welcome] send failed:", error);
    process.exit(1);
  }

  console.log("[send-test-welcome] sent:", data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
