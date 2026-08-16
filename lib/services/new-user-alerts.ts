/**
 * New-User Alert Service
 *
 * Sends admin email alerts when new users sign up and when auth
 * state propagation failures are detected. Uses Resend.
 */

import { sendEmail } from "@/lib/mailer/client";

const ADMIN_EMAIL = "stcha0004@gmail.com";
const FROM_ADDRESS = "Quiver Alerts <noreply@quiversurf.app>";

interface NewUserAlertData {
  userId: string;
  email: string;
  name: string | null;
  signupMethod: string;
  device?: { os?: string; browser?: string; device_type?: string };
  viewportWidth?: number;
  entryPage?: string;
}

interface AuthFailureAlertData {
  userId: string;
  email: string;
  name: string | null;
  signupMethod: string;
  minutesSinceSignup: number;
  ctaSource: string;
}

export async function sendNewUserAlert(data: NewUserAlertData) {
  try {
    const deviceInfo = data.device
      ? `${data.device.os || "?"} / ${data.device.browser || "?"} / ${data.device.device_type || "?"}`
      : "Unknown";

    await sendEmail({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `New signup: ${data.name || data.email} (${data.signupMethod})`,
      text: [
        "New user signed up for Quiver!",
        "",
        `Name: ${data.name || "(no name)"}`,
        `Email: ${data.email}`,
        `Method: ${data.signupMethod}`,
        `Device: ${deviceInfo}`,
        `Viewport: ${data.viewportWidth || "unknown"}px`,
        `Entry page: ${data.entryPage || "unknown"}`,
        "",
        `User ID: ${data.userId}`,
        "Admin: https://quiversurf.app/admin",
      ].join("\n"),
    });
  } catch {
    // Fire-and-forget — don't break the auth flow
  }
}

export async function sendAuthFailureAlert(data: AuthFailureAlertData) {
  try {
    await sendEmail({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `AUTH FAILURE: ${data.name || data.email} still seeing CTAs ${data.minutesSinceSignup}min after signup`,
      text: [
        `A user who signed up ${data.minutesSinceSignup} minutes ago is still seeing signup CTAs.`,
        "This means auth state did not propagate correctly.",
        "",
        `Name: ${data.name || "(no name)"}`,
        `Email: ${data.email}`,
        `Method: ${data.signupMethod}`,
        `CTA source: ${data.ctaSource}`,
        "",
        `User ID: ${data.userId}`,
        "",
        "ACTION: Check if they hit the auth state propagation bug.",
        "Consider reaching out personally.",
      ].join("\n"),
    });
  } catch {
    // Fire-and-forget — don't break event recording
  }
}
