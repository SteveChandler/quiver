import { readFileSync } from "fs";
import { join } from "path";
import { expectSqlAllowedWaveSourceCtes } from "../helpers/sql-wave-source-tags";

type GapFactorRow = {
  beachId: string;
  beachName: string;
  beachSlug: string;
  region: string;
  factors: {
    version: number;
    type: string;
    buckets: Array<{
      tp_min_s: number;
      tp_max_s: number;
      factor: number;
    }>;
    calibration: {
      method: string;
      samples: number;
      date_range: string;
      reference_buoy: string;
      notes: string;
    };
  };
};

describe("Migration: Phase 1 shoaling apply gap", () => {
  const migrationPath = join(
    __dirname,
    "../../supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql"
  );
  const preflightPath = join(
    __dirname,
    "../../scripts/db/phase1-shoaling-apply-gap-preflight.sql"
  );
  const postflightPath = join(
    __dirname,
    "../../scripts/db/phase1-shoaling-apply-gap-postflight.sql"
  );

  const expectedMissingIds = [
    "1207215c-f61d-4fe1-bbaa-a3db7d4e7d53",
    "da8ad733-8e6b-4781-8b3f-0fe4ee492c3f",
    "12e0096c-9826-443f-9131-53aaa646f789",
    "71bdbe5a-67f6-429c-b1e4-80ec390ec4a3",
    "0e557ec4-355a-4176-8352-6ea50e379c13",
    "52879e4f-fc7f-4c02-a5e3-ea40b992ea80",
    "be03bc6f-878a-4806-bff2-9cf870a9f241",
    "66ef3c08-a8a2-4cf1-9361-273489bac45b",
    "d60dd5c8-d147-4042-a531-c2ec55c620af",
    "37ffa92a-d811-4791-afbb-b90a86dcdf49",
    "071db1df-b5ee-4af6-a022-ea8a09667cbe",
    "72726bcb-bed0-4b76-8336-f90d7fb57159",
    "025cfc18-8357-49d6-994e-e0abf0a16f6d",
    "b57b32b9-0057-46f6-9fa9-cd35d5bd5319",
    "502bd50f-21c8-4cdc-ae96-1d53fcbc34de",
    "9841bdd0-e70f-4c10-bc54-135575006298",
    "7a093b7e-2230-4bf1-abeb-9b31faa794d5",
    "53cc78d5-a759-4153-8a2e-b13cf1bb6b4e",
    "bbe7f4eb-9807-4e65-8e69-e2cee28d6b24",
    "11662c67-a1bb-43a0-b0f7-0e4071b1c3f2",
    "e64001e6-e2bd-4596-8f24-d8064e7f5186",
    "d9524c9d-8315-4686-9d35-24ceb6db2a82",
    "13a91b0d-3e80-4140-b11e-2c1b12e00687",
    "a0e764f1-d0bb-4341-b397-7b21823cb93b",
    "79e8be90-df33-4b80-9d92-e79e26a67a69",
    "c2c7cc01-4920-4fd9-941c-68df6b46ced0",
    "101bd2f7-e1dc-4940-b4e3-3a820d5940dd",
    "17628f35-9ed1-4257-aad6-070c4bd73bb8",
    "96fd7011-b894-4776-a68d-ff16fb1985d8",
    "836f218a-9471-46c9-b201-24da1dfe0f3a",
  ].sort();

  let migrationSQL: string;
  let preflightSQL: string;
  let postflightSQL: string;
  let rows: GapFactorRow[];

  beforeAll(() => {
    migrationSQL = readFileSync(migrationPath, "utf8");
    preflightSQL = readFileSync(preflightPath, "utf8");
    postflightSQL = readFileSync(postflightPath, "utf8");
    rows = extractRows(migrationSQL);
  });

  function extractRows(sql: string): GapFactorRow[] {
    const rowPattern =
      /\('([0-9a-f-]+)'::uuid,\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([\s\S]*?)'::jsonb\)/g;
    const parsed: GapFactorRow[] = [];
    let match: RegExpExecArray | null = rowPattern.exec(sql);

    while (match != null) {
      parsed.push({
        beachId: match[1],
        beachName: match[2],
        beachSlug: match[3],
        region: match[4],
        factors: JSON.parse(match[5]),
      });
      match = rowPattern.exec(sql);
    }

    return parsed;
  }

  it("is wrapped in a transaction", () => {
    expect(migrationSQL).toMatch(/^BEGIN;/m);
    expect(migrationSQL).toMatch(/^COMMIT;/m);
  });

  it("documents the superseded approval gate before preparing target rows", () => {
    expect(migrationSQL).toContain(
      "SUPERSEDED 2026-06-20: the original gated this apply behind Phase 0"
    );
    expect(migrationSQL).toContain("Gated version preserved in git history");
    expect(migrationSQL).toContain(
      "Applied to prod\n-- via direct psql 2026-06-20; verified 87 -> 117."
    );
    expect(migrationSQL).not.toContain(
      "current_setting('app.phase1_shoaling_apply_gap_approved', true)"
    );
  });

  it("contains exactly the 30 live validated rows missing from prod", () => {
    expect(rows).toHaveLength(30);
    expect(rows.map((row) => row.beachId).sort()).toEqual(expectedMissingIds);
    expect(new Set(rows.map((row) => row.beachId)).size).toBe(30);
  });

  it("only fills empty shoaling_factors and does not rewrite calibrated beaches", () => {
    expect(migrationSQL).toMatch(/UPDATE public\.beaches AS b/i);
    expect(migrationSQL).toContain("SET shoaling_factors = v.shoaling_factors");
    expect(migrationSQL).toContain(
      "CREATE TEMP TABLE phase1_validated_gap_factors ON COMMIT DROP"
    );
    expect(migrationSQL).toContain("AND b.deleted_at IS NULL");
    expect(migrationSQL).toContain("AND b.shoaling_factors IS NULL");
    expect(migrationSQL).not.toContain("1 / CASE");
    expect(migrationSQL).not.toContain("1 / 0");
    expect(migrationSQL).not.toMatch(/\bDELETE\b/i);
    expect(migrationSQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(migrationSQL).not.toMatch(/ALTER TABLE/i);
  });

  it("stores valid period lookup payloads for every top-up beach", () => {
    for (const row of rows) {
      expect(row.beachName).not.toHaveLength(0);
      expect(row.beachSlug).not.toHaveLength(0);
      expect(row.region).not.toHaveLength(0);
      expect(row.factors.version).toBe(1);
      expect(row.factors.type).toBe("period_lookup");
      expect(row.factors.buckets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tp_min_s: 0, tp_max_s: 8 }),
          expect.objectContaining({ tp_min_s: 8, tp_max_s: 12 }),
          expect.objectContaining({ tp_min_s: 12, tp_max_s: 16 }),
          expect.objectContaining({ tp_min_s: 16, tp_max_s: 999 }),
        ])
      );
      expect(row.factors.buckets).toHaveLength(4);
      expect(row.factors.buckets.every((bucket) => bucket.factor > 0)).toBe(
        true
      );
      expect(row.factors.calibration.method).toBe(
        "surfline_lotus_vs_cdip_historical"
      );
      expect(row.factors.calibration.samples).toBeGreaterThan(0);
      expect(row.factors.calibration.reference_buoy).toMatch(/^CDIP \d+$/);
    }
  });

  it("has read-only preflight coverage and scoped observation checks", () => {
    expect(preflightSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(preflightSQL).toMatch(/^ROLLBACK;/m);
    expect(preflightSQL).toContain("phase1_current_coverage");
    expect(preflightSQL).toContain("phase1_phase0_schema_readiness");
    expect(preflightSQL).toContain("phase1_phase0_schema_ready");
    expect(preflightSQL).toContain(
      "public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz)"
    );
    expect(preflightSQL).toContain("\\gset");
    expect(preflightSQL).toContain("\\if :phase1_phase0_schema_ready");
    expect(preflightSQL).toContain("skipped_missing_phase0_schema");
    expect(preflightSQL).toContain("phase1_target_rows");
    expect(preflightSQL).toContain("phase1_target_observed_30d");
    expect(preflightSQL).toContain("phase1_preflight_assertions");
    expect(preflightSQL).toContain("phase1_preflight_blockers");
    expect(preflightSQL).toContain("blocker_code");
    expect(preflightSQL).toContain("blocker_message");
    expect(preflightSQL).toContain("expected_active_found=");
    expect(preflightSQL).toContain("would_update_rows=");
    expect(preflightSQL).toContain("approval_0_72h_rows=");
    expect(preflightSQL).toContain(
      "targets_with_approval_0_72h_rows_at_least_25="
    );
    expect(preflightSQL).toContain("expected_active_found_30");
    expect(preflightSQL).toContain("would_update_rows_30");
    expect(preflightSQL).toContain("already_populated_rows_0");
    expect(preflightSQL).toContain("missing_or_deleted_rows_0");
    expect(preflightSQL).toContain("approval_0_72h_rows_at_least_75");
    expect(preflightSQL).toContain(
      "observed_0_72h_rows_without_approval_provenance_0"
    );
    expect(preflightSQL).toContain(
      "all_targets_approval_0_72h_rows_at_least_25"
    );
    expect(preflightSQL).toContain("phase1_preflight_assertions_passed");
    expect(preflightSQL).toContain("would_update_rows");
    expect(preflightSQL).toContain("already_populated_rows");
    expect(preflightSQL).toContain("observed_0_24h_rows");
    expect(preflightSQL).toContain("observed_25_72h_rows");
    expect(preflightSQL).toContain("observed_0_72h_rows");
    expect(preflightSQL).toContain("approval_0_72h_rows");
    expect(preflightSQL).toContain(
      "observed_0_72h_rows_without_approval_provenance"
    );
    expect(preflightSQL).toContain("forecast_horizon_bucket");
    expect(preflightSQL).toContain("display_wave_source");
    expect(preflightSQL).toContain("allowed_wave_sources(source_tag) AS");
    expect(preflightSQL).toContain("FROM allowed_wave_sources AS s");
    expect(preflightSQL).toContain(
      "WHERE s.source_tag = p.display_wave_source"
    );
    expect(preflightSQL).not.toMatch(
      /p\.display_wave_source\s+(?:NOT\s+)?IN\s*\(/
    );
    expectSqlAllowedWaveSourceCtes(preflightSQL);
    expect(preflightSQL).toContain("display_raw_input_height_m");
    expect(preflightSQL).toContain("p.display_raw_input_height_m >= 0");
    expect(preflightSQL).toContain("p.display_raw_input_height_m < 0");
    expect(preflightSQL).toContain("has_slice_sample_floor");
    expect(preflightSQL).toContain("bool_and(passed)");
    expect(preflightSQL).toContain("RAISE EXCEPTION");
    expect(preflightSQL).toContain(
      "Phase 1 shoaling apply-gap preflight assertions failed; see phase1_preflight_blockers and phase1_preflight_assertions above."
    );
    expect(preflightSQL).not.toContain("1 / CASE");
    expect(preflightSQL).not.toContain("1 / 0");
    for (const beachId of expectedMissingIds) {
      expect(preflightSQL).toContain(beachId);
    }
  });

  it("has read-only postflight assertions for the approved apply", () => {
    expect(postflightSQL).toMatch(/^BEGIN READ ONLY;/m);
    expect(postflightSQL).toMatch(/^ROLLBACK;/m);
    expect(postflightSQL).toContain("phase1_postflight_coverage");
    expect(postflightSQL).toContain("all_target_rows_populated");
    expect(postflightSQL).toContain("all_target_rows_valid_period_lookup");
    expect(postflightSQL).toContain("active_shoaling_coverage_at_least_117");
    expect(postflightSQL).toContain("phase1_postflight_blockers");
    expect(postflightSQL).toContain("blocker_code");
    expect(postflightSQL).toContain("blocker_message");
    expect(postflightSQL).toContain("target_populated_rows=");
    expect(postflightSQL).toContain("valid_period_lookup_rows=");
    expect(postflightSQL).toContain("active_with_shoaling_factors=");
    expect(postflightSQL).toContain("phase1_apply_gap_assertions_passed");
    expect(postflightSQL).toContain("jsonb_array_length");
    expect(postflightSQL).toContain("\\gset");
    expect(postflightSQL).toContain("RAISE EXCEPTION");
    expect(postflightSQL).toContain(
      "Phase 1 shoaling apply-gap postflight assertions failed; see phase1_postflight_blockers and phase1_postflight_coverage above."
    );
    expect(postflightSQL).not.toContain("1 / CASE");
    expect(postflightSQL).not.toContain("1 / 0");
    for (const beachId of expectedMissingIds) {
      expect(postflightSQL).toContain(beachId);
    }
  });
});
