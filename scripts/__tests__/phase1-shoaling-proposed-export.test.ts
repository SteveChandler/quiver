import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  buildPhase1ShoalingProposedExport,
  extractShoalingGapRows,
  parseCliArgs,
  sha256File,
  validatePhase1ShoalingProposedExportArtifact,
  validateShoalingGapRows,
  validateShoalingGapRowsAgainstValidatedSource,
} from "../phase1-shoaling-proposed-export";

type ExtractedShoalingGapRow = ReturnType<typeof extractShoalingGapRows>[number];

interface ParsedShoalingFactors {
  buckets: Array<{ tp_min_s: number; tp_max_s: number; factor: number }>;
  calibration: {
    method: string;
    samples: number;
    date_range: string;
    reference_buoy: string;
  };
}

describe("phase1-shoaling-proposed-export", () => {
  const migrationPath = join(
    __dirname,
    "../../supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql"
  );

  it("parses default migration path and output json path", () => {
    expect(
      parseCliArgs(["--output-json=/tmp/quiver-phase1-shoaling-gap.json"])
    ).toEqual({
      migrationPath:
        "supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql",
      validatedJsonPath:
        "../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json",
      outputJsonPath: "/tmp/quiver-phase1-shoaling-gap.json",
      validateOutputJsonPath: null,
      maxArtifactAgeHours: null,
      expectedCount: 30,
    });
  });

  it("parses explicit migration, output json, and expected count paths", () => {
    expect(
      parseCliArgs([
        "--migration",
        "/tmp/migration.sql",
        "--validated-json",
        "/tmp/factors_validated.json",
        "--output-json",
        "/tmp/proposed.json",
        "--expected-count",
        "12",
      ])
    ).toEqual({
      migrationPath: "/tmp/migration.sql",
      validatedJsonPath: "/tmp/factors_validated.json",
      outputJsonPath: "/tmp/proposed.json",
      validateOutputJsonPath: null,
      maxArtifactAgeHours: null,
      expectedCount: 12,
    });
    expect(
      parseCliArgs([
        "--migration=/tmp/migration.sql",
        "--validated-json=/tmp/factors_validated.json",
        "--output-json=/tmp/proposed.json",
        "--expected-count=7",
      ])
    ).toEqual({
      migrationPath: "/tmp/migration.sql",
      validatedJsonPath: "/tmp/factors_validated.json",
      outputJsonPath: "/tmp/proposed.json",
      validateOutputJsonPath: null,
      maxArtifactAgeHours: null,
      expectedCount: 7,
    });
  });

  it("parses validation mode and max artifact age", () => {
    expect(
      parseCliArgs([
        "--validate-output-json",
        "/tmp/proposed.json",
        "--max-artifact-age-hours",
        "24",
      ])
    ).toEqual({
      migrationPath:
        "supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql",
      validatedJsonPath:
        "../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json",
      outputJsonPath: "",
      validateOutputJsonPath: "/tmp/proposed.json",
      maxArtifactAgeHours: 24,
      expectedCount: 30,
    });
    expect(
      parseCliArgs([
        "--validate-output-json=/tmp/proposed.json",
        "--max-artifact-age-hours=12",
      ])
    ).toMatchObject({
      validateOutputJsonPath: "/tmp/proposed.json",
      maxArtifactAgeHours: 12,
    });
  });

  it("requires an output json path", () => {
    expect(() => parseCliArgs([])).toThrow("Missing --output-json");
  });

  it("rejects value flags without values", () => {
    expect(() =>
      parseCliArgs(["--migration", "--output-json", "/tmp/proposed.json"])
    ).toThrow("--migration requires a value.");
    expect(() =>
      parseCliArgs(["--migration=", "--output-json", "/tmp/proposed.json"])
    ).toThrow("--migration requires a value.");
    expect(() => parseCliArgs(["--output-json"])).toThrow(
      "--output-json requires a value."
    );
    expect(() => parseCliArgs(["--output-json="])).toThrow(
      "--output-json requires a value."
    );
    expect(() =>
      parseCliArgs(["--validated-json", "--output-json", "/tmp/proposed.json"])
    ).toThrow("--validated-json requires a value.");
    expect(() =>
      parseCliArgs(["--validated-json=", "--output-json", "/tmp/proposed.json"])
    ).toThrow("--validated-json requires a value.");
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/proposed.json", "--expected-count"])
    ).toThrow("--expected-count requires a value.");
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/proposed.json", "--expected-count=0"])
    ).toThrow("--expected-count must be a positive integer.");
    expect(() => parseCliArgs(["--validate-output-json"])).toThrow(
      "--validate-output-json requires a value."
    );
    expect(() =>
      parseCliArgs([
        "--validate-output-json",
        "/tmp/proposed.json",
        "--max-artifact-age-hours",
      ])
    ).toThrow("--max-artifact-age-hours requires a value.");
  });

  it("rejects unknown arguments", () => {
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/proposed.json", "--migraton"])
    ).toThrow("Unknown argument: --migraton.");
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/proposed.json", "/tmp/extra.sql"])
    ).toThrow("Unknown argument: /tmp/extra.sql.");
  });

  it("extracts the 30 Phase 1 apply-gap rows from the migration", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));

    expect(rows).toHaveLength(30);
    expect(new Set(rows.map((row) => row.id)).size).toBe(30);
    expect(rows[0]).toMatchObject({
      id: "1207215c-f61d-4fe1-bbaa-a3db7d4e7d53",
      name: "52nd Street",
      slug: "52nd-street-newport-beach-ca",
      region: "Orange County",
      shoaling_factors: {
        version: 1,
        type: "period_lookup",
      },
    });
    for (const row of rows) {
      expect(row.shoaling_factors).toMatchObject({
        version: 1,
        type: "period_lookup",
      });
    }
  });

  it("validates the current Phase 1 apply-gap rows before export", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));

    expect(() => validateShoalingGapRows(rows)).not.toThrow();
  });

  it("rejects partial or duplicated Phase 1 apply-gap rows", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));
    const duplicateRows = [rows[0], rows[0], ...rows.slice(2)];

    expect(() => validateShoalingGapRows(rows.slice(0, 29))).toThrow(
      "Expected 30 Phase 1 shoaling gap rows; found 29."
    );
    expect(() => validateShoalingGapRows(duplicateRows)).toThrow(
      `Duplicate beach id in Phase 1 shoaling rows: ${rows[0].id}.`
    );
    expect(() => validateShoalingGapRows(rows.slice(0, 29), 29)).not.toThrow();
  });

  it("rejects malformed Phase 1 shoaling factors", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));

    expect(() =>
      validateShoalingGapRows([
        {
          ...rows[0],
          shoaling_factors: {
            version: 1,
            type: "period_lookup",
            buckets: [
              { tp_min_s: 0, tp_max_s: 8, factor: 0 },
              { tp_min_s: 8, tp_max_s: 12, factor: 1 },
              { tp_min_s: 12, tp_max_s: 16, factor: 1 },
              { tp_min_s: 16, tp_max_s: 999, factor: 1 },
            ],
            calibration: {
              method: "surfline_lotus_vs_cdip_historical",
              samples: 1,
              date_range: "2025-04-08 to 2026-04-08",
              reference_buoy: "CDIP 215",
              notes: "test calibration",
            },
          },
        },
        ...rows.slice(1),
      ])
    ).toThrow(`Beach ${rows[0].id} bucket 0 has invalid factor.`);
  });

  it("validates Phase 1 rows against the validated factors source", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));
    const sourceRows = buildValidatedSourceRows(rows);

    expect(() =>
      validateShoalingGapRowsAgainstValidatedSource(rows, sourceRows)
    ).not.toThrow();

    const driftedSourceRows = buildValidatedSourceRows(rows);
    const firstSourceBucket = driftedSourceRows[0].buckets?.[0];
    if (firstSourceBucket) {
      firstSourceBucket.factor += 0.2;
    }

    expect(() =>
      validateShoalingGapRowsAgainstValidatedSource(rows, driftedSourceRows)
    ).toThrow(
      `Beach ${rows[0].id} bucket 0 factor ${getParsedFactors(rows[0]).buckets[0].factor} differs`
    );
  });

  it("rejects Phase 1 rows that are missing from the validated source", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));

    expect(() =>
      validateShoalingGapRowsAgainstValidatedSource(
        rows,
        buildValidatedSourceRows(rows.slice(1))
      )
    ).toThrow(`Beach ${rows[0].id} is missing from validated factors source.`);
  });

  it("builds the harness-compatible proposed beach config export", () => {
    const rows = [
      {
        id: "beach-1",
        name: "Beach 1",
        slug: "beach-1",
        region: "Region",
        shoaling_factors: {
          version: 1,
          type: "period_lookup",
          buckets: [{ tp_min_s: 0, tp_max_s: 8, factor: 1 }],
        },
      },
    ];

    expect(
      buildPhase1ShoalingProposedExport({
        rows,
        migrationPath: "migration.sql",
        sourceMigrationSha256: "migration-sha",
        validatedJsonPath: "factors_validated.json",
        sourceValidatedJsonSha256: "validated-sha",
        sourceValidatedCount: 117,
        generatedAt: new Date("2026-06-19T00:00:00Z"),
      })
    ).toEqual({
      artifact_schema_version: 1,
      generated_at: "2026-06-19T00:00:00.000Z",
      source_migration: "migration.sql",
      source_migration_sha256: "migration-sha",
      source_validated_json: "factors_validated.json",
      source_validated_json_sha256: "validated-sha",
      approval_policy: {
        status: "phase0_required",
        production_write_allowed: false,
        requires_phase0_approval: true,
        required_gate: "0-72h",
        required_metric: "face_height_mae",
        required_validator: "forecast-accuracy-report-validate --approval",
        min_gate_samples: 75,
        min_slice_samples: 25,
        max_report_age_hours: 24,
      },
      summary: {
        validated_total_count: 117,
        source_validated_count: 117,
        source_validated_rows_matched: 1,
        current_calibrated_count: 87,
        beach_count: 1,
        expected_active_coverage_after_apply: 88,
      },
      beaches: rows,
    });
  });

  it("validates generated Phase 1 proposed artifacts against source hashes", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8")).slice(
      0,
      1
    );
    const { proposedExport, migrationFile } = buildTempProposedExport(rows);

    expect(
      validatePhase1ShoalingProposedExportArtifact(proposedExport, {
        now: new Date("2026-06-19T01:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toEqual({
      ok: true,
      findings: [],
    });

    writeFileSync(migrationFile, "changed migration");

    expect(
      validatePhase1ShoalingProposedExportArtifact(proposedExport, {
        now: new Date("2026-06-19T01:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.stringContaining("source_migration_sha256"),
      ]),
    });
  });

  it("rejects source migrations with weakened non-overwrite guards", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8")).slice(
      0,
      1
    );
    const migrationSql = readFileSync(migrationPath, "utf8").replace(
      "AND b.shoaling_factors IS NULL;",
      ";"
    );
    const { proposedExport } = buildTempProposedExport(rows, { migrationSql });

    expect(
      validatePhase1ShoalingProposedExportArtifact(proposedExport, {
        now: new Date("2026-06-19T01:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Phase 1 source_migration must only fill active beaches with NULL shoaling_factors.",
      ]),
    });
  });

  it("rejects malformed Phase 1 proposed artifact approval metadata", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8")).slice(
      0,
      1
    );
    const { proposedExport } = buildTempProposedExport(rows);
    const malformedArtifact = {
      ...proposedExport,
      artifact_schema_version: 0,
      approval_policy: {
        ...proposedExport.approval_policy,
        production_write_allowed: true,
      },
    } as unknown as typeof proposedExport;

    expect(
      validatePhase1ShoalingProposedExportArtifact(malformedArtifact, {
        now: new Date("2026-06-19T01:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Phase 1 proposed artifact must declare artifact_schema_version 1.",
        "Phase 1 proposed artifact approval_policy.production_write_allowed must be false.",
      ]),
    });
  });

  it("records Phase 1 coverage and approval policy in the generated export", () => {
    const rows = extractShoalingGapRows(readFileSync(migrationPath, "utf8"));
    const proposedExport = buildPhase1ShoalingProposedExport({
      rows,
      migrationPath:
        "supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql",
      sourceMigrationSha256: "migration-sha",
      validatedJsonPath:
        "../seaside/scripts/shoaling_calibration_pipeline/workspace/factors_validated.json",
      sourceValidatedJsonSha256: "validated-sha",
      sourceValidatedCount: 117,
      generatedAt: new Date("2026-06-19T00:00:00Z"),
    });

    expect(proposedExport.summary).toEqual({
      validated_total_count: 117,
      source_validated_count: 117,
      source_validated_rows_matched: 30,
      current_calibrated_count: 87,
      beach_count: 30,
      expected_active_coverage_after_apply: 117,
    });
    expect(proposedExport.approval_policy).toEqual({
      status: "phase0_required",
      production_write_allowed: false,
      requires_phase0_approval: true,
      required_gate: "0-72h",
      required_metric: "face_height_mae",
      required_validator: "forecast-accuracy-report-validate --approval",
      min_gate_samples: 75,
      min_slice_samples: 25,
      max_report_age_hours: 24,
    });
  });

  it("hashes the source migration used for approval binding", () => {
    const expectedHash =
      "0d45f75e92ab912c7e8d77fed9615a6ecc0621ca1598aea6c78468eaa6111098";

    expect(sha256File(migrationPath)).toBe(expectedHash);
  });
});

function getParsedFactors(row: ExtractedShoalingGapRow): ParsedShoalingFactors {
  return row.shoaling_factors as ParsedShoalingFactors;
}

function buildValidatedSourceRows(
  rows: ExtractedShoalingGapRow[]
): Array<{
  beach_id: string;
  cdip_station: string;
  buckets: ParsedShoalingFactors["buckets"];
  calibration: {
    method: string;
    samples_total: number;
    date_range: string[];
    reference_buoy: string;
  };
}> {
  return rows.map((row) => {
    const factors = getParsedFactors(row);
    const referenceBuoy = factors.calibration.reference_buoy;
    return {
      beach_id: row.id,
      cdip_station: referenceBuoy.replace("CDIP ", ""),
      buckets: factors.buckets.map((bucket) => ({ ...bucket })),
      calibration: {
        method: factors.calibration.method,
        samples_total: factors.calibration.samples,
        date_range: factors.calibration.date_range.split(" to "),
        reference_buoy: referenceBuoy,
      },
    };
  });
}

function buildTempProposedExport(
  rows: ExtractedShoalingGapRow[],
  { migrationSql }: { migrationSql?: string } = {}
): {
  proposedExport: ReturnType<typeof buildPhase1ShoalingProposedExport>;
  migrationFile: string;
  validatedJsonFile: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "phase1-shoaling-proposed-"));
  const migrationFile = join(dir, "migration.sql");
  const validatedJsonFile = join(dir, "factors_validated.json");
  const sourceMigrationPath = join(
    __dirname,
    "../../supabase/migrations/20260618170000_apply_validated_shoaling_factors_gap.sql"
  );

  writeFileSync(
    migrationFile,
    migrationSql ?? readFileSync(sourceMigrationPath, "utf8")
  );
  writeFileSync(
    validatedJsonFile,
    JSON.stringify(buildValidatedSourceRows(rows), null, 2)
  );

  return {
    migrationFile,
    validatedJsonFile,
    proposedExport: buildPhase1ShoalingProposedExport({
      rows,
      migrationPath: migrationFile,
      sourceMigrationSha256: sha256File(migrationFile),
      validatedJsonPath: validatedJsonFile,
      sourceValidatedJsonSha256: sha256File(validatedJsonFile),
      sourceValidatedCount: rows.length,
      generatedAt: new Date("2026-06-19T00:00:00Z"),
    }),
  };
}
