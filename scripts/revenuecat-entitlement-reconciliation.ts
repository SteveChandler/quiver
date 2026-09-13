#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

import {
  buildEntitlementReconciliationReport,
  chunkReadIds,
  readAllRows,
  type FailedWebhookQueueRow,
  type ReconciliationEntitlementRow,
  type RevenueCatLifecycleEventRow,
} from "../lib/subscription/reconciliation-report";
import { loadSeoEnv } from "./seo/load-env";

async function main(): Promise<void> {
  loadSeoEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const lifecycleWindowStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [entitlementRows, failedRows, lifecycleRows] = await Promise.all([
    readAllRows(async ({ from, to }) =>
      supabase
        .from("user_entitlements")
        .select(
          "user_id,is_pro,is_trialing,will_renew,expires_at,lapsed_at,billing_issue,product_id,rc_raw",
        )
        .order("user_id", { ascending: true })
        .range(from, to),
    ),
    readAllRows(async ({ from, to }) =>
      supabase
        .from("user_entitlements_failed_webhooks")
        .select("id,user_id,event_type,retry_count,received_at,last_retried_at")
        .order("received_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAllRows(async ({ from, to }) =>
      supabase
        .from("revenuecat_provider_events")
        .select("app_user_id,event_type,event_timestamp,environment")
        .in("event_type", ["CANCELLATION", "UNCANCELLATION", "EXPIRATION"])
        .gte("event_timestamp", lifecycleWindowStart)
        .lte("event_timestamp", now.toISOString())
        .order("event_timestamp", { ascending: true })
        .range(from, to),
    ),
  ]);

  const userIds = [...new Set([
    ...entitlementRows.map((row) => row.user_id),
    ...(lifecycleRows ?? []).flatMap((row) => typeof row.app_user_id === "string" ? [row.app_user_id] : []),
  ])];
  const profileResults = await Promise.all(
    chunkReadIds(userIds).map((ids) =>
      supabase.from("profiles").select("id,is_mock").in("id", ids),
    ),
  );
  const profileError = profileResults.find((result) => result.error)?.error;
  if (profileError) {
    throw new Error(`profiles read failed: ${profileError.message}`);
  }
  const profileRows = profileResults.flatMap((result) => result.data ?? []);

  const mockByUserId = new Map(
    (profileRows ?? []).map((row) => [row.id, row.is_mock]),
  );
  const profileIds = new Set((profileRows ?? []).map((row) => row.id));

  const report = buildEntitlementReconciliationReport(
    (entitlementRows ?? []).map((row) => ({
      ...row,
      is_mock: mockByUserId.get(row.user_id) ?? false,
      profile_found: profileIds.has(row.user_id),
    })) as ReconciliationEntitlementRow[],
    (failedRows ?? []) as FailedWebhookQueueRow[],
    (lifecycleRows ?? []).map((row) => ({
      ...row,
      is_mock: typeof row.app_user_id === "string" ? mockByUserId.get(row.app_user_id) ?? false : false,
      profile_found: typeof row.app_user_id === "string" && profileIds.has(row.app_user_id),
    })) as RevenueCatLifecycleEventRow[],
    now,
  );

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`RevenueCat reconciliation report failed: ${message}`);
  process.exitCode = 1;
});
