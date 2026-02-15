import { resend, MAIL_FROM, MAIL_REPLY_TO } from "./client";
import { SessionInviteEmail } from "./templates/SessionInviteEmail";

export async function sendSessionInviteEmail({
  toEmail,
  inviter,
  session,
  message,
  activityId,
  appUrl,
}: {
  toEmail: string;
  inviter: { id: string; name?: string | null; username?: string | null };
  session: { id: string; arrival_time?: string; beach_name?: string | null };
  message?: string;
  activityId?: string;
  appUrl: string;
}) {
  if (!toEmail) return;

  const inviterName =
    inviter.name ??
    (inviter.username ? `@${inviter.username}` : "a surfer on Quiver");
  const ctaBaseUrl = new URL(`${appUrl}/inbox`);
  ctaBaseUrl.searchParams.set("activity", activityId ?? "");
  ctaBaseUrl.searchParams.set("focus", `session:${session.id}`);
  ctaBaseUrl.searchParams.set("utm_source", "quiver");
  ctaBaseUrl.searchParams.set("utm_medium", "invite");
  ctaBaseUrl.searchParams.set("utm_campaign", "session_invite");
  const ctaUrl = ctaBaseUrl.toString();

  await resend.emails.send({
    from: MAIL_FROM,
    to: toEmail,
    reply_to: MAIL_REPLY_TO,
    subject: `${inviterName} invited you to surf${
      session.beach_name ? " at " + session.beach_name : ""
    }`,
    react: SessionInviteEmail({
      inviterName,
      beachName: session.beach_name ?? undefined,
      whenIso: session.arrival_time,
      ctaUrl,
      note: message,
    }),
  });
}
