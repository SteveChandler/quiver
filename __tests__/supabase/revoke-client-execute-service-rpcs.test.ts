import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261020230000_revoke_client_execute_on_service_rpcs.sql",
  ),
  "utf8",
);

const SERVICE_ONLY_FUNCTIONS = [
  "public.bulk_update_hrrr_wind(jsonb)",
  "public.update_open_meteo_wind_for_beach(uuid, jsonb)",
  "public.claim_notification_delivery_targets(uuid, text[], uuid)",
  "public.finalize_notification_delivery_target(uuid, uuid, bigint, text, jsonb, text)",
  "public.try_insert_system_feed_post(uuid, uuid, numeric, numeric, text, text, text, boolean, text, jsonb, timestamptz, timestamptz, integer, integer, integer)",
  "public.repair_strict_session_snapshots(integer, boolean)",
  "public.strict_session_snapshot_repair_candidates(integer)",
];

describe("revoke client execute on service-only RPCs migration", () => {
  it("runs in one transaction", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
  });

  it.each(SERVICE_ONLY_FUNCTIONS)(
    "removes client roles and keeps service_role on %s",
    (signature) => {
      expect(migration).toContain(
        `REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated;`,
      );
      expect(migration).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`,
      );
    },
  );

  it("leaves RPCs that clients call as themselves untouched", () => {
    for (const name of [
      "get_nearby_beaches",
      "compute_session_tide_snapshot",
      "register_device_installation",
      "register_legacy_device_token",
    ]) {
      expect(migration).not.toContain(`public.${name}(`);
    }
  });
});
