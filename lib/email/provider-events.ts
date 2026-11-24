import { z } from "zod";
import { lifecycleRpc } from "@/lib/email/lifecycle";

const eventSchema = z.object({
  type: z.string(),
  created_at: z.string().datetime({ offset: true }),
  data: z.object({
    email_id: z.string().min(1).max(256),
    created_at: z.string().datetime({ offset: true }),
    from: z.string().optional(),
    to: z.array(z.email()).max(100).optional(),
    bounce: z.object({ type: z.string(), subType: z.string().max(256).optional() }).optional(),
    click: z.object({ link: z.string().max(4096).optional(), userAgent: z.string().max(1024).optional() }).optional(),
  }),
});
const handled = new Set(["email.delivered", "email.opened", "email.clicked", "email.bounced", "email.complained", "email.failed", "email.delivery_delayed"]);

export async function recordProviderEvent(raw: unknown, webhookId: string): Promise<boolean> {
  const envelope = z.object({ type: z.string() }).parse(raw);
  if (!handled.has(envelope.type) && envelope.type !== "email.received") return false;
  const event = eventSchema.parse(raw);
  if (event.type === "email.received") {
    const mailbox = z.email().parse(process.env.EMAIL_REPLY_MAILBOX).toLowerCase();
    if (!event.data.to?.some(to => to.toLowerCase() === mailbox)) return false;
    // Parse a conventional display-name mailbox; no fuzzy profile matching.
    const from = event.data.from?.match(/<([^<>]+)>$/)?.[1] ?? event.data.from;
    await lifecycleRpc("record_email_reply", { p_event_id: event.data.email_id, p_webhook_id: webhookId,
      p_sender: z.email().parse(from).toLowerCase(), p_received_at: event.created_at });
    return true;
  }
  const args = { p_webhook_id: webhookId, p_provider_id: event.data.email_id,
    p_type: event.type, p_at: event.created_at, p_recipients: event.data.to ?? [],
    p_hard_bounce: ["permanent", "hard"].includes(event.data.bounce?.type.toLowerCase() ?? ""), p_link: event.data.click?.link ?? null,
    p_user_agent: event.data.click?.userAgent ?? null };
  try {
    await lifecycleRpc("record_lifecycle_provider_event_v2", { ...args,
      p_bounce_type: event.data.bounce?.type ?? null, p_bounce_subtype: event.data.bounce?.subType ?? null });
  } catch (error) {
    // Code deploys before 20261124160000_email_repeat_bounce_suppression.sql is applied; only a missing v2 falls back.
    if (!isMissingFunction(error)) throw error;
    await lifecycleRpc("record_lifecycle_provider_event", args);
  }
  return true;
}

const MISSING_FUNCTION_CODES: ReadonlySet<string> = new Set(["PGRST202", "42883"]);

function isMissingFunction(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  const code = typeof cause === "object" && cause !== null ? (cause as { code?: unknown }).code : undefined;
  return typeof code === "string" && MISSING_FUNCTION_CODES.has(code);
}
