import { resend, MAIL_FROM } from "./client";
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
  const ctaUrl = `${appUrl}/inbox?activity=${activityId ?? ""}&focus=session:${
    session.id
  }`;

  await resend.emails.send({
    from: MAIL_FROM,
    to: toEmail,
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

