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
const provider: any = new Proxy(
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

type SendEmailOptions = CreateEmailOptions & {
  purpose?: "requested" | "internal" | "condition_alert";
  alertContact?: { userId: string; episode: string };
  unsubscribeUrl?: string;
};

export async function sendEmail(
  options: SendEmailOptions
): Promise<CreateEmailResponse> {
  const { unsubscribeUrl, headers, purpose, alertContact, ...resendOptions } = options;
  if (purpose === "condition_alert") return sendRequestedAlert(options, alertContact);
  if (!purpose) throw new Error("Unclassified email blocked; use the lifecycle dispatcher");

  if (!unsubscribeUrl) {
    return provider.emails.send({
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

  return provider.emails.send({
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

// Kept as a loud failure for old imports; it cannot bypass the policy wrapper.
export const resend = { emails: { send: async (): Promise<never> => {
  throw new Error("Direct email sending is retired; use a classified sender");
} } };

export async function sendReservedLifecycleEmail(attemptId: string, payload: CreateEmailOptions): Promise<string> {
  const { lifecycleEnabled, lifecycleRpc } = await import("@/lib/email/lifecycle");
  if (!lifecycleEnabled() || shouldSuppressE2EEmailSends()) return "disabled";
  if (process.env.EMAIL_REPLY_INGESTION_VERIFIED !== "true") throw new Error("Reply ingestion is not verified");
  if (payload.cc || payload.bcc || typeof payload.to !== "string") throw new Error("Lifecycle requires one recipient");
  const begun = await lifecycleRpc("begin_email_lifecycle", { p_attempt_id: attemptId, p_payload: payload });
  if (begun !== true) return "cancelled";
  try {
    const response: CreateEmailResponse = await provider.emails.send(payload, { idempotencyKey: attemptId });
    if (response.error || !response.data?.id) throw new Error("Provider acceptance unknown");
    await lifecycleRpc("finish_email_lifecycle", { p_attempt_id: attemptId, p_provider_id: response.data.id });
    return "accepted";
  } catch {
    // Ambiguous attempts remain reserved indefinitely; never mint a retry key.
    await lifecycleRpc("mark_email_lifecycle_unknown", { p_attempt_id: attemptId });
    return "unknown";
  }
}

async function sendRequestedAlert(options: SendEmailOptions, contact: SendEmailOptions["alertContact"]): Promise<CreateEmailResponse> {
  const { lifecycleEnabled, lifecycleRpc } = await import("@/lib/email/lifecycle");
  if (!lifecycleEnabled() || shouldSuppressE2EEmailSends()) throw new Error("Managed alert sending is disabled");
  if (!contact || typeof options.to !== "string" || options.cc || options.bcc) throw new Error("Invalid alert contact");
  const { render } = await import("@react-email/render");
  const { purpose: _purpose, alertContact: _contact, unsubscribeUrl, react, ...rest } = options;
  const html = react ? await render(react) : options.html;
  if (!unsubscribeUrl || !html) throw new Error("Missing alert content or unsubscribe");
  const payload = { ...rest, html, text: options.text ?? await render(react!, { plainText: true }), headers: { ...options.headers, "List-Unsubscribe": `<${unsubscribeUrl}>` } };
  const claim = await lifecycleRpc("claim_requested_email_alert", { p_user_id: contact.userId, p_episode: contact.episode, p_payload: payload }) as { allowed: boolean; attempt_id?: string; reason?: string };
  if (!claim.allowed || !claim.attempt_id) return { headers: null, data: null, error: { name: "validation_error", statusCode: 409, message: `Contact held: ${claim.reason ?? "unknown"}` } };
  try {
    const response: CreateEmailResponse = await provider.emails.send(payload, { idempotencyKey: claim.attempt_id });
    if (response.error || !response.data?.id) throw new Error("Alert acceptance unknown");
    await lifecycleRpc("finish_email_lifecycle", { p_attempt_id: claim.attempt_id, p_provider_id: response.data.id });
    return response;
  } catch {
    await lifecycleRpc("mark_email_lifecycle_unknown", { p_attempt_id: claim.attempt_id });
    return { headers: null, data: null, error: { name: "application_error", statusCode: 503, message: "Alert handoff unknown; held for reconciliation" } };
  }
}
