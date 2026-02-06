import { Resend } from "resend";

let resendInstance: Resend | null = null;

// Lazy, safe access to the Resend client to avoid build-time instantiation
export const resend: any = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!resendInstance) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          // Throwing here ensures callers can catch and degrade gracefully
          throw new Error("RESEND_API_KEY is not configured");
        }
        resendInstance = new Resend(apiKey);
      }
      // @ts-expect-error - dynamic property access on the underlying client
      return resendInstance[prop];
    },
  }
);

export const MAIL_FROM = process.env.MAIL_FROM || "Quiver <invites@quiversurf.app>";
export const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || MAIL_FROM;

/**
 * Get the base URL for the application.
 * Used for constructing links in emails.
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app";
}
