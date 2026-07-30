import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailResponse,
} from "resend";

let resendInstance: Resend | null = null;

function shouldSuppressE2EEmailSends(): boolean {
  return (
    process.env.E2E_ALLOW_EMAIL_SENDS !== "true" &&
    (process.env.PLAYWRIGHT_TEST === "true" ||
      process.env.NEXT_PUBLIC_E2E_DISABLE_EMAIL_SENDS === "true")
  );
}

const e2eResendStub = {
  emails: {
    async send() {
      return { data: { id: `e2e-email-${crypto.randomUUID()}` }, error: null };
    },
  },
};

// Lazy, safe access to the Resend client to avoid build-time instantiation
export const resend: any = new Proxy(
  {},
  {
    get(_target, prop) {
      if (shouldSuppressE2EEmailSends()) {
        // Playwright must not consume real provider quota from local .env files.
        return e2eResendStub[prop as keyof typeof e2eResendStub];
      }

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

export type SendEmailOptions = CreateEmailOptions & {
  unsubscribeUrl?: string;
};

export async function sendEmail(
  options: SendEmailOptions
): Promise<CreateEmailResponse> {
  const { unsubscribeUrl, headers, ...resendOptions } = options;

  if (!unsubscribeUrl) {
    return resend.emails.send({
      ...resendOptions,
      ...(headers ? { headers } : {}),
    });
  }

  if (process.env.NODE_ENV === "production") {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(unsubscribeUrl);
    } catch {
      throw new Error("unsubscribeUrl must be a valid HTTPS URL in production");
    }

    if (parsedUrl.protocol !== "https:") {
      throw new Error("unsubscribeUrl must use HTTPS in production");
    }
  }

  return resend.emails.send({
    ...resendOptions,
    headers: {
      ...headers,
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
    },
  });
}

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
