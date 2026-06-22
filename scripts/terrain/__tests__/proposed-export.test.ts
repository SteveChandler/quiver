import { DEFAULT_TERRAIN_PARAMS } from "../../../types/terrain";
import {
  buildTerrainProposedExport,
  buildTerrainProposedSubsetExport,
  validateTerrainProposedExportArtifact,
} from "../proposed-export";
import type { AnalysisSummary, BeachAnalysisResult } from "../types";

function factors(value: number): number[] {
  return Array.from({ length: 72 }, () => value);
}

const summary: AnalysisSummary = {
  total_beaches: 3,
  successful: 2,
  failed: 1,
  skipped: 0,
  total_time_ms: 3000,
  avg_time_per_beach_ms: 1000,
};

describe("terrain proposed export", () => {
  it("builds Phase 0 harness proposed-json beach configs", () => {
    const results: BeachAnalysisResult[] = [
      {
        beach_id: "beach-1",
        beach_name: "Complete Beach",
        success: true,
        wind_exposure_factors: factors(0.9),
        swell_access_factors: factors(0.8),
        terrain_params: DEFAULT_TERRAIN_PARAMS,
        terrain_params_hash: "hash-1",
        terrain_status: "ok",
      },
      {
        beach_id: "beach-2",
        beach_name: "Incomplete Beach",
        success: true,
        wind_exposure_factors: factors(0.7),
      },
      {
        beach_id: "beach-3",
        beach_name: "Failed Beach",
        success: false,
        error: "DEM unavailable",
      },
    ];

    const proposedExport = buildTerrainProposedExport({
      results,
      summary,
      terrainMethod: "dem_horizon_v1",
      args: {
        dryRun: true,
        force: false,
        missingOnly: true,
        region: "Jersey Shore",
        outputJsonPath: "/tmp/terrain-proposed.json",
      },
      generatedAt: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(proposedExport).toMatchObject({
      artifact_schema_version: 1,
      generated_at: "2026-06-19T12:00:00.000Z",
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
      filters: {
        missingOnly: true,
        region: "Jersey Shore",
        force: false,
      },
      summary,
      beaches: [
        {
          id: "beach-1",
          name: "Complete Beach",
          wind_exposure_factors: factors(0.9),
          swell_access_factors: factors(0.8),
          terrain_method: "dem_horizon_v1",
          terrain_params: DEFAULT_TERRAIN_PARAMS,
          terrain_params_hash: "hash-1",
          terrain_status: "ok",
        },
      ],
      failures: [
        {
          id: "beach-3",
          name: "Failed Beach",
          error: "DEM unavailable",
        },
      ],
    });
  });

  it("validates generated proposed terrain artifacts", () => {
    const proposedExport = buildValidProposedExport();

    expect(
      validateTerrainProposedExportArtifact(proposedExport, {
        now: new Date("2026-06-19T13:00:00.000Z"),
        maxArtifactAgeHours: 24,
      })
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("rejects malformed proposed terrain approval metadata", () => {
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
      validateTerrainProposedExportArtifact(malformedArtifact, {
        now: new Date("2026-06-19T13:00:00.000Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Terrain proposed artifact must declare artifact_schema_version 1.",
        "Terrain proposed artifact approval_policy.production_write_allowed must be false.",
      ]),
    });
  });

  it("rejects failed terrain status in proposed write-bearing beach configs", () => {
    const proposedExport = buildValidProposedExport();
    const malformedArtifact = {
      ...proposedExport,
      beaches: [
        {
          ...proposedExport.beaches[0],
          terrain_status: "failed",
        },
      ],
    } as typeof proposedExport;

    expect(
      validateTerrainProposedExportArtifact(malformedArtifact, {
        now: new Date("2026-06-19T13:00:00.000Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Terrain proposed beach beach-1 terrain_status is invalid.",
      ]),
    });
  });

  it("rejects stale or internally inconsistent proposed terrain artifacts", () => {
    const proposedExport = buildValidProposedExport();
    const malformedArtifact = {
      ...proposedExport,
      summary: {
        ...proposedExport.summary,
        successful: 0,
        failed: 0,
      },
      beaches: [
        {
          ...proposedExport.beaches[0],
          wind_exposure_factors: [
            ...proposedExport.beaches[0].wind_exposure_factors.slice(0, 5),
            1.5,
            ...proposedExport.beaches[0].wind_exposure_factors.slice(6),
          ],
        },
      ],
      failures: [
        {
          id: proposedExport.beaches[0].id,
          name: "Overlapping Failure",
          error: "failed",
        },
      ],
    };

    expect(
      validateTerrainProposedExportArtifact(malformedArtifact, {
        now: new Date("2026-06-21T13:00:00.000Z"),
        maxArtifactAgeHours: 24,
      })
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        "Terrain proposed artifact age 49.000h exceeds 24h.",
        "Terrain proposed artifact summary.total_beaches must equal successful + failed.",
        "Terrain proposed artifact beaches.length cannot exceed summary.successful.",
        "Terrain proposed artifact failures.length must match summary.failed.",
        "Terrain proposed beach beach-1 wind_exposure_factors has invalid value at index 5.",
        "Terrain proposed failure beach id beach-1 also appears in beaches.",
      ]),
    });
  });

  it("builds a proposed-json subset for explicitly approved beaches", () => {
    const fullExport = buildTerrainProposedExport({
      results: [
        {
          beach_id: "beach-1",
          beach_name: "Safe Beach",
          success: true,
          wind_exposure_factors: factors(0.9),
          swell_access_factors: factors(0.8),
          terrain_params: DEFAULT_TERRAIN_PARAMS,
          terrain_params_hash: "hash-1",
          terrain_status: "ok",
        },
        {
          beach_id: "beach-2",
          beach_name: "Regressing Beach",
          success: true,
          wind_exposure_factors: factors(0.7),
          swell_access_factors: factors(0.6),
          terrain_params: DEFAULT_TERRAIN_PARAMS,
          terrain_params_hash: "hash-2",
          terrain_status: "ok",
        },
        {
          beach_id: "beach-3",
          beach_name: "Failed Beach",
          success: false,
          error: "DEM unavailable",
        },
      ],
      summary: {
        total_beaches: 3,
        successful: 2,
        failed: 1,
        skipped: 0,
        total_time_ms: 3000,
        avg_time_per_beach_ms: 1000,
      },
      terrainMethod: "dem_horizon_v1",
      args: {
        dryRun: true,
        force: false,
        missingOnly: true,
        outputJsonPath: "/tmp/terrain-proposed.json",
      },
      generatedAt: new Date("2026-06-19T12:00:00.000Z"),
    });

    const subsetExport = buildTerrainProposedSubsetExport(fullExport, [
      "beach-1",
    ]);

    expect(subsetExport).toMatchObject({
      approval_policy: fullExport.approval_policy,
      filters: {
        missingOnly: true,
        force: false,
        beachId: "beach-1",
      },
      summary: {
        total_beaches: 1,
        successful: 1,
        failed: 0,
        skipped: 0,
        total_time_ms: 1000,
        avg_time_per_beach_ms: 1000,
      },
      beaches: [
        {
          id: "beach-1",
          name: "Safe Beach",
          terrain_method: "dem_horizon_v1",
        },
      ],
      failures: [],
    });
    expect(subsetExport.filters).not.toHaveProperty("beachIds");
  });

  it("builds multi-beach subset filters with the exact selected beach IDs", () => {
    const fullExport = buildTerrainProposedExport({
      results: [
        {
          beach_id: "beach-1",
          beach_name: "Safe Beach",
          success: true,
          wind_exposure_factors: factors(0.9),
          swell_access_factors: factors(0.8),
          terrain_params: DEFAULT_TERRAIN_PARAMS,
          terrain_params_hash: "hash-1",
          terrain_status: "ok",
        },
        {
          beach_id: "beach-2",
          beach_name: "Also Safe Beach",
          success: true,
          wind_exposure_factors: factors(0.7),
          swell_access_factors: factors(0.6),
          terrain_params: DEFAULT_TERRAIN_PARAMS,
          terrain_params_hash: "hash-2",
          terrain_status: "ok",
        },
        {
          beach_id: "beach-3",
          beach_name: "Unselected Beach",
          success: true,
          wind_exposure_factors: factors(0.5),
          swell_access_factors: factors(0.4),
          terrain_params: DEFAULT_TERRAIN_PARAMS,
          terrain_params_hash: "hash-3",
          terrain_status: "ok",
        },
      ],
      summary: {
        total_beaches: 3,
        successful: 3,
        failed: 0,
        skipped: 0,
        total_time_ms: 3000,
        avg_time_per_beach_ms: 1000,
      },
      terrainMethod: "dem_horizon_v1",
      args: {
        dryRun: true,
        force: false,
        missingOnly: true,
        beachId: "stale-single-scope",
        beachIds: ["beach-1", "beach-2", "beach-3"],
        region: "Monterey Bay",
        outputJsonPath: "/tmp/terrain-proposed.json",
      },
      generatedAt: new Date("2026-06-19T12:00:00.000Z"),
    });

    const subsetExport = buildTerrainProposedSubsetExport(fullExport, [
      "beach-1",
      "beach-2",
    ]);

    expect(subsetExport.filters).toEqual({
      missingOnly: true,
      force: false,
      region: "Monterey Bay",
      beachIds: ["beach-1", "beach-2"],
    });
    expect(subsetExport.filters).not.toHaveProperty("beachId");
    expect(subsetExport.beaches.map((beach) => beach.id)).toEqual([
      "beach-1",
      "beach-2",
    ]);
  });

  it("includes exact beach IDs in proposed export filters", () => {
    const proposedExport = buildTerrainProposedExport({
      results: [],
      summary: {
        total_beaches: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        total_time_ms: 0,
        avg_time_per_beach_ms: 0,
      },
      terrainMethod: "dem_horizon_v1",
      args: {
        dryRun: true,
        force: false,
        missingOnly: true,
        beachIds: ["beach-1", "beach-2"],
        outputJsonPath: "/tmp/terrain-proposed.json",
      },
      generatedAt: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(proposedExport.filters).toMatchObject({
      missingOnly: true,
      beachIds: ["beach-1", "beach-2"],
      force: false,
    });
  });
});

function buildValidProposedExport(): ReturnType<typeof buildTerrainProposedExport> {
  return buildTerrainProposedExport({
    results: [
      {
        beach_id: "beach-1",
        beach_name: "Complete Beach",
        success: true,
        wind_exposure_factors: factors(0.9),
        swell_access_factors: factors(0.8),
        terrain_params: DEFAULT_TERRAIN_PARAMS,
        terrain_params_hash: "hash-1",
        terrain_status: "ok",
      },
      {
        beach_id: "beach-2",
        beach_name: "Failed Beach",
        success: false,
        error: "DEM unavailable",
      },
    ],
    summary: {
      total_beaches: 2,
      successful: 1,
      failed: 1,
      skipped: 0,
      total_time_ms: 2000,
      avg_time_per_beach_ms: 1000,
    },
    terrainMethod: "dem_horizon_v1",
    args: {
      dryRun: true,
      force: false,
      missingOnly: true,
      outputJsonPath: "/tmp/terrain-proposed.json",
    },
    generatedAt: new Date("2026-06-19T12:00:00.000Z"),
  });
}
