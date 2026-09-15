import { z } from "zod";
import { lifecycleRpc } from "@/lib/email/lifecycle";

const historySchema = z.object({
  historyId: z.string().regex(/^\d+$/), nextPageToken: z.string().optional(),
  history: z.array(z.object({ messagesAdded: z.array(z.object({ message: z.object({ id: z.string().min(1) }) })).optional() })).optional(),
});
const messageSchema = z.object({
  id: z.string().min(1), threadId: z.string().min(1), internalDate: z.string().regex(/^\d+$/),
  labelIds: z.array(z.string()).optional(),
  payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string() })) }),
});
const metadataHeaders = ["From", "To", "Cc", "Delivered-To", "X-Forwarded-To", "In-Reply-To"];

function addresses(value: string): string[] {
  return [...value.matchAll(/(?:<([^<>\s]+@[^<>\s]+)>|(?:^|[,;])\s*([^<>\s,;]+@[^<>\s,;]+))/g)]
    .map(match => (match[1] ?? match[2]).toLowerCase()).filter(email => z.email().safeParse(email).success);
}

async function gmailGet(path: string, token: string, fetchImpl: typeof fetch, deadline: AbortSignal): Promise<unknown> {
  const response = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]), cache: "no-store",
  });
  if (response.status === 404 && path.startsWith("history?")) throw new Error("gmail_history_expired");
  if (response.status === 404 && path.startsWith("messages/")) throw new Error("gmail_message_missing");
  if (!response.ok) throw new Error(`gmail_read_${response.status}`);
  return response.json();
}

export class GmailReplyBackoffError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("gmail_retry_backoff");
    this.name = "GmailReplyBackoffError";
  }
}

export async function syncGmailReplies(fetchImpl: typeof fetch = fetch): Promise<{ processed: number }> {
  if (process.env.EMAIL_GMAIL_REPLY_SYNC_ENABLED !== "true") throw new Error("gmail_reply_sync_disabled");
  const account = z.email().parse(process.env.EMAIL_GMAIL_ACCOUNT).toLowerCase();
  const replyTo = z.email().parse(process.env.EMAIL_REPLY_MAILBOX).toLowerCase();
  const claim = await lifecycleRpc("claim_gmail_reply_sync", { p_mailbox: account });
  const backoff = z.object({ status: z.literal("backoff"), retry_after_seconds: z.number().int().min(1).max(900) }).safeParse(claim);
  if (backoff.success) throw new GmailReplyBackoffError(backoff.data.retry_after_seconds);
  const lease = z.object({ lease_id: z.uuid(), history_id: z.string().regex(/^\d+$/), missing_ids: z.array(z.string().min(1)).max(200).default([]) }).parse(
    claim);
  const deadline = AbortSignal.timeout(40_000);
  let processed = 0;
  let checkpointFinished = false;
  try {
    const config = z.object({ clientId: z.string().min(1), clientSecret: z.string().min(1), refreshToken: z.string().min(1) }).parse({
      clientId: process.env.EMAIL_GMAIL_CLIENT_ID, clientSecret: process.env.EMAIL_GMAIL_CLIENT_SECRET, refreshToken: process.env.EMAIL_GMAIL_REFRESH_TOKEN,
    });
    const response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]),
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken }),
    });
    if (!response.ok) throw new Error(`gmail_oauth_${response.status}`);
    const token = z.object({ access_token: z.string().min(1) }).parse(await response.json()).access_token;
    const profile = z.object({ emailAddress: z.email() }).parse(await gmailGet("profile", token, fetchImpl, deadline));
    if (profile.emailAddress.toLowerCase() !== account) throw new Error("gmail_account_mismatch");
    const pendingIds = new Set(lease.missing_ids);
    const ids = new Set<string>(pendingIds);
    let pageToken: string | undefined;
    let historyId = lease.history_id;
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ startHistoryId: lease.history_id, historyTypes: "messageAdded", maxResults: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const result = historySchema.parse(await gmailGet(`history?${params}`, token, fetchImpl, deadline));
      for (const history of result.history ?? []) for (const added of history.messagesAdded ?? []) ids.add(added.message.id);
      if (ids.size > 200) throw new Error("gmail_scan_capacity");
      historyId = result.historyId;
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    if (pageToken) throw new Error("gmail_scan_incomplete");
    // ponytail: 200-message pilot ceiling; bounded parallel metadata reads, no bodies.
    const messages = [...ids];
    for (let offset = 0; offset < messages.length; offset += 10) {
      const batch = await Promise.all(messages.slice(offset, offset + 10).map(async id => {
        const params = new URLSearchParams({ format: "metadata" });
        for (const header of metadataHeaders) params.append("metadataHeaders", header);
        try {
          const message = messageSchema.parse(await gmailGet(`messages/${encodeURIComponent(id)}?${params}`, token, fetchImpl, deadline));
          if (message.id !== id) throw new Error("gmail_message_mismatch");
          return message;
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "gmail_message_missing") throw error;
          await lifecycleRpc("note_gmail_reply_missing", { p_lease_id: lease.lease_id, p_message_id: id });
          return null;
        }
      }));
      for (const message of batch) {
        if (!message) continue;
        const headers = (name: string): string => message.payload.headers.filter(header => header.name.toLowerCase() === name.toLowerCase()).map(header => header.value).join(",");
        const recipients = addresses([headers("To"), headers("Cc"), headers("Delivered-To"), headers("X-Forwarded-To")].join(","));
        if (!message.labelIds?.some(label => label === "SENT" || label === "DRAFT") && recipients.includes(replyTo)) {
          const from = addresses(headers("From"));
          if (from.length !== 1) throw new Error("gmail_sender_ambiguous");
          if (from[0] !== account && from[0] !== replyTo) {
            const receivedAt = new Date(Number(message.internalDate));
            if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 60_000) throw new Error("gmail_message_time_invalid");
            await lifecycleRpc("record_gmail_reply", { p_lease_id: lease.lease_id, p_mailbox: account, p_message_id: message.id,
              p_thread_id: message.threadId, p_sender: from[0], p_received_at: receivedAt.toISOString(), p_in_reply_to: headers("In-Reply-To").slice(0,512) || null });
            processed++;
          }
        }
        // Resolve only after recovered metadata has been classified and any reply pause persisted.
        if (pendingIds.has(message.id)) await lifecycleRpc("resolve_gmail_reply_missing", { p_lease_id: lease.lease_id, p_message_id: message.id });
      }
    }
    await lifecycleRpc("finish_gmail_reply_sync", { p_lease_id: lease.lease_id, p_history_id: historyId, p_processed: processed });
    checkpointFinished = true;
    if (await lifecycleRpc("gmail_reply_ingestion_ready") !== true) throw new Error("gmail_message_gaps_unresolved");
    return { processed };
  } catch (error) {
    if (checkpointFinished) throw error;
    const message = error instanceof Error ? error.message : "";
    const retryable = error instanceof TypeError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) || /^gmail_(read|oauth)_(429|5\d\d)$/.test(message) || message.startsWith("Lifecycle storage failed:");
    await lifecycleRpc("record_gmail_reply_failure", { p_lease_id: lease.lease_id, p_retryable: retryable, p_error_code: gmailFailureCode(error) });
    throw error;
  }
}

export async function ensureGmailRepliesFresh(): Promise<void> {
  if (process.env.EMAIL_GMAIL_REPLY_SYNC_ENABLED !== "true") throw new Error("gmail_reply_sync_disabled");
  if (await lifecycleRpc("gmail_reply_ingestion_ready") === true) return;
  await syncGmailReplies();
}

export function gmailFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/^gmail_(?:retry_backoff|history_expired|message_missing|message_gaps_unresolved|scan_capacity|scan_incomplete|account_mismatch|message_mismatch|sender_ambiguous|message_time_invalid|reply_sync_disabled|(?:read|oauth)_[0-9]{3})$/.test(message)) return message;
  if (message.startsWith("Lifecycle storage failed:")) return "gmail_storage_error";
  if (error instanceof TypeError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) return "gmail_transport_error";
  return "gmail_unexpected_error";
}
