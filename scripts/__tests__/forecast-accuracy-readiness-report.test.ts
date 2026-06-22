import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildForecastAccuracyReadinessReport,
  buildSessionObservationRows,
  freshSnapshotSelectColumns,
  getProposedBeachScope,
  hasValidReplayProvenance,
  isMissingOptionalFreshSnapshotColumnError,
  parseCliArgs,
  validateForecastAccuracyReadinessReport,
  validateForecastAccuracyReadinessReportFile,
  writeForecastAccuracyReadinessReport,
} from "../forecast-accuracy-readiness-report";
import { WAVE_HEIGHT_SOURCE_TAGS } from "@/lib/utils/wave-height-source";

const TEST_PROPOSED_JSON_SHA256 =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

type BuildOptions = Parameters<
  typeof buildForecastAccuracyReadinessReport
>[0];
type BeachRow = BuildOptions["beaches"][number];
type ObservationRow = BuildOptions["observations"][number];
type FreshSnapshotRow = BuildOptions["freshSnapshotRows"][number];
type ProposedScope = BuildOptions["proposedScope"];

function beach(overrides: Partial<BeachRow>): BeachRow {
  return {
    id: "beach-1",
    slug: "beach-1",
    name: "Beach 1",
    region: "Region",
    ...overrides,
  };
}

function observation(overrides: Partial<ObservationRow>): ObservationRow {
  const forecastHorizonHours = overrides.forecast_horizon_hours ?? 12;
  return {
    beach_id: "beach-1",
    forecast_horizon_hours: forecastHorizonHours,
    forecast_horizon_bucket: Object.prototype.hasOwnProperty.call(
      overrides,
      "forecast_horizon_bucket"
    )
      ? overrides.forecast_horizon_bucket
      : bucketForHours(forecastHorizonHours),
    source: "buoy",
    has_horizon_bucket_provenance: true,
    has_replay_provenance: true,
    ...overrides,
  };
}

function freshSnapshot(overrides: Partial<FreshSnapshotRow>): FreshSnapshotRow {
  const forecastHorizonHours = overrides.forecast_horizon_hours ?? 12;
  return {
    beach_id: "beach-1",
    forecast_horizon_hours: forecastHorizonHours,
    forecast_horizon_bucket: Object.prototype.hasOwnProperty.call(
      overrides,
      "forecast_horizon_bucket"
    )
      ? overrides.forecast_horizon_bucket
      : bucketForHours(forecastHorizonHours),
    has_horizon_bucket_provenance: true,
    has_replay_provenance: true,
    ...overrides,
  };
}

function proposedScope(overrides: Partial<ProposedScope>): ProposedScope {
  return {
    beachIds: [],
    beachSlugs: [],
    duplicateBeachConfigIds: [],
    duplicateBeachConfigSlugs: [],
    unresolvedTopLevelConfigKeys: [],
    ...overrides,
  };
}

function bucketForHours(
  hours: number | null
): ObservationRow["forecast_horizon_bucket"] {
  if (hours == null) return null;
  if (hours >= 0 && hours <= 24) return "0-24h";
  if (hours >= 25 && hours <= 72) return "25-72h";
  if (hours >= 73) return "73h+";
  return null;
}

describe("forecast-accuracy-readiness-report", () => {
  it("parses explicit inputs and sample thresholds", () => {
    expect(
      parseCliArgs([
        "--proposed-json",
        "/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--start",
        "2026-06-01T00:00:00Z",
        "--end",
        "2026-06-19T00:00:00Z",
        "--truth-source",
        "session",
        "--min-gate-samples=100",
        "--min-beach-samples",
        "10",
        "--fresh-snapshot-hours=48",
        "--fail-on-not-ready",
      ])
    ).toEqual({
      proposedJsonPath: "/tmp/proposed.json",
      outputJsonPath: "/tmp/readiness.json",
      validateOutputJsonPath: null,
      expectedProposedJsonPath: null,
      maxReportAgeHours: null,
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      truthSource: "session",
      minGateSamples: 100,
      minBeachSamples: 10,
      freshSnapshotHours: 48,
      failOnNotReady: true,
    });
  });

  it("defaults readiness failure mode off for exploratory runs", () => {
    expect(
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--days=14",
        "--truth-source=session",
      ])
    ).toMatchObject({
      truthSource: "session",
      freshSnapshotHours: 24,
      failOnNotReady: false,
    });
  });

  it("requires proposed and output JSON paths", () => {
    expect(() => parseCliArgs(["--output-json=/tmp/readiness.json"])).toThrow(
      "Missing --proposed-json"
    );
    expect(() => parseCliArgs(["--proposed-json=/tmp/proposed.json"])).toThrow(
      "Missing --output-json"
    );
    expect(
      parseCliArgs([
        "--validate-output-json",
        "/tmp/readiness.json",
        "--expect-proposed-json",
        "/tmp/proposed.json",
        "--max-report-age-hours=24",
      ])
    ).toMatchObject({
      validateOutputJsonPath: "/tmp/readiness.json",
      expectedProposedJsonPath: "/tmp/proposed.json",
      maxReportAgeHours: 24,
      proposedJsonPath: "",
      outputJsonPath: "",
    });
  });

  it("rejects readiness flags without values", () => {
    expect(() => parseCliArgs(["--proposed-json"])).toThrow(
      "--proposed-json requires a value."
    );
    expect(() => parseCliArgs(["--output-json="])).toThrow(
      "--output-json requires a value."
    );
    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--min-gate-samples",
      ])
    ).toThrow("--min-gate-samples requires a value.");
    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--truth-source=",
      ])
    ).toThrow("--truth-source requires a value.");
    expect(() => parseCliArgs(["--validate-output-json"])).toThrow(
      "--validate-output-json requires a value."
    );
    expect(() =>
      parseCliArgs(["--max-report-age-hours", "--fail-on-not-ready"])
    ).toThrow("--max-report-age-hours requires a value.");
    expect(() => parseCliArgs(["--expect-proposed-json"])).toThrow(
      "--expect-proposed-json requires a value."
    );
    expect(() =>
      parseCliArgs([
        "--validate-output-json=/tmp/readiness.json",
        "--output-json=/tmp/other.json",
      ])
    ).toThrow(
      "--validate-output-json cannot be combined with --proposed-json or --output-json."
    );
    expect(() => parseCliArgs(["--max-report-age-hours=24"])).toThrow(
      "--max-report-age-hours requires --validate-output-json."
    );
    expect(() =>
      parseCliArgs(["--expect-proposed-json=/tmp/proposed.json"])
    ).toThrow("--expect-proposed-json requires --validate-output-json.");
  });

  it("rejects unknown readiness arguments", () => {
    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--fail-on-notready",
      ])
    ).toThrow("Unknown argument: --fail-on-notready.");
    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--min-gate-sampels",
        "75",
      ])
    ).toThrow("Unknown argument: --min-gate-sampels.");
    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "/tmp/extra.json",
      ])
    ).toThrow("Unknown argument: /tmp/extra.json.");
  });

  it("rejects invalid or reversed readiness windows", () => {
    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--start",
        "not-a-date",
      ])
    ).toThrow("--start must be a valid date/time.");

    expect(() =>
      parseCliArgs([
        "--proposed-json=/tmp/proposed.json",
        "--output-json=/tmp/readiness.json",
        "--start=2026-06-19T00:00:00Z",
        "--end=2026-06-18T00:00:00Z",
      ])
    ).toThrow("--start must be before --end.");
  });

  it("builds fresh snapshot selects with optional Phase 0 columns", () => {
    const fullSelect = freshSnapshotSelectColumns({
      includeHorizonBucketColumn: true,
      includeReplayColumns: true,
    });

    expect(fullSelect).toBe(
      "beach_id,forecast_horizon_hours,forecast_horizon_bucket,display_wave_source,display_raw_input_height_m"
    );
    expect(
      freshSnapshotSelectColumns({
        includeHorizonBucketColumn: false,
        includeReplayColumns: false,
      })
    ).toBe("beach_id,forecast_horizon_hours");
  });

  it("classifies missing optional fresh snapshot columns", () => {
    expect(
      isMissingOptionalFreshSnapshotColumnError({
        code: "42703",
        message: "column ml_predictions_log.forecast_horizon_bucket does not exist",
      })
    ).toBe("horizon-bucket");
    expect(
      isMissingOptionalFreshSnapshotColumnError({
        code: "PGRST204",
        message: "Could not find the display_raw_input_height_m column",
      })
    ).toBe("replay");
    expect(
      isMissingOptionalFreshSnapshotColumnError({
        code: "42P01",
        message: "relation ml_predictions_log_missing does not exist",
      })
    ).toBeNull();
  });

  it("requires an allowed source tag and nonnegative numeric raw input for replay provenance", () => {
    for (const displayWaveSource of WAVE_HEIGHT_SOURCE_TAGS) {
      expect(
        hasValidReplayProvenance({
          display_wave_source: displayWaveSource,
          display_raw_input_height_m: 1,
        })
      ).toBe(true);
    }

    expect(
      hasValidReplayProvenance({
        display_wave_source: null,
        display_raw_input_height_m: 1,
      })
    ).toBe(false);
    expect(
      hasValidReplayProvenance({
        display_wave_source: "rogue_source",
        display_raw_input_height_m: 1,
      })
    ).toBe(false);
    expect(
      hasValidReplayProvenance({
        display_wave_source: "model_hs",
        display_raw_input_height_m: -0.1,
      })
    ).toBe(false);
    expect(
      hasValidReplayProvenance({
        display_wave_source: "model_hs",
        display_raw_input_height_m: "1" as never,
      })
    ).toBe(false);
  });

  it("maps only canonical session truth links into readiness observations", () => {
    const rows = buildSessionObservationRows(
      [
        {
          beach_id: "beach-1",
          forecast_horizon_hours: null,
          ml_prediction_id: "prediction-1",
          snapshot_display_source: "face-Hs-transformer-v1",
        },
        {
          beach_id: "beach-2",
          forecast_horizon_hours: 12,
          ml_prediction_id: "prediction-2",
          snapshot_display_source: "legacy-display",
        },
        {
          beach_id: "beach-3",
          forecast_horizon_hours: 12,
          ml_prediction_id: "prediction-3",
          snapshot_display_source: "face-Hs-transformer-v1",
        },
      ],
      new Map([
        [
          "prediction-1",
          {
            forecast_horizon_hours: 48,
            display_source: "face-Hs-transformer-v1",
            forecast_horizon_bucket: "25-72h",
            has_horizon_bucket_provenance: true,
            has_replay_provenance: true,
          },
        ],
        [
          "prediction-2",
          {
            forecast_horizon_hours: 12,
            display_source: "face-Hs-transformer-v1",
            forecast_horizon_bucket: "0-24h",
            has_horizon_bucket_provenance: true,
            has_replay_provenance: true,
          },
        ],
        [
          "prediction-3",
          {
            forecast_horizon_hours: 12,
            display_source: "legacy-display",
            forecast_horizon_bucket: "0-24h",
            has_horizon_bucket_provenance: true,
            has_replay_provenance: true,
          },
        ],
      ])
    );

    expect(rows).toEqual([
      {
        beach_id: "beach-1",
        forecast_horizon_hours: 48,
        forecast_horizon_bucket: "25-72h",
        source: "session",
        has_horizon_bucket_provenance: true,
        has_replay_provenance: true,
      },
    ]);
  });

  it("extracts the same proposed beach scope shapes as the harness", () => {
    expect(
      getProposedBeachScope({
        predictions: [{ beach_id: "prediction-beach" }],
        beaches: [
          { id: "config-beach", slug: "config-slug" },
          { slug: "slug-only" },
        ],
        "11111111-1111-4111-8111-111111111111": {
          shoaling_factors: { version: 1 },
        },
        "top-level-slug": {
          terrain_enabled: true,
        },
        approval_subset: {
          selected_beach_ids: ["prediction-beach"],
          selection_rule: "metadata only",
        },
        ignored: {
          note: "not a beach config",
        },
      })
    ).toEqual({
      beachIds: [
        "11111111-1111-4111-8111-111111111111",
        "config-beach",
        "prediction-beach",
      ],
      beachSlugs: ["config-slug", "slug-only", "top-level-slug"],
      duplicateBeachConfigIds: [],
      duplicateBeachConfigSlugs: [],
      unresolvedTopLevelConfigKeys: ["top-level-slug"],
    });
  });

  it("reports duplicate proposed beach config scope separately from repeated prediction rows", () => {
    expect(
      getProposedBeachScope({
        predictions: [
          { beach_id: "prediction-beach" },
          { beach_id: "prediction-beach" },
        ],
        beaches: [
          { id: "config-beach", slug: "config-slug" },
          { id: "config-beach", slug: "other-config-slug" },
          { id: "other-config-beach", slug: "config-slug" },
        ],
      })
    ).toEqual({
      beachIds: ["config-beach", "other-config-beach", "prediction-beach"],
      beachSlugs: ["config-slug", "other-config-slug"],
      duplicateBeachConfigIds: ["config-beach"],
      duplicateBeachConfigSlugs: ["config-slug"],
      unresolvedTopLevelConfigKeys: [],
    });
  });

  it("reports duplicate embedded top-level proposed beach config ids and slugs", () => {
    expect(
      getProposedBeachScope({
        "11111111-1111-4111-8111-111111111111": {
          id: "embedded-beach",
          slug: "uuid-keyed-a",
          terrain_enabled: true,
        },
        "22222222-2222-4222-8222-222222222222": {
          id: "embedded-beach",
          slug: "uuid-keyed-b",
          terrain_enabled: true,
        },
        "top-level-slug-a": {
          slug: "embedded-slug",
          terrain_enabled: true,
        },
        "top-level-slug-b": {
          slug: "embedded-slug",
          terrain_enabled: true,
        },
      })
    ).toEqual({
      beachIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      beachSlugs: ["top-level-slug-a", "top-level-slug-b"],
      duplicateBeachConfigIds: ["embedded-beach"],
      duplicateBeachConfigSlugs: ["embedded-slug"],
      unresolvedTopLevelConfigKeys: [
        "top-level-slug-a",
        "top-level-slug-b",
      ],
    });
  });

  it("builds aggregate and per-beach 0-72h readiness", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: proposedScope({
        beachIds: ["beach-ready", "beach-insufficient", "beach-missing"],
        beachSlugs: ["beach-unmeasured"],
      }),
      beaches: [
        beach({
          id: "beach-ready",
          slug: "beach-ready",
          name: "Ready Beach",
        }),
        beach({
          id: "beach-insufficient",
          slug: "beach-insufficient",
          name: "Insufficient Beach",
        }),
        beach({
          id: "beach-unmeasured",
          slug: "beach-unmeasured",
          name: "Unmeasured Beach",
        }),
      ],
      observations: [
        observation({
          beach_id: "beach-ready",
          forecast_horizon_hours: 6,
          source: "buoy",
        }),
        observation({
          beach_id: "beach-ready",
          forecast_horizon_hours: 48,
          source: "session",
        }),
        observation({
          beach_id: "beach-ready",
          forecast_horizon_hours: 96,
          source: "buoy",
        }),
        observation({
          beach_id: "beach-insufficient",
          forecast_horizon_hours: 24,
          source: "buoy",
        }),
        observation({
          beach_id: "outside-scope",
          forecast_horizon_hours: 12,
          source: "buoy",
        }),
      ],
      freshSnapshotRows: [
        freshSnapshot({
          beach_id: "beach-ready",
          forecast_horizon_bucket: "0-24h",
        }),
        freshSnapshot({
          beach_id: "beach-ready",
          forecast_horizon_hours: null,
          forecast_horizon_bucket: "25-72h",
        }),
        freshSnapshot({
          beach_id: "beach-insufficient",
          forecast_horizon_bucket: "0-24h",
        }),
      ],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "both",
      minGateSamples: 3,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.summary).toMatchObject({
      gate_ready: true,
      all_beaches_ready: false,
      fresh_snapshot_ready: false,
      approval_readiness: false,
      readiness_blockers: [
        "Ready beaches 1 below resolved beach count 3.",
        "Fresh scoped snapshots missing required buckets for 2 beaches.",
        "Missing proposed beach ids: beach-missing.",
      ],
      readiness_blocker_codes: [
        "beach_sample_floor",
        "fresh_snapshot_missing_bucket",
        "missing_proposed_beach_ids",
      ],
      gate_0_72h_count: 3,
      gate_0_72h_horizon_bucket_provenance_count: 3,
      gate_0_72h_replayable_count: 3,
      gate_0_72h_approval_count: 3,
      short_horizon_without_horizon_bucket_provenance_count: 0,
      short_horizon_without_replay_provenance_count: 0,
      fresh_snapshot_0_72h_count: 3,
      fresh_snapshot_0_72h_horizon_bucket_provenance_count: 3,
      fresh_snapshot_0_72h_replayable_count: 3,
      fresh_snapshot_0_72h_approval_count: 3,
      fresh_short_horizon_without_horizon_bucket_provenance_count: 0,
      fresh_short_horizon_without_replay_provenance_count: 0,
      fresh_snapshot_missing_beach_count: 2,
      ready_beach_count: 1,
      insufficient_beach_count: 1,
      unmeasured_beach_count: 1,
    });
    expect(report.summary.counts.total).toEqual({
      "0-24h": 2,
      "25-72h": 1,
      "0-72h": 3,
      "73h+": 1,
      unknown: 0,
      total: 4,
    });
    expect(report.summary.counts.session["0-72h"]).toBe(1);
    expect(report.summary.horizon_bucket_provenance_counts["0-72h"]).toBe(3);
    expect(report.summary.replayable_counts.total["0-72h"]).toBe(3);
    expect(report.summary.approval_counts["0-72h"]).toBe(3);
    expect(report.scope.missing_proposed_beach_ids).toEqual(["beach-missing"]);
    expect(report.beaches.map((item) => [item.name, item.status])).toEqual([
      ["Unmeasured Beach", "unmeasured"],
      ["Insufficient Beach", "insufficient"],
      ["Ready Beach", "ready"],
    ]);
    expect(report.beaches[0].needed_0_72h).toBe(2);
    expect(report.beaches[0].fresh_snapshot_missing_buckets).toEqual([
      "0-24h",
      "25-72h",
    ]);
    expect(report.beaches[1].needed_0_72h).toBe(1);
    expect(report.beaches[1].fresh_snapshot_missing_buckets).toEqual([
      "25-72h",
    ]);
    expect(report.beaches[2].needed_0_72h).toBe(0);
    expect(report.beaches[2].fresh_snapshot_missing_buckets).toEqual([]);
  });

  it("marks approval ready when aggregate and every beach meet thresholds", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: proposedScope({
        beachIds: ["beach-1"],
        beachSlugs: [],
      }),
      beaches: [beach({ id: "beach-1" })],
      observations: [
        observation({ forecast_horizon_hours: 1 }),
        observation({ forecast_horizon_hours: 72 }),
      ],
      freshSnapshotRows: [
        freshSnapshot({ forecast_horizon_bucket: "0-24h" }),
        freshSnapshot({
          forecast_horizon_hours: 72,
          forecast_horizon_bucket: "25-72h",
        }),
      ],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "buoy",
      minGateSamples: 2,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.summary).toMatchObject({
      gate_ready: true,
      all_beaches_ready: true,
      fresh_snapshot_ready: true,
      approval_readiness: true,
      readiness_blockers: [],
      readiness_blocker_codes: [],
    });
  });

  it("reports a clear blocker when no proposed beaches resolve", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: proposedScope({
        beachIds: ["missing-beach"],
        beachSlugs: [],
      }),
      beaches: [],
      observations: [],
      freshSnapshotRows: [],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "buoy",
      minGateSamples: 2,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.summary).toMatchObject({
      gate_ready: false,
      all_beaches_ready: false,
      fresh_snapshot_ready: false,
      approval_readiness: false,
      readiness_blockers: [
        "Approval-provenanced 0-72h rows 0 below gate floor 2.",
        "No proposed beaches resolved.",
        "Missing proposed beach ids: missing-beach.",
      ],
      readiness_blocker_codes: [
        "gate_sample_floor",
        "no_resolved_beaches",
        "missing_proposed_beach_ids",
      ],
    });
  });

  it("blocks approval readiness when proposed scope has duplicate write configs", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: {
        beachIds: ["beach-1"],
        beachSlugs: [],
        duplicateBeachConfigIds: ["beach-1"],
        duplicateBeachConfigSlugs: [],
        unresolvedTopLevelConfigKeys: [],
      },
      beaches: [beach({ id: "beach-1" })],
      observations: [
        observation({ forecast_horizon_hours: 1 }),
        observation({ forecast_horizon_hours: 72 }),
      ],
      freshSnapshotRows: [
        freshSnapshot({ forecast_horizon_bucket: "0-24h" }),
        freshSnapshot({
          forecast_horizon_hours: 72,
          forecast_horizon_bucket: "25-72h",
        }),
      ],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "buoy",
      minGateSamples: 2,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.scope).toMatchObject({
      duplicate_proposed_beach_config_ids: ["beach-1"],
      duplicate_proposed_beach_config_slugs: [],
      unresolved_top_level_config_keys: [],
    });
    expect(report.summary).toMatchObject({
      gate_ready: true,
      all_beaches_ready: true,
      fresh_snapshot_ready: true,
      approval_readiness: false,
      readiness_blockers: [
        "Duplicate proposed beach config ids: beach-1.",
      ],
      readiness_blocker_codes: ["duplicate_proposed_beach_config_ids"],
    });
  });

  it("blocks approval readiness when fresh scoped snapshots are missing", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: proposedScope({
        beachIds: ["beach-1"],
        beachSlugs: [],
      }),
      beaches: [beach({ id: "beach-1" })],
      observations: [
        observation({ forecast_horizon_hours: 1 }),
        observation({ forecast_horizon_hours: 72 }),
      ],
      freshSnapshotRows: [
        freshSnapshot({ forecast_horizon_bucket: "0-24h" }),
      ],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "buoy",
      minGateSamples: 2,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.summary).toMatchObject({
      gate_ready: true,
      all_beaches_ready: true,
      fresh_snapshot_ready: false,
      approval_readiness: false,
      readiness_blockers: [
        "Fresh scoped snapshots missing required buckets for 1 beach.",
      ],
      readiness_blocker_codes: ["fresh_snapshot_missing_bucket"],
      fresh_snapshot_missing_beach_count: 1,
    });
    expect(report.beaches[0]).toMatchObject({
      fresh_snapshot_ready: false,
      fresh_snapshot_missing_buckets: ["25-72h"],
    });
  });

  it("blocks approval readiness when 0-72h rows lack replay provenance", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: proposedScope({
        beachIds: ["beach-1"],
        beachSlugs: [],
      }),
      beaches: [beach({ id: "beach-1" })],
      observations: [
        observation({
          forecast_horizon_hours: 1,
          has_replay_provenance: false,
        }),
        observation({
          forecast_horizon_hours: 72,
          has_replay_provenance: false,
        }),
      ],
      freshSnapshotRows: [
        freshSnapshot({
          forecast_horizon_bucket: "0-24h",
          has_replay_provenance: false,
        }),
        freshSnapshot({
          forecast_horizon_hours: 72,
          forecast_horizon_bucket: "25-72h",
          has_replay_provenance: false,
        }),
      ],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "buoy",
      minGateSamples: 2,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.summary).toMatchObject({
      gate_ready: false,
      all_beaches_ready: false,
      approval_readiness: false,
      readiness_blockers: [
        "Approval-provenanced 0-72h rows 0 below gate floor 2.",
        "Ready beaches 0 below resolved beach count 1.",
        "Fresh scoped snapshots missing required buckets for 1 beach.",
        "Observed 0-72h rows missing display-replay provenance: 2.",
        "Fresh 0-72h snapshot rows missing display-replay provenance: 2.",
      ],
      readiness_blocker_codes: [
        "gate_sample_floor",
        "beach_sample_floor",
        "fresh_snapshot_missing_bucket",
        "observed_replay_provenance_missing",
        "fresh_replay_provenance_missing",
      ],
      gate_0_72h_count: 2,
      gate_0_72h_horizon_bucket_provenance_count: 2,
      gate_0_72h_replayable_count: 0,
      gate_0_72h_approval_count: 0,
      short_horizon_without_horizon_bucket_provenance_count: 0,
      short_horizon_without_replay_provenance_count: 2,
      fresh_snapshot_0_72h_count: 2,
      fresh_snapshot_0_72h_horizon_bucket_provenance_count: 2,
      fresh_snapshot_0_72h_replayable_count: 0,
      fresh_snapshot_0_72h_approval_count: 0,
      fresh_short_horizon_without_horizon_bucket_provenance_count: 0,
      fresh_short_horizon_without_replay_provenance_count: 2,
    });
    expect(report.beaches[0]).toMatchObject({
      status: "insufficient",
      needed_0_72h: 2,
      short_horizon_without_replay_provenance: 2,
    });
  });

  it("blocks approval readiness when 0-72h rows lack stored horizon-bucket provenance", () => {
    const report = buildForecastAccuracyReadinessReport({
      proposedJsonPath: "/tmp/proposed.json",
      proposedJsonSha256: TEST_PROPOSED_JSON_SHA256,
      proposedScope: proposedScope({
        beachIds: ["beach-1"],
        beachSlugs: [],
      }),
      beaches: [beach({ id: "beach-1" })],
      observations: [
        observation({
          forecast_horizon_hours: 1,
          forecast_horizon_bucket: null,
          has_horizon_bucket_provenance: false,
        }),
        observation({
          forecast_horizon_hours: 72,
          forecast_horizon_bucket: null,
          has_horizon_bucket_provenance: false,
        }),
      ],
      freshSnapshotRows: [
        freshSnapshot({
          forecast_horizon_bucket: null,
          has_horizon_bucket_provenance: false,
        }),
        freshSnapshot({
          forecast_horizon_hours: 72,
          forecast_horizon_bucket: null,
          has_horizon_bucket_provenance: false,
        }),
      ],
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-19T00:00:00.000Z",
      freshSnapshotStart: "2026-06-18T12:00:00.000Z",
      freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
      freshSnapshotHours: 24,
      truthSource: "buoy",
      minGateSamples: 2,
      minBeachSamples: 2,
      generatedAt: new Date("2026-06-19T12:00:00Z"),
    });

    expect(report.summary).toMatchObject({
      gate_ready: false,
      all_beaches_ready: false,
      fresh_snapshot_ready: false,
      approval_readiness: false,
      readiness_blockers: [
        "Approval-provenanced 0-72h rows 0 below gate floor 2.",
        "Ready beaches 0 below resolved beach count 1.",
        "Fresh scoped snapshots missing required buckets for 1 beach.",
        "Observed 0-72h rows missing stored horizon-bucket provenance: 2.",
        "Fresh 0-72h snapshot rows missing stored horizon-bucket provenance: 2.",
      ],
      readiness_blocker_codes: [
        "gate_sample_floor",
        "beach_sample_floor",
        "fresh_snapshot_missing_bucket",
        "observed_horizon_bucket_provenance_missing",
        "fresh_horizon_bucket_provenance_missing",
      ],
      gate_0_72h_count: 2,
      gate_0_72h_horizon_bucket_provenance_count: 0,
      gate_0_72h_replayable_count: 2,
      gate_0_72h_approval_count: 0,
      short_horizon_without_horizon_bucket_provenance_count: 2,
      short_horizon_without_replay_provenance_count: 0,
      fresh_snapshot_0_72h_count: 2,
      fresh_snapshot_0_72h_horizon_bucket_provenance_count: 0,
      fresh_snapshot_0_72h_replayable_count: 2,
      fresh_snapshot_0_72h_approval_count: 0,
      fresh_short_horizon_without_horizon_bucket_provenance_count: 2,
      fresh_short_horizon_without_replay_provenance_count: 0,
    });
    expect(report.beaches[0]).toMatchObject({
      status: "insufficient",
      needed_0_72h: 2,
      short_horizon_without_horizon_bucket_provenance: 2,
      fresh_short_horizon_without_horizon_bucket_provenance: 2,
      fresh_snapshot_missing_buckets: ["0-24h", "25-72h"],
    });
  });

  it("validates saved readiness reports and rejects stale or edited artifacts", () => {
    const report = validReadinessReport();

    expect(
      validateForecastAccuracyReadinessReport(report, {
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T13:00:00.000Z"),
      })
    ).toEqual({
      ok: true,
      blockers: [],
    });

    expect(
      validateForecastAccuracyReadinessReport(
        {
          ...report,
          report_schema_version: 0,
        },
        {
          maxReportAgeHours: 24,
          now: new Date("2026-06-21T13:00:00.000Z"),
        }
      ).blockers
    ).toEqual(
      expect.arrayContaining([
        "report_schema_version_invalid",
        "generated_at_too_old",
      ])
    );

    expect(
      validateForecastAccuracyReadinessReport({
        ...report,
        user_id: "11111111-1111-4111-8111-111111111111",
      }).blockers
    ).toContain("report_contains_sensitive_uuid");
    expect(
      validateForecastAccuracyReadinessReport({
        ...report,
        session: {
          id: "22222222-2222-4222-8222-222222222222",
        },
      }).blockers
    ).toContain("report_contains_sensitive_uuid");

    const editedSummary = cloneReport(report);
    editedSummary.summary.approval_readiness = false;
    editedSummary.summary.gate_0_72h_approval_count = 0;
    editedSummary.summary.readiness_blockers = ["No approval evidence."];
    editedSummary.summary.readiness_blocker_codes = ["gate_sample_floor"];

    expect(
      validateForecastAccuracyReadinessReport(editedSummary).blockers
    ).toEqual(
      expect.arrayContaining([
        "summary_observed_mismatch",
        "summary_readiness_blockers_mismatch",
        "summary_readiness_blocker_codes_mismatch",
        "summary_approval_readiness_mismatch",
      ])
    );

    const editedBeach = cloneReport(report);
    editedBeach.beaches[0].needed_0_72h = 10;
    editedBeach.beaches[0].fresh_snapshot_ready = false;

    expect(
      validateForecastAccuracyReadinessReport(editedBeach).blockers
    ).toContain("beach_observed_mismatch");
  });

  it("validates a saved readiness report file from disk", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-report-"));
    const outputPath = join(outputDir, "readiness.json");
    writeFileSync(outputPath, `${JSON.stringify(validReadinessReport())}\n`);

    expect(
      validateForecastAccuracyReadinessReportFile(outputPath, {
        maxReportAgeHours: 24,
        now: new Date("2026-06-19T13:00:00.000Z"),
      })
    ).toEqual({
      ok: true,
      blockers: [],
    });

    expect(
      validateForecastAccuracyReadinessReportFile(join(outputDir, "missing.json"))
        .blockers[0]
    ).toMatch(/^report_json_unreadable:/);
  });

  it("binds saved readiness reports to the expected proposed JSON hash", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-report-"));
    const proposedPath = join(outputDir, "proposed.json");
    const otherProposedPath = join(outputDir, "other-proposed.json");
    writeFileSync(proposedPath, `${JSON.stringify({ beaches: [{ id: "beach-1" }] })}\n`);
    writeFileSync(
      otherProposedPath,
      `${JSON.stringify({ beaches: [{ id: "beach-2" }] })}\n`
    );
    const report = validReadinessReport({
      proposedJsonPath: proposedPath,
      proposedJsonSha256: sha256Text(readFileSync(proposedPath, "utf8")),
    });

    expect(
      validateForecastAccuracyReadinessReport(report, {
        expectedProposedJsonPath: proposedPath,
      })
    ).toEqual({
      ok: true,
      blockers: [],
    });

    expect(
      validateForecastAccuracyReadinessReport(report, {
        expectedProposedJsonPath: otherProposedPath,
      }).blockers
    ).toEqual(
      expect.arrayContaining([
        "proposed_json_path_mismatch",
        "proposed_json_sha256_mismatch",
      ])
    );

    expect(
      validateForecastAccuracyReadinessReport({
        ...report,
        proposed_json_sha256: "not-a-sha",
      }).blockers
    ).toContain("proposed_json_sha256_invalid");
  });

  it("writes newline-terminated JSON", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "readiness-report-"));
    const outputPath = join(outputDir, "readiness.json");

    const resolvedPath = writeForecastAccuracyReadinessReport(outputPath, {
      report_schema_version: 1,
      generated_at: "2026-06-19T12:00:00.000Z",
      range: {
        start: "2026-06-01T00:00:00.000Z",
        end: "2026-06-19T00:00:00.000Z",
      },
      truth_source: "both",
      proposed_json_path: "/tmp/proposed.json",
      proposed_json_sha256: TEST_PROPOSED_JSON_SHA256,
      fresh_snapshot_window: {
        start: "2026-06-18T12:00:00.000Z",
        end: "2026-06-19T12:00:00.000Z",
        hours: 24,
      },
      thresholds: {
        min_gate_samples: 75,
        min_beach_samples: 25,
      },
      scope: {
        proposed_beach_ids: [],
        proposed_beach_slugs: [],
        duplicate_proposed_beach_config_ids: [],
        duplicate_proposed_beach_config_slugs: [],
        unresolved_top_level_config_keys: [],
        resolved_beach_count: 0,
        missing_proposed_beach_ids: [],
        missing_proposed_beach_slugs: [],
      },
      summary: {
        gate_ready: false,
        all_beaches_ready: false,
        fresh_snapshot_ready: false,
        approval_readiness: false,
        readiness_blockers: ["No approval evidence."],
        readiness_blocker_codes: ["gate_sample_floor"],
        gate_0_72h_count: 0,
        gate_0_72h_horizon_bucket_provenance_count: 0,
        gate_0_72h_replayable_count: 0,
        gate_0_72h_approval_count: 0,
        short_horizon_without_horizon_bucket_provenance_count: 0,
        short_horizon_without_replay_provenance_count: 0,
        fresh_snapshot_0_72h_count: 0,
        fresh_snapshot_0_72h_horizon_bucket_provenance_count: 0,
        fresh_snapshot_0_72h_replayable_count: 0,
        fresh_snapshot_0_72h_approval_count: 0,
        fresh_short_horizon_without_horizon_bucket_provenance_count: 0,
        fresh_short_horizon_without_replay_provenance_count: 0,
        fresh_snapshot_missing_beach_count: 0,
        ready_beach_count: 0,
        insufficient_beach_count: 0,
        unmeasured_beach_count: 0,
        counts: {
          total: emptyCounts(),
          buoy: emptyCounts(),
          session: emptyCounts(),
        },
        horizon_bucket_provenance_counts: emptyCounts(),
        replayable_counts: {
          total: emptyCounts(),
          buoy: emptyCounts(),
          session: emptyCounts(),
        },
        approval_counts: emptyCounts(),
      },
      beaches: [],
    });

    expect(resolvedPath).toBe(outputPath);
    expect(readFileSync(outputPath, "utf8")).toMatch(/\n$/);
  });
});

function emptyCounts() {
  return {
    "0-24h": 0,
    "25-72h": 0,
    "0-72h": 0,
    "73h+": 0,
    unknown: 0,
    total: 0,
  };
}

type ReadinessReport = ReturnType<typeof buildForecastAccuracyReadinessReport>;

function validReadinessReport(
  overrides: {
    proposedJsonPath?: string;
    proposedJsonSha256?: string;
  } = {}
): ReadinessReport {
  return buildForecastAccuracyReadinessReport({
    proposedJsonPath: overrides.proposedJsonPath ?? "/tmp/proposed.json",
    proposedJsonSha256:
      overrides.proposedJsonSha256 ??
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    proposedScope: proposedScope({
      beachIds: ["beach-1"],
      beachSlugs: [],
    }),
    beaches: [beach({ id: "beach-1" })],
    observations: [
      observation({ forecast_horizon_hours: 1 }),
      observation({ forecast_horizon_hours: 72 }),
    ],
    freshSnapshotRows: [
      freshSnapshot({ forecast_horizon_bucket: "0-24h" }),
      freshSnapshot({
        forecast_horizon_hours: 72,
        forecast_horizon_bucket: "25-72h",
      }),
    ],
    start: "2026-06-01T00:00:00.000Z",
    end: "2026-06-19T12:00:00.000Z",
    freshSnapshotStart: "2026-06-18T12:00:00.000Z",
    freshSnapshotEnd: "2026-06-19T12:00:00.000Z",
    freshSnapshotHours: 24,
    truthSource: "buoy",
    minGateSamples: 2,
    minBeachSamples: 2,
    generatedAt: new Date("2026-06-19T12:00:00.000Z"),
  });
}

function cloneReport(report: ReadinessReport): ReadinessReport {
  return JSON.parse(JSON.stringify(report)) as ReadinessReport;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
