import {
  applyProposedInput,
  buildForecastAccuracyHarnessReport,
  buildSessionTruthPredictionRows,
  computeProposedGateSlices,
  computeProposedDisplayHeightM,
  filterSessionObservationRowsByRealProfiles,
  getProposedBeachScope,
  getProposedGateSliceCoverage,
  getProposedGateSliceVerdict,
  getProposedGateVerdictFromDeltas,
  isMissingOptionalPredictionColumnError,
  parseCliArgs,
  predictionSelectColumns,
  resolveBeachScope,
  type ProfileRow,
  type SessionObservationRow,
} from "../forecast-accuracy-harness";
import type {
  ForecastAccuracyGateMetric,
  ForecastAccuracyMetric,
} from "../../lib/services/forecast/accuracy-metrics";

type BuildHarnessReportOptions = Parameters<
  typeof buildForecastAccuracyHarnessReport
>[0];
type PredictionRow = BuildHarnessReportOptions["buoyRows"][number];

function sessionObservation(userId: string | null): SessionObservationRow {
  return {
    user_id: userId,
    beach_id: "beach-1",
    observed_at: "2026-06-18T16:10:00Z",
    reported_wave_height_ft: 3,
    observed_m: 0.914,
    ml_prediction_id: "prediction-1",
    matched_prediction_at: "2026-06-18T16:00:00Z",
    forecast_horizon_hours: 12,
    snapshot_display_height_m: 0.8,
    snapshot_raw_om_height_m: 0.7,
    snapshot_v5_shadow_height_m: 0.9,
    snapshot_display_source: "face-Hs-transformer-v1",
  };
}

function profile(id: string, overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id,
    deleted_at: null,
    is_mock: false,
    analytics_is_real_user: true,
    is_system_account: false,
    ...overrides,
  };
}

describe("forecast-accuracy-harness", () => {
  it("parses date range and beach filters", () => {
    const options = parseCliArgs([
      "--start",
      "2026-06-01T00:00:00Z",
      "--end",
      "2026-06-18T00:00:00Z",
      "--beach-slugs",
      "blacks,lower-trestles",
      "--beach-ids",
      "beach-1,beach-2",
      "--proposed-json",
      "/tmp/proposed.json",
    ]);

    expect(options).toEqual({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-18T00:00:00.000Z",
      beachIds: ["beach-1", "beach-2"],
      beachSlugs: ["blacks", "lower-trestles"],
      proposedJsonPath: "/tmp/proposed.json",
      outputJsonPath: null,
      truthSource: "buoy",
      groupBy: null,
      failOnRegression: false,
      failOnSliceRegression: false,
      failOnUnmeasuredSlices: false,
      minGateSamples: null,
      minSliceSamples: null,
    });
  });

  it("parses equals-form approval inputs", () => {
    const options = parseCliArgs([
      "--start=2026-06-01T00:00:00Z",
      "--end=2026-06-18T00:00:00Z",
      "--beach-ids=beach-1,beach-2",
      "--beach-slugs=blacks,lower-trestles",
      "--proposed-json=/tmp/proposed.json",
      "--truth-source=both",
      "--group-by=beach",
    ]);

    expect(options).toMatchObject({
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-18T00:00:00.000Z",
      beachIds: ["beach-1", "beach-2"],
      beachSlugs: ["blacks", "lower-trestles"],
      proposedJsonPath: "/tmp/proposed.json",
      truthSource: "both",
      groupBy: "beach",
    });
  });

  it("rejects duplicate explicit beach scope filters", () => {
    expect(() =>
      parseCliArgs(["--beach-ids", "beach-1,beach-2,beach-1"])
    ).toThrow("Duplicate --beach-ids value(s): beach-1.");

    expect(() =>
      parseCliArgs(["--beach-slugs=blacks,lower-trestles,blacks"])
    ).toThrow("Duplicate --beach-slugs value(s): blacks.");
  });

  it("parses session truth source", () => {
    const options = parseCliArgs(["--truth-source", "session"]);

    expect(options.truthSource).toBe("session");
  });

  it("parses proposed gate slice grouping", () => {
    const options = parseCliArgs(["--group-by", "region"]);

    expect(options.groupBy).toBe("region");
  });

  it("parses report JSON output path", () => {
    const options = parseCliArgs(["--output-json=/tmp/report.json"]);

    expect(options.outputJsonPath).toBe("/tmp/report.json");
  });

  it("parses an explicit integer measurement window", () => {
    const options = parseCliArgs(["--days=14"]);

    const start = new Date(options.start);
    const end = new Date(options.end);
    const windowDays =
      (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);

    expect(windowDays).toBe(14);
  });

  it("parses the opt-in regression failure flag", () => {
    const options = parseCliArgs(["--fail-on-regression"]);

    expect(options.failOnRegression).toBe(true);
  });

  it("parses the opt-in slice regression failure flag", () => {
    const options = parseCliArgs(["--fail-on-slice-regression"]);

    expect(options.failOnSliceRegression).toBe(true);
  });

  it("parses the opt-in unmeasured slices failure flag", () => {
    const options = parseCliArgs(["--fail-on-unmeasured-slices"]);

    expect(options.failOnUnmeasuredSlices).toBe(true);
  });

  it("parses opt-in sample floors for approval gates", () => {
    const options = parseCliArgs([
      "--min-gate-samples",
      "25",
      "--min-slice-samples=10",
    ]);

    expect(options.minGateSamples).toBe(25);
    expect(options.minSliceSamples).toBe(10);
  });

  it("rejects invalid sample floors", () => {
    expect(() => parseCliArgs(["--days", "0"])).toThrow(
      "--days must be a positive integer."
    );
    expect(() => parseCliArgs(["--days=1.5"])).toThrow(
      "--days must be a positive integer."
    );
    expect(() =>
      parseCliArgs(["--min-gate-samples", "0"])
    ).toThrow("--min-gate-samples must be a positive integer.");
    expect(() =>
      parseCliArgs(["--min-slice-samples", "1.5"])
    ).toThrow("--min-slice-samples must be a positive integer.");
  });

  it("rejects value flags without values", () => {
    expect(() => parseCliArgs(["--start"])).toThrow(
      "--start requires a value."
    );
    expect(() => parseCliArgs(["--end="])).toThrow(
      "--end requires a value."
    );
    expect(() => parseCliArgs(["--beach-ids", "--days", "14"])).toThrow(
      "--beach-ids requires a value."
    );
    expect(() => parseCliArgs(["--beach-slugs="])).toThrow(
      "--beach-slugs requires a value."
    );
    expect(() =>
      parseCliArgs(["--proposed-json", "--fail-on-regression"])
    ).toThrow("--proposed-json requires a value.");
    expect(() => parseCliArgs(["--output-json="])).toThrow(
      "--output-json requires a value."
    );
    expect(() => parseCliArgs(["--truth-source"])).toThrow(
      "--truth-source requires a value."
    );
    expect(() => parseCliArgs(["--group-by="])).toThrow(
      "--group-by requires a value."
    );
    expect(() => parseCliArgs(["--min-gate-samples"])).toThrow(
      "--min-gate-samples requires a value."
    );
    expect(() => parseCliArgs(["--min-slice-samples="])).toThrow(
      "--min-slice-samples requires a value."
    );
  });

  it("rejects unknown arguments instead of silently dropping gate flags", () => {
    expect(() => parseCliArgs(["--fail-on-regresion"])).toThrow(
      "Unknown argument: --fail-on-regresion."
    );
    expect(() => parseCliArgs(["--groupby", "beach"])).toThrow(
      "Unknown argument: --groupby."
    );
    expect(() => parseCliArgs(["unexpected.json"])).toThrow(
      "Unknown argument: unexpected.json."
    );
  });

  it("rejects invalid or reversed measurement windows", () => {
    expect(() => parseCliArgs(["--start", "not-a-date"])).toThrow(
      "--start must be a valid date/time."
    );
    expect(() =>
      parseCliArgs([
        "--start=2026-06-19T00:00:00Z",
        "--end=2026-06-18T00:00:00Z",
      ])
    ).toThrow("--start must be before --end.");
  });

  it("builds prediction selects with optional Phase 0 columns", () => {
    const fullSelect = predictionSelectColumns({
      includeHorizonBucketColumn: true,
      includeReplayColumns: true,
    });

    expect(fullSelect).toContain("forecast_horizon_bucket");
    expect(fullSelect).toContain("display_source");
    expect(fullSelect).toContain(
      "display_wave_source,display_raw_input_height_m"
    );

    const legacySelect = predictionSelectColumns({
      includeHorizonBucketColumn: false,
      includeReplayColumns: false,
    });

    expect(legacySelect).not.toContain("forecast_horizon_bucket");
    expect(legacySelect).toContain("display_source");
    expect(legacySelect).not.toContain("display_wave_source");
    expect(legacySelect).toContain("forecast_horizon_hours");
  });

  it("classifies missing optional Phase 0 prediction columns", () => {
    expect(
      isMissingOptionalPredictionColumnError({
        code: "42703",
        message: "column ml_predictions_log.forecast_horizon_bucket does not exist",
      })
    ).toBe("horizon-bucket");
    expect(
      isMissingOptionalPredictionColumnError({
        code: "PGRST204",
        message: "Could not find the display_wave_source column",
      })
    ).toBe("replay");
    expect(
      isMissingOptionalPredictionColumnError({
        code: "42P01",
        message: "relation ml_predictions_log_missing does not exist",
      })
    ).toBeNull();
  });

  it("auto-scopes proposed beach configs when no explicit beach scope is provided", () => {
    const options = parseCliArgs(["--proposed-json", "/tmp/proposed.json"]);
    const proposedInput = {
      beaches: [
        { id: "beach-1", swell_access_factors: [] },
        { slug: "slug-only", swell_access_factors: [] },
      ],
    };

    expect(getProposedBeachScope(proposedInput)).toEqual({
      beachIds: ["beach-1"],
      beachSlugs: ["slug-only"],
      source: "proposed-json",
    });
    expect(resolveBeachScope(options, proposedInput)).toEqual({
      beachIds: ["beach-1"],
      beachSlugs: ["slug-only"],
      source: "proposed-json",
    });
  });

  it("ignores proposed export metadata when auto-scoping beach configs", () => {
    expect(
      getProposedBeachScope({
        generated_at: "2026-06-19T00:00:00Z",
        terrain_method: "dem_horizon_v1",
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
        filters: { missingOnly: true },
        summary: { total_beaches: 1 },
        approval_subset: {
          selected_beach_ids: ["beach-1"],
          selection_rule: "metadata only",
        },
        failures: [],
        beaches: [{ id: "beach-1", swell_access_factors: [] }],
      })
    ).toEqual({
      beachIds: ["beach-1"],
      beachSlugs: [],
      source: "proposed-json",
    });
  });

  it("keeps explicit beach scope ahead of proposed-json scope", () => {
    const options = parseCliArgs([
      "--beach-ids",
      "explicit-beach",
      "--proposed-json",
      "/tmp/proposed.json",
    ]);

    expect(
      resolveBeachScope(options, {
        beaches: [{ id: "proposed-beach", swell_access_factors: [] }],
      })
    ).toEqual({
      beachIds: ["explicit-beach"],
      beachSlugs: [],
      source: "explicit",
    });
  });

  it("auto-scopes proposed predictions by their beach ids", () => {
    expect(
      getProposedBeachScope({
        predictions: [
          {
            beach_id: "beach-1",
            predicted_at: "2026-06-18T12:00:00Z",
            proposed_display_height_m: 1,
          },
          {
            beach_id: "beach-1",
            predicted_at: "2026-06-18T13:00:00Z",
            proposed_display_height_m: 1.1,
          },
          {
            beach_id: "beach-2",
            predicted_at: "2026-06-18T12:00:00Z",
            proposed_display_height_m: 1.2,
          },
        ],
      })
    ).toEqual({
      beachIds: ["beach-1", "beach-2"],
      beachSlugs: [],
      source: "proposed-json",
    });
  });

  it("applies exact proposed prediction snapshots by beach and predicted_at", () => {
    const applied = applyProposedInput(
      [
        {
          beach_id: "beach-1",
          predicted_at: "2026-06-18T12:00:00Z",
          observed_m: 1,
          forecast_horizon_hours: null,
          forecast_horizon_bucket: "0-24h",
          raw_display_height_m: 1.2,
          offset_corrected_display_height_m: 1.1,
          wave_height_om: 0.9,
          v5_shadow_height_m: 1.0,
          noaa_swell_1_height_m: null,
          noaa_swell_1_period_s: null,
          noaa_swell_1_direction_deg: null,
          noaa_swell_2_height_m: null,
          noaa_swell_2_period_s: null,
          noaa_swell_2_direction_deg: null,
          noaa_wind_wave_height_m: null,
          noaa_wind_wave_period_s: null,
          noaa_wind_wave_direction_deg: null,
          wave_period_s: null,
          wave_direction_deg: null,
          wave_period_om: null,
          wave_direction_om: null,
        },
      ],
      [],
      {
        predictions: [
          {
            beach_id: "beach-1",
            predicted_at: "2026-06-18T12:00:00.000Z",
            proposed_display_height_m: 1.05,
          },
        ],
      }
    );

    expect(applied.proposedCount).toBe(1);
    expect(applied.missingCount).toBe(0);
    expect(applied.rows[0].proposed_display_height_m).toBe(1.05);
  });

  it("applies exact proposed prediction snapshots by horizon when provided", () => {
    const applied = applyProposedInput(
      [
        {
          beach_id: "beach-1",
          predicted_at: "2026-06-18T12:00:00Z",
          observed_m: 1,
          forecast_horizon_hours: null,
          forecast_horizon_bucket: "0-24h",
          raw_display_height_m: 1.2,
          offset_corrected_display_height_m: 1.1,
          wave_height_om: 0.9,
          v5_shadow_height_m: 1.0,
          noaa_swell_1_height_m: null,
          noaa_swell_1_period_s: null,
          noaa_swell_1_direction_deg: null,
          noaa_swell_2_height_m: null,
          noaa_swell_2_period_s: null,
          noaa_swell_2_direction_deg: null,
          noaa_wind_wave_height_m: null,
          noaa_wind_wave_period_s: null,
          noaa_wind_wave_direction_deg: null,
          wave_period_s: null,
          wave_direction_deg: null,
          wave_period_om: null,
          wave_direction_om: null,
        },
        {
          beach_id: "beach-1",
          predicted_at: "2026-06-18T12:00:00Z",
          observed_m: 1,
          forecast_horizon_hours: 84,
          raw_display_height_m: 1.3,
          offset_corrected_display_height_m: 1.2,
          wave_height_om: 0.95,
          v5_shadow_height_m: 1.05,
          noaa_swell_1_height_m: null,
          noaa_swell_1_period_s: null,
          noaa_swell_1_direction_deg: null,
          noaa_swell_2_height_m: null,
          noaa_swell_2_period_s: null,
          noaa_swell_2_direction_deg: null,
          noaa_wind_wave_height_m: null,
          noaa_wind_wave_period_s: null,
          noaa_wind_wave_direction_deg: null,
          wave_period_s: null,
          wave_direction_deg: null,
          wave_period_om: null,
          wave_direction_om: null,
        },
      ],
      [],
      {
        predictions: [
          {
            beach_id: "beach-1",
            predicted_at: "2026-06-18T12:00:00.000Z",
            forecast_horizon_bucket: "0-24h",
            proposed_display_height_m: 1.05,
          },
          {
            beach_id: "beach-1",
            predicted_at: "2026-06-18T12:00:00.000Z",
            forecast_horizon_bucket: "73h+",
            proposed_display_height_m: 1.25,
          },
        ],
      }
    );

    expect(applied.proposedCount).toBe(2);
    expect(applied.missingCount).toBe(0);
    expect(applied.rows[0].proposed_display_height_m).toBe(1.05);
    expect(applied.rows[1].proposed_display_height_m).toBe(1.25);
  });

  it("rejects duplicate exact proposed prediction snapshots", () => {
    expect(() =>
      applyProposedInput(
        [],
        [],
        {
          predictions: [
            {
              beach_id: "beach-1",
              predicted_at: "2026-06-18T12:00:00.000Z",
              forecast_horizon_bucket: "0-24h",
              proposed_display_height_m: 1.05,
            },
            {
              beach_id: "beach-1",
              predicted_at: "2026-06-18T12:00:00.000Z",
              forecast_horizon_bucket: "0-24h",
              proposed_display_height_m: 1.15,
            },
          ],
        }
      )
    ).toThrow(
      "Duplicate proposed prediction key(s): horizon:beach-1:2026-06-18T12:00:00.000Z:0-24h."
    );
  });

  it("rejects duplicate proposed beach config ids and slugs before applying overrides", () => {
    expect(() =>
      applyProposedInput(
        [],
        [],
        {
          beaches: [
            { id: "beach-1", slug: "slug-1", swell_access_factors: [] },
            { id: "beach-1", slug: "slug-2", swell_access_factors: [] },
          ],
        }
      )
    ).toThrow("Duplicate proposed beach config id(s): beach-1.");

    expect(() =>
      applyProposedInput(
        [],
        [],
        {
          beaches: [
            { id: "beach-1", slug: "slug-1", swell_access_factors: [] },
            { id: "beach-2", slug: "slug-1", swell_access_factors: [] },
          ],
        }
      )
    ).toThrow("Duplicate proposed beach config slug(s): slug-1.");
  });

  it("rejects duplicate top-level proposed beach config ids and slugs", () => {
    expect(() =>
      applyProposedInput(
        [],
        [],
        {
          "slug-a": { id: "beach-1", swell_access_factors: [] },
          "slug-b": { id: "beach-1", swell_access_factors: [] },
        }
      )
    ).toThrow("Duplicate proposed beach config id(s): beach-1.");

    expect(() =>
      applyProposedInput(
        [],
        [],
        {
          "slug-a": { slug: "slug-1", swell_access_factors: [] },
          "slug-b": { slug: "slug-1", swell_access_factors: [] },
        }
      )
    ).toThrow("Duplicate proposed beach config slug(s): slug-1.");
  });

  it("can compute a proposed display height from logged partition inputs and factor overrides", () => {
    const proposedM = computeProposedDisplayHeightM(
      {
        beach_id: "beach-1",
        predicted_at: "2026-06-18T12:00:00Z",
        observed_m: 1,
        forecast_horizon_hours: 12,
        raw_display_height_m: 1,
        offset_corrected_display_height_m: 1,
        wave_height_om: 1,
        v5_shadow_height_m: null,
        noaa_swell_1_height_m: 1,
        noaa_swell_1_period_s: 14,
        noaa_swell_1_direction_deg: 220,
        noaa_swell_2_height_m: null,
        noaa_swell_2_period_s: null,
        noaa_swell_2_direction_deg: null,
        noaa_wind_wave_height_m: null,
        noaa_wind_wave_period_s: null,
        noaa_wind_wave_direction_deg: null,
        wave_period_s: 14,
        wave_direction_deg: 220,
        wave_period_om: null,
        wave_direction_om: null,
      },
      {
        terrain_enabled: false,
        swell_access_factors: null,
        shoaling_factors: null,
        swell_window_center_deg: 220,
        swell_window_halfwidth_deg: 45,
        deepwater_decay_factor: null,
      }
    );

    expect(proposedM).toBeGreaterThan(1);
  });

  it("replays CDIP-tagged proposed shoaling from the logged raw input", () => {
    const proposedM = computeProposedDisplayHeightM(
      {
        beach_id: "beach-1",
        predicted_at: "2026-06-18T12:00:00Z",
        observed_m: 1,
        forecast_horizon_hours: 12,
        raw_display_height_m: 1,
        offset_corrected_display_height_m: 1,
        wave_height_om: 0.25,
        v5_shadow_height_m: null,
        display_wave_source: "cdip_sig",
        display_raw_input_height_m: 1,
        noaa_swell_1_height_m: 0.2,
        noaa_swell_1_period_s: 14,
        noaa_swell_1_direction_deg: 220,
        noaa_swell_2_height_m: null,
        noaa_swell_2_period_s: null,
        noaa_swell_2_direction_deg: null,
        noaa_wind_wave_height_m: null,
        noaa_wind_wave_period_s: null,
        noaa_wind_wave_direction_deg: null,
        wave_period_s: 14,
        wave_direction_deg: 220,
        wave_period_om: null,
        wave_direction_om: null,
      },
      {
        terrain_enabled: false,
        swell_access_factors: null,
        shoaling_factors: {
          version: 1,
          type: "period_lookup",
          buckets: [{ tp_min_s: 12, tp_max_s: 16, factor: 2 }],
        },
        swell_window_center_deg: null,
        swell_window_halfwidth_deg: null,
        deepwater_decay_factor: null,
      }
    );

    expect(proposedM).toBeGreaterThan(1.9);
    expect(proposedM).toBeLessThan(2.1);
  });

  it("maps session wave observations onto the canonical accuracy row shape", () => {
    const rows = buildSessionTruthPredictionRows(
      [
        {
          user_id: "user-1",
          beach_id: "beach-1",
          observed_at: "2026-06-18T16:10:00Z",
          reported_wave_height_ft: 3,
          observed_m: 0.914,
          ml_prediction_id: "prediction-1",
          matched_prediction_at: "2026-06-18T16:00:00Z",
          forecast_horizon_hours: null,
          snapshot_display_height_m: 0.8,
          snapshot_raw_om_height_m: 0.7,
          snapshot_v5_shadow_height_m: 0.9,
        },
      ],
      new Map([
        [
          "prediction-1",
          {
            id: "prediction-1",
            beach_id: "beach-1",
            predicted_at: "2026-06-18T16:00:00Z",
            display_source: "face-Hs-transformer-v1",
            observed_m: null,
            forecast_horizon_hours: null,
            forecast_horizon_bucket: "25-72h",
            has_horizon_bucket_provenance: true,
            raw_display_height_m: 0.75,
            offset_corrected_display_height_m: 0.76,
            wave_height_om: 0.72,
            v5_shadow_height_m: 0.88,
            noaa_swell_1_height_m: 0.6,
            noaa_swell_1_period_s: 14,
            noaa_swell_1_direction_deg: 220,
            noaa_swell_2_height_m: null,
            noaa_swell_2_period_s: null,
            noaa_swell_2_direction_deg: null,
            noaa_wind_wave_height_m: null,
            noaa_wind_wave_period_s: null,
            noaa_wind_wave_direction_deg: null,
            wave_period_s: 14,
            wave_direction_deg: 220,
            wave_period_om: null,
            wave_direction_om: null,
          },
        ],
      ])
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      beach_id: "beach-1",
      predicted_at: "2026-06-18T16:00:00Z",
      observed_m: 0.914,
      forecast_horizon_hours: null,
      forecast_horizon_bucket: "25-72h",
      has_horizon_bucket_provenance: true,
      raw_display_height_m: 0.75,
      offset_corrected_display_height_m: 0.8,
      wave_height_om: 0.7,
      v5_shadow_height_m: 0.9,
      noaa_swell_1_height_m: 0.6,
      noaa_swell_1_period_s: 14,
    });
  });

  it("excludes non-real profiles from harness session truth rows", () => {
    const candidates: SessionObservationRow[] = [
      sessionObservation("real-user"),
      sessionObservation("mock-user"),
      sessionObservation("deleted-user"),
      sessionObservation("analytics-excluded-user"),
      sessionObservation("system-user"),
      sessionObservation("missing-profile-user"),
      sessionObservation(null),
    ];
    const profilesById = new Map<string, ProfileRow>(
      [
        profile("real-user"),
        profile("mock-user", { is_mock: true }),
        profile("deleted-user", { deleted_at: "2026-06-01T00:00:00Z" }),
        profile("analytics-excluded-user", {
          analytics_is_real_user: false,
        }),
        profile("system-user", { is_system_account: true }),
      ].map((profileRow) => [profileRow.id, profileRow])
    );

    expect(
      filterSessionObservationRowsByRealProfiles(candidates, profilesById)
    ).toEqual([candidates[0]]);
  });

  it("drops session wave observations when reported feet do not match observed meters", () => {
    const rows = buildSessionTruthPredictionRows(
      [
        {
          user_id: "user-1",
          beach_id: "beach-1",
          observed_at: "2026-06-18T16:10:00Z",
          reported_wave_height_ft: 3,
          observed_m: 1.5,
          ml_prediction_id: "prediction-1",
          matched_prediction_at: "2026-06-18T16:00:00Z",
          forecast_horizon_hours: 12,
          snapshot_display_height_m: 0.8,
          snapshot_raw_om_height_m: 0.7,
          snapshot_v5_shadow_height_m: 0.9,
        },
      ],
      new Map([
        [
          "prediction-1",
          {
            id: "prediction-1",
            beach_id: "beach-1",
            predicted_at: "2026-06-18T16:00:00Z",
            display_source: "face-Hs-transformer-v1",
            observed_m: null,
            forecast_horizon_hours: 12,
            forecast_horizon_bucket: "0-24h",
            has_horizon_bucket_provenance: true,
            raw_display_height_m: 0.75,
            offset_corrected_display_height_m: 0.76,
            wave_height_om: 0.72,
            v5_shadow_height_m: 0.88,
            noaa_swell_1_height_m: null,
            noaa_swell_1_period_s: null,
            noaa_swell_1_direction_deg: null,
            noaa_swell_2_height_m: null,
            noaa_swell_2_period_s: null,
            noaa_swell_2_direction_deg: null,
            noaa_wind_wave_height_m: null,
            noaa_wind_wave_period_s: null,
            noaa_wind_wave_direction_deg: null,
            wave_period_s: null,
            wave_direction_deg: null,
            wave_period_om: null,
            wave_direction_om: null,
          },
        ],
      ])
    );

    expect(rows).toHaveLength(0);
  });

  it("drops session wave observations linked to non-canonical display rows", () => {
    const rows = buildSessionTruthPredictionRows(
      [
        {
          user_id: "user-1",
          beach_id: "beach-1",
          observed_at: "2026-06-18T16:10:00Z",
          reported_wave_height_ft: 3,
          observed_m: 0.914,
          ml_prediction_id: "prediction-1",
          matched_prediction_at: "2026-06-18T16:00:00Z",
          forecast_horizon_hours: 12,
          snapshot_display_height_m: 0.8,
          snapshot_raw_om_height_m: 0.7,
          snapshot_v5_shadow_height_m: 0.9,
          snapshot_display_source: "legacy-display",
        },
      ],
      new Map([
        [
          "prediction-1",
          {
            id: "prediction-1",
            beach_id: "beach-1",
            predicted_at: "2026-06-18T16:00:00Z",
            display_source: "legacy-display",
            observed_m: null,
            forecast_horizon_hours: 12,
            forecast_horizon_bucket: "0-24h",
            has_horizon_bucket_provenance: true,
            raw_display_height_m: 0.75,
            offset_corrected_display_height_m: 0.76,
            wave_height_om: 0.72,
            v5_shadow_height_m: 0.88,
            noaa_swell_1_height_m: null,
            noaa_swell_1_period_s: null,
            noaa_swell_1_direction_deg: null,
            noaa_swell_2_height_m: null,
            noaa_swell_2_period_s: null,
            noaa_swell_2_direction_deg: null,
            noaa_wind_wave_height_m: null,
            noaa_wind_wave_period_s: null,
            noaa_wind_wave_direction_deg: null,
            wave_period_s: null,
            wave_direction_deg: null,
            wave_period_om: null,
            wave_direction_om: null,
          },
        ],
      ])
    );

    expect(rows).toHaveLength(0);
  });

  it("computes proposed 0-72h gate slices by region", () => {
    const rows = [
      {
        beach_id: "beach-1",
        predicted_at: "2026-06-18T12:00:00Z",
        observed_m: 1,
        forecast_horizon_hours: 12,
        raw_display_height_m: 1,
        offset_corrected_display_height_m: 1.3,
        wave_height_om: 1,
        v5_shadow_height_m: null,
        noaa_swell_1_height_m: null,
        noaa_swell_1_period_s: null,
        noaa_swell_1_direction_deg: null,
        noaa_swell_2_height_m: null,
        noaa_swell_2_period_s: null,
        noaa_swell_2_direction_deg: null,
        noaa_wind_wave_height_m: null,
        noaa_wind_wave_period_s: null,
        noaa_wind_wave_direction_deg: null,
        wave_period_s: null,
        wave_direction_deg: null,
        wave_period_om: null,
        wave_direction_om: null,
        proposed_display_height_m: 1.1,
      },
      {
        beach_id: "beach-1",
        predicted_at: "2026-06-18T12:00:00Z",
        observed_m: 2,
        forecast_horizon_hours: 96,
        raw_display_height_m: 2,
        offset_corrected_display_height_m: 3,
        wave_height_om: 2,
        v5_shadow_height_m: null,
        noaa_swell_1_height_m: null,
        noaa_swell_1_period_s: null,
        noaa_swell_1_direction_deg: null,
        noaa_swell_2_height_m: null,
        noaa_swell_2_period_s: null,
        noaa_swell_2_direction_deg: null,
        noaa_wind_wave_height_m: null,
        noaa_wind_wave_period_s: null,
        noaa_wind_wave_direction_deg: null,
        wave_period_s: null,
        wave_direction_deg: null,
        wave_period_om: null,
        wave_direction_om: null,
        proposed_display_height_m: 5,
      },
      {
        beach_id: "beach-2",
        predicted_at: "2026-06-18T12:00:00Z",
        observed_m: 1,
        forecast_horizon_hours: 48,
        raw_display_height_m: 1,
        offset_corrected_display_height_m: 1.1,
        wave_height_om: 1,
        v5_shadow_height_m: null,
        noaa_swell_1_height_m: null,
        noaa_swell_1_period_s: null,
        noaa_swell_1_direction_deg: null,
        noaa_swell_2_height_m: null,
        noaa_swell_2_period_s: null,
        noaa_swell_2_direction_deg: null,
        noaa_wind_wave_height_m: null,
        noaa_wind_wave_period_s: null,
        noaa_wind_wave_direction_deg: null,
        wave_period_s: null,
        wave_direction_deg: null,
        wave_period_om: null,
        wave_direction_om: null,
        proposed_display_height_m: 1.4,
      },
    ];
    const beaches = [
      { id: "beach-1", name: "Good Beach", slug: "good", region: "North" },
      { id: "beach-2", name: "Bad Beach", slug: "bad", region: "South" },
    ];

    expect(
      computeProposedGateSlices(rows, beaches, "region")
    ).toEqual([
      expect.objectContaining({
        groupKey: "North",
        group: "North",
        proposedCount: 1,
        currentCount: 1,
        proposedMaeM: 0.1,
        currentMaeM: 0.3,
        deltaMaeM: -0.2,
        verdict: "non-regressing",
      }),
      expect.objectContaining({
        groupKey: "South",
        group: "South",
        proposedCount: 1,
        currentCount: 1,
        proposedMaeM: 0.4,
        currentMaeM: 0.1,
        deltaMaeM: 0.3,
        verdict: "regressed",
      }),
    ]);
  });

  it("marks a proposed 0-72h gate regression as failing", () => {
    expect(
      getProposedGateVerdictFromDeltas([
        {
          horizon_group: "0-72h",
          baseline: "proposed_display",
          baseline_label: "Proposed display",
          sample_count: 10,
          comparison_sample_count: 10,
          mae_m: 0.25,
          comparison_mae_m: 0.2,
          delta_mae_m: 0.05,
        },
      ])
    ).toMatchObject({
      verdict: "regressed",
      shouldFail: true,
      sampleFloor: null,
      delta: expect.objectContaining({
        delta_mae_m: 0.05,
      }),
    });
  });

  it("marks a non-regressing proposed 0-72h gate as passing", () => {
    expect(
      getProposedGateVerdictFromDeltas([
        {
          horizon_group: "0-72h",
          baseline: "proposed_display",
          baseline_label: "Proposed display",
          sample_count: 10,
          comparison_sample_count: 10,
          mae_m: 0.2,
          comparison_mae_m: 0.2,
          delta_mae_m: 0,
        },
      ])
    ).toMatchObject({
      verdict: "non-regressing",
      shouldFail: false,
      sampleFloor: null,
      delta: expect.objectContaining({
        delta_mae_m: 0,
      }),
    });
  });

  it("does not return a gate verdict without a proposed comparison", () => {
    expect(getProposedGateVerdictFromDeltas([])).toBeNull();
  });

  it("marks a proposed 0-72h gate with too few samples as failing", () => {
    expect(
      getProposedGateVerdictFromDeltas(
        [
          {
            horizon_group: "0-72h",
            baseline: "proposed_display",
            baseline_label: "Proposed display",
            sample_count: 9,
            comparison_sample_count: 9,
            mae_m: 0.19,
            comparison_mae_m: 0.2,
            delta_mae_m: -0.01,
          },
        ],
        { minSampleCount: 10 }
      )
    ).toMatchObject({
      verdict: "non-regressing",
      shouldFail: true,
      sampleFloor: {
        minSampleCount: 10,
        insufficientGroups: ["current_display", "proposed_display"],
        shouldFail: true,
      },
    });
  });

  it("passes a proposed 0-72h gate that meets the sample floor", () => {
    expect(
      getProposedGateVerdictFromDeltas(
        [
          {
            horizon_group: "0-72h",
            baseline: "proposed_display",
            baseline_label: "Proposed display",
            sample_count: 10,
            comparison_sample_count: 10,
            mae_m: 0.19,
            comparison_mae_m: 0.2,
            delta_mae_m: -0.01,
          },
        ],
        { minSampleCount: 10 }
      )
    ).toMatchObject({
      verdict: "non-regressing",
      shouldFail: false,
      sampleFloor: {
        minSampleCount: 10,
        insufficientGroups: [],
        shouldFail: false,
      },
    });
  });

  it("marks regressed 0-72h gate slices as failing", () => {
    expect(
      getProposedGateSliceVerdict([
        {
          groupKey: "good",
          group: "Good Beach",
          proposedCount: 10,
          currentCount: 10,
          proposedMaeM: 0.1,
          currentMaeM: 0.2,
          deltaMaeM: -0.1,
          verdict: "non-regressing",
        },
        {
          groupKey: "bad",
          group: "Bad Beach",
          proposedCount: 10,
          currentCount: 10,
          proposedMaeM: 0.3,
          currentMaeM: 0.2,
          deltaMaeM: 0.1,
          verdict: "regressed",
        },
      ])
    ).toMatchObject({
      shouldFail: true,
      sampleFloor: null,
      regressedSlices: [
        expect.objectContaining({
          group: "Bad Beach",
          deltaMaeM: 0.1,
        }),
      ],
    });
  });

  it("marks non-regressing 0-72h gate slices as passing", () => {
    expect(
      getProposedGateSliceVerdict([
        {
          groupKey: "good",
          group: "Good Beach",
          proposedCount: 10,
          currentCount: 10,
          proposedMaeM: 0.1,
          currentMaeM: 0.2,
          deltaMaeM: -0.1,
          verdict: "non-regressing",
        },
      ])
    ).toMatchObject({
      shouldFail: false,
      sampleFloor: null,
      regressedSlices: [],
    });
  });

  it("marks 0-72h gate slices below the sample floor as failing", () => {
    expect(
      getProposedGateSliceVerdict(
        [
          {
            groupKey: "thin",
            group: "Thin Beach",
            proposedCount: 9,
            currentCount: 9,
            proposedMaeM: 0.1,
            currentMaeM: 0.2,
            deltaMaeM: -0.1,
            verdict: "non-regressing",
          },
        ],
        { minSampleCount: 10 }
      )
    ).toMatchObject({
      shouldFail: true,
      regressedSlices: [],
      sampleFloor: {
        minSampleCount: 10,
        insufficientGroups: [
          "Thin Beach: current_display",
          "Thin Beach: proposed_display",
        ],
        shouldFail: true,
      },
    });
  });

  it("passes 0-72h gate slices that meet the sample floor", () => {
    expect(
      getProposedGateSliceVerdict(
        [
          {
            groupKey: "enough",
            group: "Enough Beach",
            proposedCount: 10,
            currentCount: 10,
            proposedMaeM: 0.1,
            currentMaeM: 0.2,
            deltaMaeM: -0.1,
            verdict: "non-regressing",
          },
        ],
        { minSampleCount: 10 }
      )
    ).toMatchObject({
      shouldFail: false,
      regressedSlices: [],
      sampleFloor: {
        minSampleCount: 10,
        insufficientGroups: [],
        shouldFail: false,
      },
    });
  });

  it("marks scoped beaches without proposed 0-72h gate slices as unmeasured", () => {
    expect(
      getProposedGateSliceCoverage(
        [
          {
            id: "beach-1",
            name: "Measured Beach",
            slug: "measured",
            region: "North",
          },
          {
            id: "beach-2",
            name: "Unmeasured Beach",
            slug: "unmeasured",
            region: "North",
          },
        ],
        [
          {
            groupKey: "beach-1",
            group: "Measured Beach (beach-1)",
            proposedCount: 10,
            currentCount: 10,
            proposedMaeM: 0.1,
            currentMaeM: 0.2,
            deltaMaeM: -0.1,
            verdict: "non-regressing",
          },
        ],
        "beach"
      )
    ).toMatchObject({
      shouldFail: true,
      unmeasuredGroups: ["Unmeasured Beach (beach-2)"],
    });
  });

  it("passes scoped beach coverage when every beach has a proposed 0-72h gate slice", () => {
    expect(
      getProposedGateSliceCoverage(
        [
          {
            id: "beach-1",
            name: "Measured Beach",
            slug: "measured",
            region: "North",
          },
        ],
        [
          {
            groupKey: "beach-1",
            group: "Measured Beach (beach-1)",
            proposedCount: 10,
            currentCount: 10,
            proposedMaeM: 0.1,
            currentMaeM: 0.2,
            deltaMaeM: -0.1,
            verdict: "non-regressing",
          },
        ],
        "beach"
      )
    ).toMatchObject({
      shouldFail: false,
      unmeasuredGroups: [],
    });
  });

  it("builds a machine-readable harness report", () => {
    const options = parseCliArgs([
      "--start",
      "2026-06-01T00:00:00Z",
      "--end",
      "2026-06-18T00:00:00Z",
      "--proposed-json",
      "/tmp/proposed.json",
      "--group-by",
      "beach",
      "--min-gate-samples",
      "1",
      "--min-slice-samples",
      "1",
    ]);
    const metrics: ForecastAccuracyMetric[] = [
      {
        horizon_bucket: "0-24h",
        baseline: "current_display",
        baseline_label: "Current display",
        sample_count: 1,
        mae_m: 0.2,
        bias_m: 0.2,
      },
      {
        horizon_bucket: "0-24h",
        baseline: "proposed_display",
        baseline_label: "Proposed display",
        sample_count: 1,
        mae_m: 0.1,
        bias_m: 0.1,
      },
    ];
    const gateMetrics: ForecastAccuracyGateMetric[] = [
      {
        horizon_group: "0-72h",
        baseline: "current_display",
        baseline_label: "Current display",
        sample_count: 1,
        mae_m: 0.2,
        bias_m: 0.2,
      },
      {
        horizon_group: "0-72h",
        baseline: "proposed_display",
        baseline_label: "Proposed display",
        sample_count: 1,
        mae_m: 0.1,
        bias_m: 0.1,
      },
    ];
    const replayableShortHorizonRow: PredictionRow = {
      beach_id: "beach-1",
      predicted_at: "2026-06-18T12:00:00Z",
      observed_m: 1,
      forecast_horizon_hours: null,
      forecast_horizon_bucket: "0-24h",
      has_horizon_bucket_provenance: true,
      raw_display_height_m: 1,
      offset_corrected_display_height_m: 1.2,
      wave_height_om: 1,
      v5_shadow_height_m: null,
      display_wave_source: "model_hs" as const,
      display_raw_input_height_m: 1,
      noaa_swell_1_height_m: null,
      noaa_swell_1_period_s: null,
      noaa_swell_1_direction_deg: null,
      noaa_swell_2_height_m: null,
      noaa_swell_2_period_s: null,
      noaa_swell_2_direction_deg: null,
      noaa_wind_wave_height_m: null,
      noaa_wind_wave_period_s: null,
      noaa_wind_wave_direction_deg: null,
      wave_period_s: null,
      wave_direction_deg: null,
      wave_period_om: null,
      wave_direction_om: null,
    };

    expect(
      buildForecastAccuracyHarnessReport({
        options,
        scope: {
          beachIds: ["beach-1"],
          beachSlugs: [],
          source: "proposed-json",
        },
        beaches: [
          {
            id: "beach-1",
            name: "Measured Beach",
            slug: "measured",
            region: "North",
          },
        ],
        scopedBeachIds: ["beach-1"],
        buoyRows: [replayableShortHorizonRow],
        sessionRows: [],
        observationRows: [replayableShortHorizonRow],
        applied: {
          rows: [
            {
              ...replayableShortHorizonRow,
              proposed_display_height_m: 1.1,
            },
          ],
          proposedCount: 1,
          missingCount: 0,
        },
        metrics,
        gateMetrics,
        gateSlices: [
          {
            groupKey: "beach-1",
            group: "Measured Beach (beach-1)",
            proposedCount: 1,
            currentCount: 1,
            proposedMaeM: 0.1,
            currentMaeM: 0.2,
            deltaMaeM: -0.1,
            verdict: "non-regressing",
          },
        ],
        proposedJsonSha256: "test-proposed-sha256",
      })
    ).toMatchObject({
      report_schema_version: 1,
      range: {
        start: "2026-06-01T00:00:00.000Z",
        end: "2026-06-18T00:00:00.000Z",
      },
      truth_contract: {
        observed_field: "observed_m",
        truth_quantity: "breaking_face_height_m",
        metric: "mae_m",
        session_truth_requires_canonical_display_source: true,
        canonical_display_source: "face-Hs-transformer-v1",
      },
      measurement_contract: {
        proposed_delta_method: "row-paired",
        comparison_baseline: "current_display",
        candidate_baseline: "proposed_display",
        gate_horizon: "0-72h",
      },
      proposed_json_path: "/tmp/proposed.json",
      proposed_json_sha256: "test-proposed-sha256",
      approval_gates: {
        fail_on_regression: false,
        fail_on_slice_regression: false,
        fail_on_unmeasured_slices: false,
        min_gate_samples: 1,
        min_slice_samples: 1,
      },
      scope: {
        source: "proposed-json",
        beach_count: 1,
        beach_ids: ["beach-1"],
      },
      row_counts: {
        buoy_observation_rows: 1,
        session_observation_rows: 0,
        matched_prediction_rows: 1,
        matched_0_72h_rows: 1,
        matched_0_72h_rows_with_horizon_bucket_provenance: 1,
        matched_0_72h_rows_without_horizon_bucket_provenance: 0,
        matched_0_72h_rows_with_replay_provenance: 1,
        matched_0_72h_rows_without_replay_provenance: 0,
        proposed_rows_compared: 1,
      },
      proposed_deltas: [
        expect.objectContaining({
          horizon_bucket: "0-24h",
          delta_mae_m: -0.1,
        }),
      ],
      proposed_gate_verdict: expect.objectContaining({
        verdict: "non-regressing",
        shouldFail: false,
        sampleFloor: expect.objectContaining({
          minSampleCount: 1,
          shouldFail: false,
        }),
      }),
      gate_slices: {
        group_by: "beach",
        verdict: expect.objectContaining({
          sampleFloor: expect.objectContaining({
            minSampleCount: 1,
            shouldFail: false,
          }),
        }),
        coverage: expect.objectContaining({
          shouldFail: false,
          unmeasuredGroups: [],
        }),
      },
    });
  });

  it("does not report a proposed gate verdict from unpaired proposed/current rows", () => {
    const options = parseCliArgs([
      "--start",
      "2026-06-01T00:00:00Z",
      "--end",
      "2026-06-18T00:00:00Z",
      "--proposed-json",
      "/tmp/proposed.json",
      "--min-gate-samples",
      "1",
    ]);
    const metrics: ForecastAccuracyMetric[] = [
      {
        horizon_bucket: "0-24h",
        baseline: "current_display",
        baseline_label: "Current display",
        sample_count: 1,
        mae_m: 0.5,
        bias_m: 0.5,
      },
      {
        horizon_bucket: "0-24h",
        baseline: "proposed_display",
        baseline_label: "Proposed display",
        sample_count: 1,
        mae_m: 1,
        bias_m: 1,
      },
    ];
    const gateMetrics: ForecastAccuracyGateMetric[] = [
      {
        horizon_group: "0-72h",
        baseline: "current_display",
        baseline_label: "Current display",
        sample_count: 1,
        mae_m: 0.5,
        bias_m: 0.5,
      },
      {
        horizon_group: "0-72h",
        baseline: "proposed_display",
        baseline_label: "Proposed display",
        sample_count: 1,
        mae_m: 1,
        bias_m: 1,
      },
    ];
    const baseRow = {
      beach_id: "beach-1",
      predicted_at: "2026-06-18T12:00:00Z",
      observed_m: 1,
      forecast_horizon_hours: 12,
      forecast_horizon_bucket: "0-24h" as const,
      has_horizon_bucket_provenance: true,
      raw_display_height_m: 1,
      offset_corrected_display_height_m: 1.5,
      wave_height_om: 1,
      v5_shadow_height_m: null,
      display_wave_source: "model_hs" as const,
      display_raw_input_height_m: 1,
      noaa_swell_1_height_m: null,
      noaa_swell_1_period_s: null,
      noaa_swell_1_direction_deg: null,
      noaa_swell_2_height_m: null,
      noaa_swell_2_period_s: null,
      noaa_swell_2_direction_deg: null,
      noaa_wind_wave_height_m: null,
      noaa_wind_wave_period_s: null,
      noaa_wind_wave_direction_deg: null,
      wave_period_s: null,
      wave_direction_deg: null,
      wave_period_om: null,
      wave_direction_om: null,
    };
    const report = buildForecastAccuracyHarnessReport({
      options,
      scope: {
        beachIds: ["beach-1"],
        beachSlugs: [],
        source: "proposed-json",
      },
      beaches: [
        {
          id: "beach-1",
          name: "Measured Beach",
          slug: "measured",
          region: "North",
        },
      ],
      scopedBeachIds: ["beach-1"],
      buoyRows: [baseRow],
      sessionRows: [],
      observationRows: [baseRow],
      applied: {
        rows: [
          {
            ...baseRow,
            proposed_display_height_m: null,
          },
          {
            ...baseRow,
            offset_corrected_display_height_m: null,
            proposed_display_height_m: 2,
          },
        ],
        proposedCount: 1,
        missingCount: 1,
      },
      metrics,
      gateMetrics,
      gateSlices: [],
      proposedJsonSha256: "test-proposed-sha256",
    });

    expect(report.proposed_deltas).toEqual([]);
    expect(report.proposed_gate_verdict).toBeNull();
  });

  it("counts invalid replay provenance as missing replay provenance", () => {
    const options = parseCliArgs([
      "--start",
      "2026-06-01T00:00:00Z",
      "--end",
      "2026-06-18T00:00:00Z",
      "--proposed-json",
      "/tmp/proposed.json",
    ]);
    const baseShortHorizonRow: PredictionRow = {
      beach_id: "beach-1",
      predicted_at: "2026-06-18T12:00:00Z",
      observed_m: 1,
      forecast_horizon_hours: null,
      forecast_horizon_bucket: "0-24h",
      has_horizon_bucket_provenance: true,
      raw_display_height_m: 1,
      offset_corrected_display_height_m: 1,
      wave_height_om: 1,
      v5_shadow_height_m: null,
      display_raw_input_height_m: 1,
      noaa_swell_1_height_m: null,
      noaa_swell_1_period_s: null,
      noaa_swell_1_direction_deg: null,
      noaa_swell_2_height_m: null,
      noaa_swell_2_period_s: null,
      noaa_swell_2_direction_deg: null,
      noaa_wind_wave_height_m: null,
      noaa_wind_wave_period_s: null,
      noaa_wind_wave_direction_deg: null,
      wave_period_s: null,
      wave_direction_deg: null,
      wave_period_om: null,
      wave_direction_om: null,
    };
    const replayableShortHorizonRow = {
      ...baseShortHorizonRow,
      display_wave_source: "model_hs" as const,
    };
    const invalidSourceShortHorizonRow = {
      ...baseShortHorizonRow,
      beach_id: "beach-2",
      display_wave_source: "rogue_source" as never,
    };
    const negativeRawInputShortHorizonRow = {
      ...baseShortHorizonRow,
      beach_id: "beach-3",
      display_wave_source: "model_hs" as const,
      display_raw_input_height_m: -0.1,
    };

    const report = buildForecastAccuracyHarnessReport({
      options,
      scope: {
        beachIds: ["beach-1", "beach-2", "beach-3"],
        beachSlugs: [],
        source: "proposed-json",
      },
      beaches: [
        {
          id: "beach-1",
          name: "Measured Beach",
          slug: "measured",
          region: "North",
        },
        {
          id: "beach-2",
          name: "Invalid Source Beach",
          slug: "invalid-source",
          region: "North",
        },
        {
          id: "beach-3",
          name: "Negative Raw Input Beach",
          slug: "negative-raw-input",
          region: "North",
        },
      ],
      scopedBeachIds: ["beach-1", "beach-2", "beach-3"],
      buoyRows: [
        replayableShortHorizonRow,
        invalidSourceShortHorizonRow,
        negativeRawInputShortHorizonRow,
      ],
      sessionRows: [],
      observationRows: [
        replayableShortHorizonRow,
        invalidSourceShortHorizonRow,
        negativeRawInputShortHorizonRow,
      ],
      applied: { rows: [], proposedCount: 0, missingCount: 0 },
      metrics: [],
      gateMetrics: [],
      gateSlices: [],
      proposedJsonSha256: "test-proposed-sha256",
    });

    expect(report.row_counts).toMatchObject({
      matched_0_72h_rows: 3,
      matched_0_72h_rows_with_replay_provenance: 1,
      matched_0_72h_rows_without_replay_provenance: 2,
    });
  });
});
