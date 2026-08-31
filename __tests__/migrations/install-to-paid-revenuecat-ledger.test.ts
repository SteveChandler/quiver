import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("install-to-paid RevenueCat ledger migration", () => {
  const sql = readFileSync(
    join(__dirname, "../../supabase/migrations/20260828130000_create_revenuecat_provider_event_ledger.sql"),
    "utf8",
  );
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();

  it("is transactional, idempotent by provider id, and immutable", () => {
    expect(sql).toMatch(/^\s*BEGIN;\s*$/m);
    expect(sql).toMatch(/^\s*COMMIT;\s*$/m);
    expect(normalized).toContain("provider_event_id text primary key");
    expect(normalized).toContain("revoke update, delete, truncate");
    expect(normalized).toContain("grant update (processed_at)");
    expect(normalized).toContain("for insert to service_role");
    expect(normalized).not.toContain("for update");
    expect(normalized).not.toContain("for delete");
    expect(normalized).toContain("assert_revenuecat_provider_events_shape");
    expect(normalized).toContain("raise exception 'revenuecat_provider_events schema conflict");
    expect(normalized).toContain("drop policy if exists \"service role reads revenuecat provider events\"");
    expect(normalized).toContain("drop policy if exists \"service role inserts revenuecat provider events\"");
    expect(sql.match(/ADD CONSTRAINT revenuecat_provider_events_/g)).toHaveLength(8);
    expect(normalized).toContain("primary key must be provider_event_id");
    expect(normalized).toContain("processed_at timestamptz");
  });

  it("stores only allowlisted fields and separates production from sandbox", () => {
    expect(normalized).toContain("environment in ('production', 'sandbox')");
    expect(normalized).toContain("app_user_id uuid");
    expect(normalized).toContain("app_user_id_status");
    expect(normalized).not.toContain("jsonb");
    expect(normalized).not.toContain("email");
    expect(normalized).not.toContain("payload jsonb");
  });

  it("enables RLS and exposes filtered PostHog-safe views", () => {
    expect(normalized).toContain("enable row level security");
    expect(normalized).toContain("posthog_export.install_to_paid_profiles");
    expect(normalized).toContain("posthog_export.revenuecat_provider_events");
    expect(normalized).toContain("posthog_export.revenuecat_unjoined_daily");
    expect(normalized).toContain("p.analytics_is_real_user = true");
    expect(normalized).toContain("coalesce(p.is_mock, false) = false");
    expect(normalized).toContain("coalesce(p.is_system_account, false) = false");
  });
});
