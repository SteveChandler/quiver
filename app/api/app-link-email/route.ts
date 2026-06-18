import type { NextRequest } from "next/server";

import {
  createErrorResponse,
  createSuccessResponse,
  createValidationError,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import {
  APP_FIRST_CAMPAIGN,
  buildAppHandoffPath,
} from "@/lib/constants/app-handoff";
import {
  getBaseUrl,
  MAIL_FROM,
  MAIL_REPLY_TO,
  resend,
} from "@/lib/mailer/client";
import { AppLinkEmail } from "@/lib/mailer/templates/AppLinkEmail";
import { AppLinkEmailSchema } from "@/lib/validation/schemas";

const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX = 3;
const emailHits = new Map<string, { count: number; resetAt: number }>();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = emailHits.get(key);

  if (!entry || now > entry.resetAt) {
    emailHits.set(key, { count: 1, resetAt: now + EMAIL_WINDOW_MS });
    return true;
  }

  if (entry.count >= EMAIL_MAX) return false;

  entry.count += 1;
  return true;
}

export const POST = withBotBlockingAndRateLimit(
  async (request: NextRequest) => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return createValidationError("Invalid request body.");
    }

    const parsed = AppLinkEmailSchema.safeParse(raw);
    if (!parsed.success) {
      return createValidationError(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        parsed.error.issues,
      );
    }

    const { email, source, placement } = parsed.data;

    if (!checkEmailRateLimit(email)) {
      return createErrorResponse(
        "Too many attempts. Scan the QR code or try again later.",
        undefined,
        429,
      );
    }

    if (!process.env.RESEND_API_KEY) {
      if (process.env.NODE_ENV !== "production") {
        return createErrorResponse(
          "Email is not configured in this environment.",
          undefined,
          503,
        );
      }
      return createErrorResponse("Could not send the link.", undefined, 503);
    }

    const appUrl = `${getBaseUrl()}${buildAppHandoffPath({
      source: source ?? "app_link_email",
      placement: placement ?? "email",
      utm_source: "email",
      utm_medium: "app_link",
      utm_campaign: APP_FIRST_CAMPAIGN,
    })}`;

    try {
      const { error } = await resend.emails.send({
        from: MAIL_FROM,
        replyTo: MAIL_REPLY_TO,
        to: email,
        subject: "Open Quiver on your phone",
        react: AppLinkEmail({ appUrl }),
      });

      if (error) throw new Error("send_failed");
      return createSuccessResponse({ ok: true });
    } catch {
      return createErrorResponse("Could not send the link.", undefined, 502);
    }
  },
  { key: "anon-alert-capture" },
);
