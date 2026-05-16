import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

type Source = "all" | "user-events" | "email" | "notifications";

interface CliOptions {
  source: Source;
  since?: string;
  until?: string;
  limit?: number;
  batchSize: number;
  confirmSend: boolean;
  includeMockUsers: boolean;
}

interface PostHogEvent {
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

interface UserEventRow {
  id: string;
  user_id: string | null;
  session_id?: string | null;
  event_type: string;
  beach_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface EmailSendLogRow {
  id: string;
  user_id: string;
  email_type: string;
  local_date: string | null;
  sent_at: string | null;
  best_score: number | null;
  best_beach_id: string | null;
  meta: Record<string, unknown> | null;
  resend_message_id: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
}

interface NotificationEventJoinRow {
  recipient_user_id?: string | null;
  actor_user_id?: string | null;
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
}

interface NotificationDeliveryAttemptRow {
  id: string;
  notification_event_id: string;
  channel: string;
  status: string;
  provider_response: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  notification_events?: NotificationEventJoinRow | NotificationEventJoinRow[] | null;
}

interface ImportStats {
  scanned: number;
  skippedMock: number;
  skippedInvalid: number;
  prepared: number;
  sent: number;
}

const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1000;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    source: "all",
    batchSize: DEFAULT_BATCH_SIZE,
    confirmSend: false,
    includeMockUsers: false,
  };

  for (const arg of argv) {
    if (arg === "--confirm-send") {
      options.confirmSend = true;
      continue;
    }
    if (arg === "--include-mock-users") {
      options.includeMockUsers = true;
      continue;
    }

    const [key, value] = arg.split("=", 2);
    if (!value) continue;

    if (key === "--source") {
      if (!["all", "user-events", "email", "notifications"].includes(value)) {
        throw new Error("--source must be all, user-events, email, or notifications");
      }
      options.source = value as Source;
    } else if (key === "--since") {
      options.since = requireIsoDate(value, "--since");
    } else if (key === "--until") {
      options.until = requireIsoDate(value, "--until");
    } else if (key === "--limit") {
      options.limit = requirePositiveInteger(value, "--limit");
    } else if (key === "--batch-size") {
      options.batchSize = Math.min(
        requirePositiveInteger(value, "--batch-size"),
        MAX_BATCH_SIZE
      );
    }
  }

  return options;
}

function requireIsoDate(value: string, flag: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${flag} must be a valid ISO date`);
  }
  return date.toISOString();
}

function requirePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (depth >= 3) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return undefined;

  const cleaned: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("email") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("password") ||
      normalizedKey === "to" ||
      normalizedKey === "from"
    ) {
      continue;
    }

    const sanitized = sanitizeValue(nestedValue, depth + 1);
    if (sanitized !== undefined) cleaned[key] = sanitized;
  }
  return cleaned;
}

function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeValue(properties);
  return isRecord(sanitized) ? sanitized : {};
}

function summarizeProviderResponse(
  response: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!response) return {};

  return {
    provider_success: typeof response.success === "number" ? response.success : undefined,
    provider_failed: typeof response.failed === "number" ? response.failed : undefined,
    provider_invalid_token_count: Array.isArray(response.invalidTokens)
      ? response.invalidTokens.length
      : undefined,
    provider_error_count: Array.isArray(response.errors)
      ? response.errors.length
      : undefined,
    provider_reason:
      typeof response.reason === "string" ? response.reason : undefined,
  };
}

async function sendPostHogBatch(
  host: string,
  apiKey: string,
  events: PostHogEvent[]
): Promise<void> {
  if (events.length === 0) return;

  const response = await fetch(`${host.replace(/\/$/, "")}/batch/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      batch: events,
      historical_migration: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PostHog batch failed: ${response.status} ${body}`);
  }
}

async function getExcludedUserIds(
  supabase: ReturnType<typeof createClient>,
  includeMockUsers: boolean
): Promise<Set<string>> {
  if (includeMockUsers) return new Set();

  const excluded = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, is_mock")
      .eq("is_mock", true)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    for (const row of data ?? []) {
      if (typeof row.id === "string") excluded.add(row.id);
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return excluded;
}

async function importUserEvents(
  supabase: ReturnType<typeof createClient>,
  posthogHost: string,
  posthogKey: string,
  excludedUserIds: Set<string>,
  options: CliOptions
): Promise<ImportStats> {
  const stats: ImportStats = {
    scanned: 0,
    skippedMock: 0,
    skippedInvalid: 0,
    prepared: 0,
    sent: 0,
  };

  let from = 0;
  let remaining = options.limit ?? Number.POSITIVE_INFINITY;

  while (remaining > 0) {
    const pageSize = Math.min(options.batchSize, remaining);
    let query = supabase
      .from("user_events")
      .select("id, user_id, session_id, event_type, beach_id, metadata, created_at")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (options.since) query = query.gte("created_at", options.since);
    if (options.until) query = query.lte("created_at", options.until);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as UserEventRow[];
    if (rows.length === 0) break;

    const events: PostHogEvent[] = [];
    for (const row of rows) {
      stats.scanned += 1;

      if (row.user_id && excludedUserIds.has(row.user_id)) {
        stats.skippedMock += 1;
        continue;
      }

      const distinctId = row.user_id ?? (row.session_id ? `anon:${row.session_id}` : null);
      if (!distinctId || !row.created_at || !row.event_type) {
        stats.skippedInvalid += 1;
        continue;
      }

      events.push({
        event: row.event_type,
        distinct_id: distinctId,
        timestamp: row.created_at,
        properties: sanitizeProperties({
          ...(row.metadata ?? {}),
          beach_id: row.beach_id,
          import_source: "supabase_user_events",
          original_event_id: row.id,
          $insert_id: `supabase_user_events:${row.id}`,
        }),
      });
    }

    stats.prepared += events.length;
    if (options.confirmSend) {
      await sendPostHogBatch(posthogHost, posthogKey, events);
      stats.sent += events.length;
    }

    if (rows.length < pageSize) break;
    from += rows.length;
    remaining -= rows.length;
  }

  return stats;
}

function buildEmailEvents(row: EmailSendLogRow): PostHogEvent[] {
  const baseProperties = sanitizeProperties({
    email_type: row.email_type,
    local_date: row.local_date,
    best_score: row.best_score,
    best_beach_id: row.best_beach_id,
    meta: row.meta ?? {},
    resend_message_id: row.resend_message_id,
    import_source: "supabase_email_send_log",
    original_email_log_id: row.id,
  });

  const specs: Array<{ event: string; timestamp: string | null }> = [
    { event: "email_sent", timestamp: row.sent_at },
    { event: "email_delivered", timestamp: row.delivered_at },
    { event: "email_opened", timestamp: row.opened_at },
    { event: "email_clicked", timestamp: row.clicked_at },
    { event: "email_bounced", timestamp: row.bounced_at },
  ];

  return specs
    .filter((spec) => spec.timestamp)
    .map((spec) => ({
      event: spec.event,
      distinct_id: row.user_id,
      timestamp: spec.timestamp as string,
      properties: {
        ...baseProperties,
        resend_event_type: spec.event.replace("email_", "email."),
        $insert_id: `email_send_log:${row.id}:${spec.event}`,
      },
    }));
}

async function importEmailEvents(
  supabase: ReturnType<typeof createClient>,
  posthogHost: string,
  posthogKey: string,
  excludedUserIds: Set<string>,
  options: CliOptions
): Promise<ImportStats> {
  const stats: ImportStats = {
    scanned: 0,
    skippedMock: 0,
    skippedInvalid: 0,
    prepared: 0,
    sent: 0,
  };

  let from = 0;
  let remaining = options.limit ?? Number.POSITIVE_INFINITY;

  while (remaining > 0) {
    const pageSize = Math.min(options.batchSize, remaining);
    let query = supabase
      .from("email_send_log")
      .select(
        "id, user_id, email_type, local_date, sent_at, best_score, best_beach_id, meta, resend_message_id, delivered_at, opened_at, clicked_at, bounced_at"
      )
      .order("sent_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (options.since) query = query.gte("sent_at", options.since);
    if (options.until) query = query.lte("sent_at", options.until);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as EmailSendLogRow[];
    if (rows.length === 0) break;

    const events: PostHogEvent[] = [];
    for (const row of rows) {
      stats.scanned += 1;

      if (!row.user_id) {
        stats.skippedInvalid += 1;
        continue;
      }
      if (excludedUserIds.has(row.user_id)) {
        stats.skippedMock += 1;
        continue;
      }

      events.push(...buildEmailEvents(row));
    }

    stats.prepared += events.length;
    if (options.confirmSend) {
      for (let index = 0; index < events.length; index += options.batchSize) {
        const chunk = events.slice(index, index + options.batchSize);
        await sendPostHogBatch(posthogHost, posthogKey, chunk);
        stats.sent += chunk.length;
      }
    }

    if (rows.length < pageSize) break;
    from += rows.length;
    remaining -= rows.length;
  }

  return stats;
}

function normalizeNotificationEventJoin(
  value: NotificationDeliveryAttemptRow["notification_events"]
): NotificationEventJoinRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildNotificationDeliveryEvent(
  row: NotificationDeliveryAttemptRow
): PostHogEvent | null {
  const notificationEvent = normalizeNotificationEventJoin(row.notification_events);
  const distinctId = notificationEvent?.recipient_user_id;
  if (!distinctId || !row.created_at) return null;

  return {
    event: "notification_delivery_attempt",
    distinct_id: distinctId,
    timestamp: row.created_at,
    properties: sanitizeProperties({
      $insert_id: `notification_delivery_attempt:${row.id}`,
      notification_attempt_id: row.id,
      notification_event_id: row.notification_event_id,
      notification_type: notificationEvent.type,
      notification_channel: row.channel,
      notification_status: row.status,
      notification_entity_type: notificationEvent.entity_type,
      notification_entity_id: notificationEvent.entity_id,
      has_actor: Boolean(notificationEvent.actor_user_id),
      event_created_at: notificationEvent.created_at,
      has_error_message: Boolean(row.error_message),
      import_source: "notification_delivery_attempts",
      ...summarizeProviderResponse(row.provider_response),
    }),
  };
}

async function importNotificationEvents(
  supabase: ReturnType<typeof createClient>,
  posthogHost: string,
  posthogKey: string,
  excludedUserIds: Set<string>,
  options: CliOptions
): Promise<ImportStats> {
  const stats: ImportStats = {
    scanned: 0,
    skippedMock: 0,
    skippedInvalid: 0,
    prepared: 0,
    sent: 0,
  };

  let from = 0;
  let remaining = options.limit ?? Number.POSITIVE_INFINITY;

  while (remaining > 0) {
    const pageSize = Math.min(options.batchSize, remaining);
    let query = supabase
      .from("notification_delivery_attempts")
      .select(
        "id, notification_event_id, channel, status, provider_response, error_message, created_at, notification_events!inner(recipient_user_id, actor_user_id, type, entity_type, entity_id, payload, created_at)"
      )
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (options.since) query = query.gte("created_at", options.since);
    if (options.until) query = query.lte("created_at", options.until);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as NotificationDeliveryAttemptRow[];
    if (rows.length === 0) break;

    const events: PostHogEvent[] = [];
    for (const row of rows) {
      stats.scanned += 1;
      const notificationEvent = normalizeNotificationEventJoin(row.notification_events);
      const recipientUserId = notificationEvent?.recipient_user_id ?? null;

      if (!recipientUserId) {
        stats.skippedInvalid += 1;
        continue;
      }
      if (excludedUserIds.has(recipientUserId)) {
        stats.skippedMock += 1;
        continue;
      }

      const event = buildNotificationDeliveryEvent(row);
      if (!event) {
        stats.skippedInvalid += 1;
        continue;
      }
      events.push(event);
    }

    stats.prepared += events.length;
    if (options.confirmSend) {
      for (let index = 0; index < events.length; index += options.batchSize) {
        const chunk = events.slice(index, index + options.batchSize);
        await sendPostHogBatch(posthogHost, posthogKey, chunk);
        stats.sent += chunk.length;
      }
    }

    if (rows.length < pageSize) break;
    from += rows.length;
    remaining -= rows.length;
  }

  return stats;
}

function printStats(label: string, stats: ImportStats): void {
  console.log(JSON.stringify({ source: label, ...stats }, null, 2));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim();
  const supabaseServiceKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const posthogKey = getRequiredEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN");
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!supabaseUrl) {
    throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const excludedUserIds = await getExcludedUserIds(supabase, options.includeMockUsers);

  console.log(
    JSON.stringify(
      {
        mode: options.confirmSend ? "send" : "dry-run",
        source: options.source,
        since: options.since ?? null,
        until: options.until ?? null,
        limit: options.limit ?? null,
        batchSize: options.batchSize,
        excludedMockUsers: excludedUserIds.size,
      },
      null,
      2
    )
  );

  if (options.source === "all" || options.source === "user-events") {
    const stats = await importUserEvents(
      supabase,
      posthogHost,
      posthogKey,
      excludedUserIds,
      options
    );
    printStats("user-events", stats);
  }

  if (options.source === "all" || options.source === "email") {
    const stats = await importEmailEvents(
      supabase,
      posthogHost,
      posthogKey,
      excludedUserIds,
      options
    );
    printStats("email", stats);
  }

  if (options.source === "all" || options.source === "notifications") {
    const stats = await importNotificationEvents(
      supabase,
      posthogHost,
      posthogKey,
      excludedUserIds,
      options
    );
    printStats("notifications", stats);
  }

  if (!options.confirmSend) {
    console.log("Dry run only. Add --confirm-send to import these events into PostHog.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
