import * as React from "react";

import {
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_PLAY_URL,
} from "@/lib/constants/app-store";
import { MAIL_FROM, MAIL_REPLY_TO, resend } from "@/lib/mailer/client";
import { AndroidBetaInstructionsEmail } from "@/lib/mailer/templates/AndroidBetaInstructionsEmail";

export const ANDROID_BETA_INSTRUCTIONS_SUBJECT =
  "Your Quiver Android beta steps";

export interface SendAndroidBetaInstructionsEmailResult {
  success: boolean;
  messageId?: string;
  error?: unknown;
}

export async function sendAndroidBetaInstructionsEmail(
  email: string,
): Promise<SendAndroidBetaInstructionsEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: email,
      subject: ANDROID_BETA_INSTRUCTIONS_SUBJECT,
      react: React.createElement(AndroidBetaInstructionsEmail, {
        groupUrl: ANDROID_BETA_GROUP_URL,
        playUrl: ANDROID_BETA_PLAY_URL,
      }),
      text: [
        "Android beta access is available now.",
        "Use personalized surf decisions, best-window guidance, saved spots, alerts, and session logging in the native app.",
        "",
        "1. Join the Quiver Android tester group with your Google Play account:",
        ANDROID_BETA_GROUP_URL,
        "",
        "2. Opt in on Google Play after the group accepts your account:",
        ANDROID_BETA_PLAY_URL ?? "The Play opt-in link will be sent when available.",
        "",
        "3. Install Quiver from Google Play on that same account.",
        "",
        "Use Quiver on your real surf routine and tell us where the Android experience needs work.",
      ].join("\n"),
    });

    if (error) {
      return { success: false, error };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error };
  }
}
