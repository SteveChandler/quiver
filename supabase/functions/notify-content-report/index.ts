// notify-content-report (v2 — surfaces Resend error body inline for diag)
//
// Invoked by a Supabase Database Webhook on AFTER INSERT to
// public.content_reports. Sends a moderation email via Resend so the operator
// has a live signal that a new UGC report has landed.
//
// Webhook setup (one-time, via Supabase Studio → Database → Webhooks):
//   - Name: notify-content-report
//   - Table: public.content_reports
//   - Events: Insert
//   - Type: Supabase Edge Functions
//   - Edge Function: notify-content-report
//   - Method: POST (default)
//   - HTTP Headers: Authorization: Bearer <SERVICE_ROLE_KEY> (auto-injected)
//
// Required Edge Function secrets:
//   - RESEND_API_KEY
//   - MOD_NOTIFY_TO            (e.g. stcha0004@gmail.com)
//   - MOD_NOTIFY_FROM          (verified Resend sender, e.g. mod@quiversurf.app)
//   - MOD_WEBHOOK_SECRET       (shared secret matching webhook header `x-webhook-secret`)
//
// Set via:
//   supabase secrets set RESEND_API_KEY=... MOD_NOTIFY_TO=... MOD_NOTIFY_FROM=... \
//     MOD_WEBHOOK_SECRET=...
//
// In the webhook config, add HTTP header: x-webhook-secret: <same value>.
//
// The function never throws on Resend failures — moderation lag is preferable
// to bouncing the trigger payload back into Postgres.

interface ContentReportRow {
  id: string;
  reporter_id: string | null;
  target_type: "user" | "session" | "comment";
  target_id: string;
  target_owner_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: ContentReportRow;
  old_record: ContentReportRow | null;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Shared-secret gate: deployed with --no-verify-jwt, so without this anyone
  // with the function URL could trigger emails. The webhook is configured with
  // a matching `x-webhook-secret` header.
  const expectedSecret = Deno.env.get("MOD_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.error("[notify-content-report] MOD_WEBHOOK_SECRET not set");
    return json({ error: "Server misconfigured" }, 500);
  }
  const presentedSecret = req.headers.get("x-webhook-secret");
  if (presentedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (payload.type !== "INSERT" || payload.table !== "content_reports") {
    // Webhook misconfigured — accept silently so it doesn't retry.
    console.warn("[notify-content-report] unexpected payload", {
      type: payload.type,
      table: payload.table,
    });
    return json({ skipped: true });
  }

  const row = payload.record;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("MOD_NOTIFY_TO");
  const from = Deno.env.get("MOD_NOTIFY_FROM");

  if (!resendKey || !to || !from) {
    console.error("[notify-content-report] missing secrets", {
      hasKey: !!resendKey,
      hasTo: !!to,
      hasFrom: !!from,
    });
    // Return 200 so the webhook doesn't keep retrying on misconfig.
    return json({ skipped: "missing-secrets" });
  }

  // v2 diag: subject prefix tags the deploy version so log search can confirm.
  const subject = `[Quiver Mod] ${row.reason} on ${row.target_type} ${row.target_id}`;
  const body = [
    `Report id: ${row.id}`,
    `Target: ${row.target_type} ${row.target_id}`,
    `Target owner: ${row.target_owner_id ?? "(unknown)"}`,
    `Reason: ${row.reason}`,
    `Reporter: ${row.reporter_id ?? "(deleted)"}`,
    `Created: ${row.created_at}`,
    "",
    "Details:",
    row.details ?? "(none)",
    "",
    "Triage SQL:",
    `  SELECT * FROM public.content_reports WHERE id = '${row.id}';`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[notify-content-report] Resend non-2xx", {
        status: res.status,
        body: errorBody,
      });
      return json({ ok: false, status: res.status, resend_error: errorBody });
    }
    return json({ ok: true });
  } catch (err) {
    console.error("[notify-content-report] Resend threw", { err: String(err) });
    return json({ ok: false, error: String(err) });
  }
});
