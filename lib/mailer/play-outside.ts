import * as React from "react";

import { getBaseUrl, MAIL_FROM, MAIL_REPLY_TO, resend } from "@/lib/mailer/client";
import { PlayOutsideLeadEmail } from "@/lib/mailer/templates/PlayOutsideLeadEmail";

export const PLAY_OUTSIDE_SUBJECT = "Your OUTSIDE heat, and the real forecast";

export interface SendPlayOutsideEmailInput {
  email: string;
  breakName: string;
  heatTotal: number;
  breakUrl: string;
}

export interface SendPlayOutsideEmailResult { success: boolean; messageId?: string; error?: unknown; }

export async function sendPlayOutsideEmail({ email, breakName, heatTotal, breakUrl }: SendPlayOutsideEmailInput): Promise<SendPlayOutsideEmailResult> {
  try {
    const downloadUrl = `${getBaseUrl()}/download`;
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: email,
      subject: PLAY_OUTSIDE_SUBJECT,
      react: React.createElement(PlayOutsideLeadEmail, { breakName, heatTotal, breakUrl: `${getBaseUrl()}${breakUrl}`, downloadUrl }),
      text: [
        `${breakName} is real.`,
        `Your OUTSIDE heat: ${heatTotal.toFixed(2)}.`,
        `Check the real forecast: ${getBaseUrl()}${breakUrl}`,
        `Get the Quiver app: ${downloadUrl}`,
        "",
        "You asked for this forecast message. Quiver updates are optional; unsubscribe any time.",
      ].join("\n"),
    });
    if (error) return { success: false, error };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error };
  }
}
