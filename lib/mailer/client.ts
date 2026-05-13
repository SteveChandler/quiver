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

// Default uses the verified Resend subdomain (send.quiversurf.app). The apex
// quiversurf.app is NOT verified on Resend, so falling back to it would 403.
export const MAIL_FROM = process.env.MAIL_FROM || "Quiver <invites@send.quiversurf.app>";
export const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || MAIL_FROM;

/**
 * Get the base URL for the application.
 * Used for constructing links in emails.
 */
export function getBaseUrl(): string {
  const configured =
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.quiversurf.app";
  const baseUrl = configured.replace(/\/+$/, "");
  if (baseUrl === "https://quiversurf.app") return "https://www.quiversurf.app";
  return baseUrl;
}
