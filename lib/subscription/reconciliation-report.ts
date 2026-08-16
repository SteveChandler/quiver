import {
  isPaidLifetimeProductId,
  isPromotionalProductId,
} from "./revenuecat-products";

/**
 * Read-only RevenueCat mirror reconciliation.
 *
 * Classification deliberately requires an explicit RevenueCat environment for
 * production-paid rows. Rows without a raw event stay visible as `unknown`
 * rather than being promoted into production revenue reporting.
 */

export const ENTITLEMENT_SEGMENTS = [
  "production-paid",
  "promo-lifetime",
  "billing-issue",
  "trial",
  "lapsed",
  "sandbox",
  "mock-test",
  "unknown",
] as const;

export type EntitlementSegment = (typeof ENTITLEMENT_SEGMENTS)[number];

export interface ReconciliationEntitlementRow {
  user_id: string;
  is_pro?: boolean | null;
  is_trialing?: boolean | null;
  expires_at?: string | null;
  lapsed_at?: string | null;
  billing_issue?: boolean | null;
  product_id?: string | null;
  rc_raw?: unknown;
  is_mock?: boolean | null;
  /** False when the entitlement has no matching profile row. */
  profile_found?: boolean;
}

export interface FailedWebhookQueueRow {
  id: string;
  user_id?: string | null;
  event_type?: string | null;
  retry_count?: number | null;
  received_at?: string | null;
  last_retried_at?: string | null;
}

export interface EntitlementReconciliationReport {
  generated_at: string;
  read_only: true;
  entitlements: {
    total: number;
    by_segment: Record<EntitlementSegment, number>;
  };
  failed_webhook_queue: {
    pending_count: number;
    retry_count: number;
    by_event_type: Record<string, number>;
  };
}

export const RECONCILIATION_PAGE_SIZE = 1000;

export interface ReadPageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

function rawEvent(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function rawString(event: Record<string, unknown>, key: string): string | null {
  const value = event[key];
  return typeof value === "string" ? value.toUpperCase() : null;
}

function isExpired(row: ReconciliationEntitlementRow, nowMs: number): boolean {
  if (!row.expires_at) return false;
  const expiresAt = Date.parse(row.expires_at);
  return Number.isFinite(expiresAt) && expiresAt < nowMs;
}

export function classifyEntitlement(
  row: ReconciliationEntitlementRow,
  now = new Date(),
): EntitlementSegment {
  const event = rawEvent(row.rc_raw);
  const eventType = rawString(event, "type");
  const environment = rawString(event, "environment");
  const periodType = rawString(event, "period_type");

  if (row.profile_found === false) return "unknown";
  if (row.is_mock === true || eventType === "TEST") return "mock-test";
  if (environment === "SANDBOX") return "sandbox";

  // Keep grace-period/problem accounts out of both paid and lapsed totals.
  // This remains true even when expires_at is in the past: RC can retain
  // access during a billing retry window.
  if (row.billing_issue === true) return "billing-issue";

  // Explicit lapsed state wins over a stale is_pro flag. A billing issue is a
  // grace-period state and must not be counted as lapsed until RC expires it.
  if (row.lapsed_at || isExpired(row, now.getTime())) {
    return "lapsed";
  }

  if (row.is_trialing === true || periodType === "TRIAL") return "trial";

  const productId = row.product_id ?? "";
  if (isPromotionalProductId(productId)) {
    return "promo-lifetime";
  }

  if (isPaidLifetimeProductId(productId) && row.expires_at == null) {
    return environment === "PRODUCTION" ? "production-paid" : "unknown";
  }

  if (environment === "PRODUCTION" && row.is_pro === true) {
    return "production-paid";
  }

  return "unknown";
}

export function buildReadPageRange(
  page: number,
  pageSize = RECONCILIATION_PAGE_SIZE,
): { from: number; to: number } {
  if (!Number.isInteger(page) || page < 0) {
    throw new Error("page must be a non-negative integer");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer");
  }
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
}

export async function readAllRows<T>(
  readPage: (range: { from: number; to: number }) => Promise<ReadPageResult<T>>,
  pageSize = RECONCILIATION_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page += 1) {
    const range = buildReadPageRange(page, pageSize);
    const { data, error } = await readPage(range);
    if (error) throw new Error(error.message);
    const pageRows = data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return rows;
  }
}

export function chunkReadIds<T>(
  values: readonly T[],
  chunkSize = RECONCILIATION_PAGE_SIZE,
): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize must be a positive integer");
  }
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function countByEventType(rows: FailedWebhookQueueRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const eventType = row.event_type?.trim() || "unknown";
    counts[eventType] = (counts[eventType] ?? 0) + 1;
    return counts;
  }, {});
}

export function buildEntitlementReconciliationReport(
  rows: ReconciliationEntitlementRow[],
  failedWebhookRows: FailedWebhookQueueRow[],
  now = new Date(),
): EntitlementReconciliationReport {
  const bySegment = Object.fromEntries(
    ENTITLEMENT_SEGMENTS.map((segment) => [segment, 0]),
  ) as Record<EntitlementSegment, number>;

  for (const row of rows) {
    bySegment[classifyEntitlement(row, now)] += 1;
  }

  return {
    generated_at: now.toISOString(),
    read_only: true,
    entitlements: {
      total: rows.length,
      by_segment: bySegment,
    },
    failed_webhook_queue: {
      pending_count: failedWebhookRows.length,
      retry_count: failedWebhookRows.reduce(
        (sum, row) => sum + Math.max(0, row.retry_count ?? 0),
        0,
      ),
      by_event_type: countByEventType(failedWebhookRows),
    },
  };
}
