import { z } from "zod";
import type { CreateEmailResponse } from "resend";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  userId: z.uuid(),
  emailType: z.enum(["trial_invitation", "founder_story", "first_session_nudge", "weekly_recap", "session_prompt", "trial_started", "trial_ended"]),
});
export type EmailContact = z.infer<typeof contactSchema>;

// The migration is intentionally unapplied; generated types must come from the DB.
async function contactRpc(name: string, args: Record<string, string>): Promise<unknown> {
  const client = await createSupabaseServiceRoleClient();
  const { data, error } = await (client as unknown as {
    rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc(name, args);
  if (error) throw new Error(`Email contact storage failed: ${name}`);
  return data;
}

function replyMailbox(): string {
  const result = z.email().safeParse(process.env.EMAIL_REPLY_MAILBOX?.trim().toLowerCase());
  if (!result.success) throw new Error("Verified reply mailbox is not configured");
  return result.data;
}

export async function sendWithContactPolicy(
  contact: EmailContact,
  to: string | string[],
  send: (idempotencyKey?: string, replyTo?: string) => Promise<CreateEmailResponse>
): Promise<CreateEmailResponse> {
  contactSchema.parse(contact);
  const recipient = z.email().parse(typeof to === "string" ? to.trim().toLowerCase() : undefined);
  const mailbox = replyMailbox();
  const decision = z.object({
    allowed: z.boolean(), attempt_id: z.string().min(1).optional(), reason: z.string().optional(),
  }).parse(await contactRpc("claim_email_contact", {
    p_user_id: contact.userId, p_email: recipient, p_email_type: contact.emailType,
  }));
  if (!decision.allowed || !decision.attempt_id) {
    throw new Error(`Email contact blocked: ${decision.reason ?? "invalid_reservation"}`);
  }
  // Never release ambiguous claims automatically, even when the provider throws.
  const response = await send(decision.attempt_id, mailbox);
  if (response.error || !response.data?.id) throw new Error("Email contact provider acceptance unverified");
  await contactRpc("finish_email_contact", { p_attempt_id: decision.attempt_id, p_provider_id: response.data.id });
  return response;
}

export async function recordInboundReply(data: unknown, webhookId: string): Promise<boolean> {
  const event = z.object({
    email_id: z.string().min(1).max(256),
    from: z.email(), to: z.array(z.email()).min(1).max(100),
    created_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  }).parse(data);
  if (!event.to.some((address) => address.toLowerCase() === replyMailbox())) return false;
  await contactRpc("record_email_reply", {
    p_event_id: event.email_id, p_webhook_id: webhookId,
    p_sender: event.from.toLowerCase(), p_received_at: event.created_at,
  });
  return true;
}
