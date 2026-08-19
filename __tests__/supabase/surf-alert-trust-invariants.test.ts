import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260818120000_surf_alert_trust_invariants.sql",
  ),
  "utf8",
);
const integration = readFileSync(
  join(
    process.cwd(),
    "supabase/tests/surf_alert_trust_invariants_integration.sql",
  ),
  "utf8",
);

describe("surf alert trust invariant migration", () => {
  it("keeps producer dedupe permanent and refuses duplicate history without deleting it", () => {
    expect(migration).toContain("notification_events_home_morning_call_dedupe");
    expect(migration).toContain(
      "RAISE EXCEPTION 'home_morning_call dedupe duplicates exist",
    );
    expect(migration).not.toMatch(
      /DELETE\s+FROM\s+public\.notification_events/i,
    );
  });

  it("stages install-scoped identity without a destructive global token retrofit", () => {
    expect(migration).toContain("user_devices_active_installation");
    expect(migration).toContain("ON public.user_devices (installation_id)");
    expect(migration).toContain(
      "DROP INDEX IF EXISTS public.user_devices_active_installation",
    );
    expect(migration).toContain(
      "ON CONFLICT (installation_id) WHERE installation_id IS NOT NULL AND retired_at IS NULL",
    );
    expect(migration).not.toMatch(
      /CREATE UNIQUE INDEX[^;]+ON public\.user_devices \(device_token\)/i,
    );
    expect(migration).toContain("device_token = p_device_token");
    expect(migration).toContain("user_id IS NOT DISTINCT FROM p_user_id");
    expect(migration).toContain(
      "installation_id IS NOT DISTINCT FROM p_installation_id",
    );
    expect(migration).toContain(
      "installation_id IS NOT NULL AND retired_at IS NULL",
    );
    expect(migration).toContain("LEAST(v_installation_lock, v_token_lock)");
    expect(migration).toContain("GREATEST(v_installation_lock, v_token_lock)");
    expect(migration).toContain(
      "installation_id = p_installation_id OR device_token = p_device_token",
    );
    expect(migration).toContain("p_installation_id IS NULL");
    expect(migration).toContain("p_device_token IS NULL");
  });

  it("makes ambiguous stale sends terminal and protects finalization by claim version", () => {
    expect(migration).toContain("SET status = 'unknown'");
    expect(migration).toContain("status IN ('pending', 'failed')");
    expect(migration).toContain("claim_id = p_claim_id");
    expect(migration).toContain("claim_version = p_claim_version");
  });

  it("does not expose delivery RPCs to PUBLIC", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.claim_notification_delivery_targets(uuid,text[],uuid) FROM PUBLIC",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.claim_notification_delivery_targets(uuid,text[],uuid) TO service_role",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.finalize_notification_delivery_target(uuid,uuid,bigint,text,jsonb,text) FROM PUBLIC",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.finalize_notification_delivery_target(uuid,uuid,bigint,text,jsonb,text) TO service_role",
    );
  });

  it("ships an executable database contract for registration and delivery claims", () => {
    expect(integration).toContain("register_device_installation");
    expect(integration).toContain("register_legacy_device_token");
    expect(integration).toContain("claim_notification_delivery_targets");
    expect(integration).toContain("finalize_notification_delivery_target");
    expect(integration).toContain(
      "RAISE EXCEPTION 'identified registration erased omitted metadata'",
    );
    expect(integration).toContain("ROLLBACK;");
  });
});
