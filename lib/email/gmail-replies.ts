import { z } from "zod";
import { lifecycleRpc } from "@/lib/email/lifecycle";

const listSchema = z.object({ messages: z.array(z.object({ id: z.string().min(1) })).optional(), nextPageToken: z.string().optional() });
const labelsSchema = z.object({ labels: z.array(z.object({ id: z.string().min(1), name: z.string() })).optional() });
const messageSchema = z.object({
  id: z.string().min(1), threadId: z.string().min(1), internalDate: z.string().regex(/^\d+$/), labelIds: z.array(z.string()).optional(),
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
  if (response.status === 404 && path.startsWith("messages/")) throw new Error("gmail_message_missing");
  if (!response.ok) throw new Error(`gmail_read_${response.status}`);
  return response.json();
}

async function accessToken(fetchImpl: typeof fetch, deadline: AbortSignal): Promise<string> {
  const config = z.object({ clientId: z.string().min(1), clientSecret: z.string().min(1), refreshToken: z.string().min(1) }).parse({
    clientId: process.env.EMAIL_GMAIL_CLIENT_ID, clientSecret: process.env.EMAIL_GMAIL_CLIENT_SECRET, refreshToken: process.env.EMAIL_GMAIL_REFRESH_TOKEN,
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.any([deadline, AbortSignal.timeout(10_000)]),
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken }),
  });
  if (!response.ok) throw new Error(`gmail_oauth_${response.status}`);
  return z.object({ access_token: z.string().min(1) }).parse(await response.json()).access_token;
}

export async function checkGmailRepliesBeforeSend(fetchImpl: typeof fetch = fetch): Promise<{ checked: number; recorded: number }> {
  const account = z.email().parse(process.env.EMAIL_GMAIL_ACCOUNT).toLowerCase();
  const replyTo = z.email().parse(process.env.EMAIL_REPLY_MAILBOX).toLowerCase();
  const deadline = AbortSignal.timeout(40_000);
  const token = await accessToken(fetchImpl, deadline);
  const profile = z.object({ emailAddress: z.email() }).parse(await gmailGet("profile", token, fetchImpl, deadline));
  if (profile.emailAddress.toLowerCase() !== account) throw new Error("gmail_account_mismatch");
  const labelName = z.string().trim().min(1).parse(process.env.EMAIL_GMAIL_REPLY_LABEL ?? "quiver-support").toLowerCase();
  const labels = labelsSchema.parse(await gmailGet("labels", token, fetchImpl, deadline)).labels ?? [];
  const label = labels.find(candidate => candidate.name.toLowerCase() === labelName);
  if (!label) throw new Error("gmail_label_missing");

  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({ labelIds: label.id, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const result = listSchema.parse(await gmailGet(`messages?${params}`, token, fetchImpl, deadline));
    for (const message of result.messages ?? []) if (!ids.includes(message.id)) ids.push(message.id);
    pageToken = result.nextPageToken;
    if (!pageToken) break;
  }
  if (ids.length === 0) return { checked: 0, recorded: 0 };

  const unknownIds = z.array(z.string()).parse(await lifecycleRpc("gmail_reply_known", { p_message_ids: ids }));
  let recorded = 0;
  for (const id of unknownIds) {
    let message: z.infer<typeof messageSchema>;
    try {
      const params = new URLSearchParams({ format: "metadata" });
      for (const header of metadataHeaders) params.append("metadataHeaders", header);
      message = messageSchema.parse(await gmailGet(`messages/${encodeURIComponent(id)}?${params}`, token, fetchImpl, deadline));
    } catch (error) {
      if (error instanceof Error && error.message === "gmail_message_missing") {
        console.debug("Gmail reply disappeared between list and metadata fetch", { message_id: id });
        continue;
      }
      throw error;
    }
    const headers = (name: string): string => message.payload.headers.filter(header => header.name.toLowerCase() === name.toLowerCase()).map(header => header.value).join(",");
    const recipients = addresses([headers("To"), headers("Cc"), headers("Delivered-To"), headers("X-Forwarded-To")].join(","));
    if (message.labelIds?.some(label => label === "SENT" || label === "DRAFT") || !recipients.includes(replyTo)) continue;
    const from = addresses(headers("From"));
    if (from.length !== 1) throw new Error("gmail_sender_ambiguous");
    if (from[0] === account || from[0] === replyTo) continue;
    const receivedAt = new Date(Number(message.internalDate));
    if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 60_000) throw new Error("gmail_message_time_invalid");
    await lifecycleRpc("record_gmail_reply_v2", { p_mailbox: account, p_message_id: message.id, p_thread_id: message.threadId,
      p_sender: from[0], p_received_at: receivedAt.toISOString(), p_in_reply_to: headers("In-Reply-To").slice(0, 512) || null });
    recorded++;
  }
  return { checked: unknownIds.length, recorded };
}

export function gmailFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/^gmail_(?:label_missing|message_missing|account_mismatch|sender_ambiguous|message_time_invalid|(?:read|oauth)_[0-9]{3})$/.test(message)) return message;
  if (error instanceof TypeError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) return "gmail_transport_error";
  return "gmail_unexpected_error";
}
