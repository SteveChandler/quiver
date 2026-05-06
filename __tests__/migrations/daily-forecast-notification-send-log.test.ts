import { readFileSync } from "fs";
import { join } from "path";

describe("daily forecast notification send log migration", () => {
  const migrationSQL = readFileSync(
    join(
      __dirname,
      "../../supabase/migrations/20260506143000_create_daily_forecast_notification_send_log.sql"
    ),
    "utf-8"
  );

  const normalizedSQL = migrationSQL.replace(/\s+/g, " ").toLowerCase();

  it("wraps the send log schema changes in a transaction", () => {
    expect(migrationSQL).toMatch(/^\s*BEGIN;\s*$/m);
    expect(migrationSQL).toMatch(/^\s*COMMIT;\s*$/m);
  });

  it("creates a durable notification send log with the daily forecast unique key", () => {
    expect(normalizedSQL).toContain("create table if not exists public.notification_send_log");
    expect(normalizedSQL).toContain("notification_type text not null");
    expect(normalizedSQL).toContain("local_forecast_date date not null");
    expect(normalizedSQL).toContain(
      "unique (user_id, beach_id, notification_type, local_forecast_date)"
    );
  });

  it("protects the send log with service-role-only RLS", () => {
    expect(normalizedSQL).toContain("alter table public.notification_send_log enable row level security");
    expect(normalizedSQL).toContain("notification_send_log_service_role_all");
    expect(normalizedSQL).toContain("auth.jwt() ->> 'role' = 'service_role'");
  });

  it("adds an atomic daily forecast claim RPC", () => {
    expect(normalizedSQL).toContain(
      "create or replace function public.claim_daily_forecast_notification_slot"
    );
    expect(normalizedSQL).toContain("returns boolean");
    expect(normalizedSQL).toContain(
      "on conflict (user_id, beach_id, notification_type, local_forecast_date)"
    );
    expect(normalizedSQL).toContain("return false;");
    expect(normalizedSQL).toContain("return true;");
  });
});
