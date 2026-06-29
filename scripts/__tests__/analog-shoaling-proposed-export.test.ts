import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  buildAnalogShoalingProposedExport,
  classifyBreakType,
  confidenceFor,
  haversineKm,
  parseCliArgs,
  scoreDonor,
  selectBestAnalogDonor,
  validateAnalogShoalingProposedExportArtifact,
  writeAnalogShoalingProposedExport,
} from "../analog-shoaling-proposed-export";

type BeachShoalingRow = Parameters<
  typeof buildAnalogShoalingProposedExport
>[0]["rows"][number];

const SHOALING_FACTORS = {
  version: 1,
  type: "period_lookup",
  buckets: [{ tp_min_s: 0, tp_max_s: 8, factor: 1.05 }],
  calibration: {
    source: "validated",
  },
};

function beach(overrides: Partial<BeachShoalingRow>): BeachShoalingRow {
  return {
    id: "beach-1",
    name: "Beach 1",
    slug: "beach-1",
    region: "San Diego",
    state: "CA",
    lat: 32.75,
    lon: -117.25,
    break_type: "beach",
    shoaling_factors: null,
    swell_window_center_deg: 270,
    deepwater_decay_factor: 1,
    ...overrides,
  };
}

describe("analog-shoaling-proposed-export", () => {
  it("parses defaults and explicit confidence filters", () => {
    expect(parseCliArgs(["--output-json=/tmp/analog.json"])).toEqual({
      outputJsonPath: "/tmp/analog.json",
      validateOutputJsonPath: null,
      maxDistanceKm: 100,
      minConfidence: "medium",
      limit: null,
      maxArtifactAgeHours: null,
    });

    expect(
      parseCliArgs([
        "--output-json",
        "/tmp/analog.json",
        "--max-distance-km",
        "50",
        "--min-confidence=high",
        "--limit",
        "2",
      ])
    ).toEqual({
      outputJsonPath: "/tmp/analog.json",
      validateOutputJsonPath: null,
      maxDistanceKm: 50,
      minConfidence: "high",
      limit: 2,
      maxArtifactAgeHours: null,
    });
  });

  it("parses validation mode and max artifact age", () => {
    expect(
      parseCliArgs([
        "--validate-output-json",
        "/tmp/analog.json",
        "--max-artifact-age-hours",
        "24",
      ])
    ).toEqual({
      outputJsonPath: "",
      validateOutputJsonPath: "/tmp/analog.json",
      maxDistanceKm: 100,
      minConfidence: "medium",
      limit: null,
      maxArtifactAgeHours: 24,
    });

    expect(
      parseCliArgs([
        "--validate-output-json=/tmp/analog.json",
        "--max-artifact-age-hours=12",
      ])
    ).toMatchObject({
      validateOutputJsonPath: "/tmp/analog.json",
      maxArtifactAgeHours: 12,
    });
  });

  it("requires output and validates numeric flags", () => {
    expect(() => parseCliArgs([])).toThrow("Missing --output-json");
    expect(() =>
      parseCliArgs(["--output-json=/tmp/x.json", "--max-distance-km=0"])
    ).toThrow("--max-distance-km must be a positive number");
    expect(() =>
      parseCliArgs(["--output-json=/tmp/x.json", "--min-confidence=trusted"])
    ).toThrow("--min-confidence must be high, medium, or low");
    expect(() =>
      parseCliArgs([
        "--validate-output-json=/tmp/x.json",
        "--max-artifact-age-hours=0",
      ])
    ).toThrow("--max-artifact-age-hours must be a positive integer");
  });

  it("rejects value flags without values", () => {
    expect(() => parseCliArgs(["--output-json"])).toThrow(
      "--output-json requires a value."
    );
    expect(() => parseCliArgs(["--output-json="])).toThrow(
      "--output-json requires a value."
    );
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/analog.json", "--max-distance-km"])
    ).toThrow("--max-distance-km requires a value.");
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/analog.json", "--min-confidence="])
    ).toThrow("--min-confidence requires a value.");
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/analog.json", "--limit"])
    ).toThrow("--limit requires a value.");
    expect(() => parseCliArgs(["--validate-output-json"])).toThrow(
      "--validate-output-json requires a value."
    );
    expect(() =>
      parseCliArgs(["--validate-output-json=/tmp/x.json", "--max-artifact-age-hours"])
    ).toThrow("--max-artifact-age-hours requires a value.");
  });

  it("rejects unknown arguments", () => {
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/analog.json", "--max-distance"])
    ).toThrow("Unknown argument: --max-distance.");
    expect(() =>
      parseCliArgs(["--output-json", "/tmp/analog.json", "/tmp/extra.json"])
    ).toThrow("Unknown argument: /tmp/extra.json.");
  });

  it("classifies common break type labels", () => {
    expect(classifyBreakType("exposed beach break")).toBe("beach");
    expect(classifyBreakType("reef and point")).toBe("reef");
    expect(classifyBreakType("river mouth sandbar")).toBe("river");
    expect(classifyBreakType("shorebreak")).toBe("shorebreak");
    expect(classifyBreakType(null)).toBe("other");
  });

  it("scores nearby same-class analog donors with high confidence", () => {
    const target = beach({ id: "target" });
    const donor = beach({
      id: "donor",
      name: "Donor",
      slug: "donor",
      lat: 32.76,
      lon: -117.26,
      shoaling_factors: SHOALING_FACTORS,
    });

    const scored = scoreDonor(target, donor);

    expect(scored.confidence).toBe("high");
    expect(scored.sameRegion).toBe(true);
    expect(scored.sameState).toBe(true);
    expect(scored.breakClass).toBe("beach");
    expect(scored.donorBreakClass).toBe("beach");
    expect(scored.distanceKm).toBeCloseTo(
      haversineKm(32.75, -117.25, 32.76, -117.26),
      3
    );
  });

  it("downgrades mismatched break classes even when nearby", () => {
    expect(
      confidenceFor({
        distanceKm: 2,
        breakClass: "beach",
        donorBreakClass: "point",
        sameRegion: true,
        sameState: true,
        exposureDeltaDeg: 5,
      })
    ).toBe("low");
  });

  it("selects the same-class donor over a closer mismatched donor", () => {
    const target = beach({ id: "target" });
    const nearbyPoint = beach({
      id: "nearby-point",
      name: "Nearby Point",
      lat: 32.751,
      lon: -117.251,
      break_type: "point",
      shoaling_factors: SHOALING_FACTORS,
    });
    const fartherBeach = beach({
      id: "farther-beach",
      name: "Farther Beach",
      lat: 33.1,
      lon: -117.3,
      break_type: "beach",
      shoaling_factors: SHOALING_FACTORS,
    });

    const selected = selectBestAnalogDonor({
      target,
      donors: [nearbyPoint, fartherBeach],
      maxDistanceKm: 100,
      minConfidence: "low",
    });

    expect(selected?.donor.id).toBe("farther-beach");
    expect(selected?.confidence).toBe("medium");
  });

  it("builds a harness-compatible proposed export with explicit skips", () => {
    const generatedAt = new Date("2026-06-19T12:00:00Z");
    const donor = beach({
      id: "donor",
      name: "Donor Beach",
      slug: "donor-beach",
      lat: 32.76,
      lon: -117.26,
      shoaling_factors: SHOALING_FACTORS,
    });
    const target = beach({
      id: "target",
      name: "Target Beach",
      slug: "target-beach",
      lat: 32.77,
      lon: -117.27,
    });
    const missingCoordinates = beach({
      id: "missing-coordinates",
      name: "Missing Coordinates",
      lat: null,
      lon: null,
    });
    const farTarget = beach({
      id: "far-target",
      name: "Far Target",
      region: "Santa Cruz",
      lat: 36.96,
      lon: -122.02,
    });

    const proposedExport = buildAnalogShoalingProposedExport({
      rows: [donor, target, missingCoordinates, farTarget],
      maxDistanceKm: 100,
      minConfidence: "medium",
      limit: null,
      generatedAt,
    });

    expect(proposedExport.summary).toEqual({
      active_beaches: 4,
      calibrated_donors: 1,
      uncalibrated_targets: 3,
      proposed_count: 1,
      skipped_count: 2,
      confidence_counts: {
        high: 1,
        medium: 0,
        low: 0,
      },
    });
    expect(proposedExport.artifact_schema_version).toBe(1);
    expect(proposedExport.approval_policy).toEqual({
      status: "harness_only",
      production_write_allowed: false,
      requires_phase0_approval: true,
      required_gate: "0-72h",
      required_metric: "face_height_mae",
      required_validator: "forecast-accuracy-report-validate --approval",
      min_gate_samples: 75,
      min_slice_samples: 25,
      max_report_age_hours: 24,
    });
    expect(proposedExport.beaches[0]).toMatchObject({
      id: "target",
      slug: "target-beach",
      shoaling_factors: {
        version: 1,
        type: "period_lookup",
        calibration: {
          source: "analog_transfer_unvalidated",
          analog_transfer: {
            method: "nearest_calibrated_break_type_v1",
            approval_status: "harness_only",
            source_quality: "analog_transfer_unvalidated",
            generated_at: "2026-06-19T12:00:00.000Z",
            target_beach_id: "target",
            donor_beach_id: "donor",
            donor_calibration_source: "validated",
            confidence: "high",
          },
        },
      },
      analog_transfer: {
        method: "nearest_calibrated_break_type_v1",
        approval_status: "harness_only",
        source_quality: "analog_transfer_unvalidated",
        confidence: "high",
        donor_beach_id: "donor",
        donor_beach_name: "Donor Beach",
        same_region: true,
        same_state: true,
        target_break_class: "beach",
        donor_break_class: "beach",
      },
    });
    expect(proposedExport.skipped.map((skip) => skip.reason)).toEqual([
      "missing coordinates",
      "no donor met distance and confidence gates",
    ]);
  });

  it("validates generated analog proposed artifacts", () => {
    const proposedExport = buildValidProposedExport();

    expect(
      validateAnalogShoalingProposedExportArtifact(proposedExport, {
        now: new Date("2026-06-19T13:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("rejects malformed analog artifact approval metadata", () => {
    const proposedExport = buildValidProposedExport();
    const malformedArtifact = {
      ...proposedExport,
      artifact_schema_version: 0,
      approval_policy: {
        ...proposedExport.approval_policy,
        production_write_allowed: true,
      },
    } as unknown as typeof proposedExport;

    expect(
      validateAnalogShoalingProposedExportArtifact(malformedArtifact, {
        now: new Date("2026-06-19T13:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Analog proposed artifact must declare artifact_schema_version 1.",
        "Analog proposed artifact approval_policy.production_write_allowed must be false.",
      ]),
    });
  });

  it("rejects stale or internally inconsistent analog artifacts", () => {
    const proposedExport = buildValidProposedExport();
    const proposedFactors = proposedExport.beaches[0].shoaling_factors as
      Record<string, unknown> & {
        calibration: {
          analog_transfer: Record<string, unknown>;
        };
      };
    const inconsistentArtifact = {
      ...proposedExport,
      summary: {
        ...proposedExport.summary,
        proposed_count: 2,
        confidence_counts: {
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      beaches: [
        {
          ...proposedExport.beaches[0],
          shoaling_factors: {
            ...proposedFactors,
            calibration: {
              ...proposedFactors.calibration,
              analog_transfer: {
                ...proposedFactors.calibration.analog_transfer,
                donor_beach_id: "wrong-donor",
              },
            },
          },
        },
      ],
    } as typeof proposedExport;

    expect(
      validateAnalogShoalingProposedExportArtifact(inconsistentArtifact, {
        now: new Date("2026-06-21T13:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Analog proposed artifact age 49.000h exceeds 24h.",
        "Analog proposed artifact summary.proposed_count must match beaches.length.",
        "Analog proposed artifact summary.confidence_counts.high must match beach rows.",
        "Analog proposed beach target calibration.analog_transfer.donor_beach_id must match row metadata.",
      ]),
    });
  });

  it("rejects overlapping or out-of-order analog period buckets", () => {
    const proposedExport = buildValidProposedExport();
    const proposedFactors = proposedExport.beaches[0].shoaling_factors as
      Record<string, unknown>;
    const overlappingArtifact = {
      ...proposedExport,
      beaches: [
        {
          ...proposedExport.beaches[0],
          shoaling_factors: {
            ...proposedFactors,
            buckets: [
              { tp_min_s: 0, tp_max_s: 8, factor: 1.05 },
              { tp_min_s: 7, tp_max_s: 12, factor: 1.1 },
            ],
          },
        },
      ],
    } as typeof proposedExport;

    expect(
      validateAnalogShoalingProposedExportArtifact(overlappingArtifact, {
        now: new Date("2026-06-19T13:00:00Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Analog proposed beach target bucket 1 overlaps or is out of order.",
      ]),
    });
  });

  it("writes newline-terminated JSON", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "analog-shoaling-"));
    const outputPath = join(outputDir, "proposed.json");

    const resolvedPath = writeAnalogShoalingProposedExport(outputPath, {
      artifact_schema_version: 1,
      generated_at: "2026-06-19T12:00:00.000Z",
      method: "nearest_calibrated_break_type_v1",
      approval_policy: {
        status: "harness_only",
        production_write_allowed: false,
        requires_phase0_approval: true,
        required_gate: "0-72h",
        required_metric: "face_height_mae",
        required_validator: "forecast-accuracy-report-validate --approval",
        min_gate_samples: 75,
        min_slice_samples: 25,
        max_report_age_hours: 24,
      },
      filters: {
        max_distance_km: 100,
        min_confidence: "medium",
        limit: null,
      },
      summary: {
        active_beaches: 0,
        calibrated_donors: 0,
        uncalibrated_targets: 0,
        proposed_count: 0,
        skipped_count: 0,
        confidence_counts: {
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      beaches: [],
      skipped: [],
    });

    expect(resolvedPath).toBe(outputPath);
    expect(readFileSync(outputPath, "utf8")).toMatch(/\n$/);
  });
});

function buildValidProposedExport(): ReturnType<
  typeof buildAnalogShoalingProposedExport
> {
  const generatedAt = new Date("2026-06-19T12:00:00Z");
  const donor = beach({
    id: "donor",
    name: "Donor Beach",
    slug: "donor-beach",
    lat: 32.76,
    lon: -117.26,
    shoaling_factors: SHOALING_FACTORS,
  });
  const target = beach({
    id: "target",
    name: "Target Beach",
    slug: "target-beach",
    lat: 32.77,
    lon: -117.27,
  });

  return buildAnalogShoalingProposedExport({
    rows: [donor, target],
    maxDistanceKm: 100,
    minConfidence: "medium",
    limit: null,
    generatedAt,
  });
}
