import fs from "node:fs";
import path from "node:path";
import { hasTransactionOrBackfilledMetadata } from "../../test-utils/migration-test-utils";

const migrationPath: string = path.join(
  process.cwd(),
  "supabase/migrations/20260727231500_create_trusted_external_forecast_adjustments.sql",
);
const sql: string = fs.readFileSync(migrationPath, "utf8");

/** Everything before the trailing commented-out rollback block. */
const executableSql: string = sql.split(
  "-- ROLLBACK (additive migration; run as the owner to reverse it exactly)",
)[0];

const TRUSTED_TABLES: readonly string[] = [
  "trusted_forecast_ingest_runs",
  "trusted_forecast_ingest_source_results",
  "trusted_forecast_issues",
  "trusted_forecast_decisions",
  "trusted_forecast_applications",
  "trusted_forecast_alerts",
  "trusted_forecast_build_receipts",
];

describe("trusted external forecast adjustments migration — safety", () => {
  it("is transactional and additive", () => {
    expect(hasTransactionOrBackfilledMetadata(sql)).toBe(true);
    expect(executableSql.trimStart().startsWith("--")).toBe(true);
    expect(executableSql).toContain("BEGIN;");
    expect(executableSql).toContain("COMMIT;");
  });

  it("contains no bulk delete, truncate, or drop of an existing object", () => {
    expect(executableSql).not.toMatch(/\bTRUNCATE\b/i);
    expect(executableSql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(executableSql).not.toMatch(/\bDROP\s+(TABLE|VIEW|COLUMN|SCHEMA)\b/i);
    expect(executableSql).not.toMatch(/\bALTER\s+TABLE\s+auth\./i);
  });

  it("never mutates existing prediction snapshots", () => {
    expect(executableSql).not.toMatch(/UPDATE\s+public\.ml_predictions_log/i);
    expect(executableSql).toContain("ON CONFLICT (");
    expect(executableSql).toContain("display_source\n      ) DO NOTHING");
  });

  it("carries a rollback block for every object it creates", () => {
    const rollback: string = sql.slice(executableSql.length);
    for (const table of TRUSTED_TABLES) {
      expect(rollback).toContain(`-- DROP TABLE IF EXISTS public.${table};`);
    }
    expect(rollback).toContain(
      "-- DROP FUNCTION IF EXISTS public.persist_trusted_forecast_build(jsonb);",
    );
    expect(rollback).toContain(
      "-- DROP FUNCTION IF EXISTS public.acknowledge_trusted_forecast_alert(jsonb);",
    );
  });
});

describe("trusted external forecast adjustments migration — object contract", () => {
  it("creates all seven private append-only tables", () => {
    for (const table of TRUSTED_TABLES) {
      expect(executableSql).toContain(`CREATE TABLE public.${table} (`);
      expect(executableSql).toMatch(
        new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY;`),
      );
    }
  });

  it("carries the four columns 21-01 emits today", () => {
    // Adding these after the migration lands would mean altering a schema that
    // production and development share. They are free only right now.
    expect(executableSql).toMatch(/^\s+day_part text NOT NULL,$/m);
    expect(executableSql).toMatch(/^\s+validity_basis text NOT NULL,$/m);
    expect(executableSql).toMatch(/^\s+degraded_failure_code text,$/m);
    expect(executableSql).toMatch(
      /^\s+degraded_item_count integer NOT NULL DEFAULT 0,$/m,
    );
    expect(executableSql).toContain(
      "CHECK (day_part IN ('all_day', 'day', 'night'))",
    );
    expect(executableSql).toContain(
      "CHECK (validity_basis IN ('stated', 'derived_publication_day'))",
    );
  });

  it("leaves region_key and exposure unconstrained by a vocabulary", () => {
    // region_key carries WaveCast chart spot slugs ('trestles', 'malibu', ...)
    // when scope_type='spot'; exposure is free text across source families.
    // A CHECK on either fails on the first live insert.
    expect(executableSql).not.toMatch(/CHECK\s*\(\s*region_key\s+IN\s*\(/i);
    expect(executableSql).not.toMatch(/CHECK\s*\(\s*exposure\s+IN\s*\(/i);
    expect(executableSql).toMatch(/^\s+region_key text,$/m);
    expect(executableSql).toMatch(/^\s+exposure text NOT NULL,$/m);
  });

  it("does not constrain ingest_run_id by foreign key", () => {
    // seaside/crons/fetch_trusted_forecasts.py writes issues, then source
    // results, then the run row last. A FK would reject every run.
    expect(executableSql).toMatch(/^\s+ingest_run_id uuid,$/m);
    expect(executableSql).toMatch(/^\s+ingest_run_id uuid NOT NULL,$/m);
    expect(executableSql).not.toMatch(
      /ingest_run_id[^,]*REFERENCES\s+public\.trusted_forecast_ingest_runs/i,
    );
  });

  it("enforces one decision per beach/local day and one claim per slot", () => {
    expect(executableSql).toContain("UNIQUE (beach_id, local_date)");
    expect(executableSql).toContain("UNIQUE (beach_id, forecast_at)");
    expect(executableSql).toContain("UNIQUE (ingest_run_id, source_key)");
    expect(executableSql).toContain("UNIQUE (revision_hash)");
    expect(executableSql).toContain("UNIQUE (build_key)");
  });

  it("rejects UPDATE and DELETE on every append-only table", () => {
    const appendOnly: readonly string[] = [
      "trusted_forecast_ingest_runs_append_only",
      "trusted_forecast_source_results_append_only",
      "trusted_forecast_issues_append_only",
      "trusted_forecast_decisions_append_only",
      "trusted_forecast_applications_append_only",
      "trusted_forecast_build_receipts_append_only",
      "trusted_forecast_alerts_acknowledgement_only",
    ];
    for (const trigger of appendOnly) {
      expect(executableSql).toContain(`CREATE TRIGGER ${trigger}`);
    }
    expect(executableSql).toContain("BEFORE UPDATE OR DELETE ON");
    expect(executableSql).toContain("trusted forecast history is append-only");
  });

  it("owns hashing in the database and accepts no caller-supplied digest", () => {
    expect(executableSql).toContain(
      "pg_catalog.sha256(convert_to(v_canonical::text, 'UTF8'))",
    );
    // A digest key is not in any accepted-key array, so a caller cannot even
    // name one. (The only mention in the file is the comment saying so.)
    expect(executableSql).not.toMatch(/^\s+'payload(Sha256|Hash)',?$/m);
    expect(executableSql).toContain(
      "trusted forecast build idempotency collision",
    );
  });

  it("compares every exact durable count on replay", () => {
    for (const field of [
      "expected_decision_count",
      "expected_application_count",
      "expected_alert_count",
      "expected_snapshot_count",
    ]) {
      expect(executableSql).toContain(`v_existing.${field} <> `);
    }
  });

  it("locks the build key and inserts the receipt last", () => {
    expect(executableSql).toContain(
      "hashtextextended('trusted-forecast-build:' || v_build_key, 0)",
    );
    const lockIndex: number = executableSql.indexOf("pg_advisory_xact_lock");
    const receiptInsertIndex: number = executableSql.indexOf(
      "INSERT INTO public.trusted_forecast_build_receipts (",
    );
    const decisionInsertIndex: number = executableSql.indexOf(
      "INSERT INTO public.trusted_forecast_decisions (",
    );
    const applicationInsertIndex: number = executableSql.indexOf(
      "INSERT INTO public.trusted_forecast_applications (",
    );
    const alertInsertIndex: number = executableSql.indexOf(
      "INSERT INTO public.trusted_forecast_alerts (",
    );
    expect(lockIndex).toBeGreaterThan(-1);
    expect(lockIndex).toBeLessThan(decisionInsertIndex);
    expect(receiptInsertIndex).toBeGreaterThan(decisionInsertIndex);
    expect(receiptInsertIndex).toBeGreaterThan(applicationInsertIndex);
    expect(receiptInsertIndex).toBeGreaterThan(alertInsertIndex);
  });

  it("keeps every trusted object away from public roles", () => {
    for (const table of TRUSTED_TABLES) {
      expect(executableSql).toContain(
        `REVOKE ALL ON public.${table}\n  FROM PUBLIC, anon, authenticated;`,
      );
    }
    for (const routine of [
      "public.persist_trusted_forecast_build(jsonb)",
      "public.get_trusted_forecast_build_receipt(text)",
      "public.acknowledge_trusted_forecast_alert(jsonb)",
      "public.trusted_forecast_canonical_build_payload(jsonb)",
    ]) {
      expect(executableSql).toContain(
        `REVOKE ALL ON FUNCTION ${routine}\n  FROM PUBLIC, anon, authenticated;`,
      );
    }
    expect(executableSql).not.toMatch(/GRANT[^;]*TO\s+(anon|authenticated)\b/i);
  });

  it("grants execute on the three service-role RPCs only", () => {
    const grants: readonly string[] =
      executableSql.match(/GRANT EXECUTE ON FUNCTION[\s\S]*?;/g) ?? [];
    expect(grants).toHaveLength(3);
    for (const grant of grants) {
      expect(grant).toContain("TO service_role;");
    }
  });

  it("never grants direct write access to RPC-owned tables", () => {
    expect(executableSql).toContain(
      "GRANT SELECT, INSERT ON public.trusted_forecast_issues TO service_role;",
    );
    expect(executableSql).toContain(
      "GRANT SELECT ON public.trusted_forecast_decisions TO service_role;",
    );
    expect(executableSql).toContain(
      "GRANT SELECT ON public.trusted_forecast_build_receipts TO service_role;",
    );
    expect(executableSql).not.toMatch(
      /GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*ON public\.trusted_forecast_(decisions|applications|alerts|build_receipts)/i,
    );
  });

  it("restricts alert acknowledgement to the three D-22 columns", () => {
    expect(executableSql).toContain(
      "v_old := to_jsonb(OLD) - 'acknowledged' - 'acknowledged_by'",
    );
    expect(executableSql).toContain("IF v_old IS DISTINCT FROM v_new THEN");
    expect(executableSql).toContain(
      "app.trusted_forecast_alert_acknowledgement",
    );
    expect(executableSql).toMatch(
      /UPDATE public\.trusted_forecast_alerts\s+SET acknowledged = true,\s+acknowledged_by = v_actor,\s+acknowledged_at = transaction_timestamp\(\)/,
    );
  });

  it("validates the snapshot column set from one shared definition", () => {
    expect(executableSql).toContain(
      "c_snapshot_keys CONSTANT text[] := public.trusted_forecast_snapshot_columns();",
    );
    expect(executableSql).toContain(
      "FROM unnest(public.trusted_forecast_snapshot_columns()) AS column_name;",
    );
  });
});
