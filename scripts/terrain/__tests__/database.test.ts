import { countBeaches, loadBeaches } from "../database";
import { parseTerrainAnalysisArgs } from "../cli";

class MockQuery {
  calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: unknown) {}

  select(...args: unknown[]): this {
    this.calls.push({ method: "select", args });
    return this;
  }

  order(...args: unknown[]): this {
    this.calls.push({ method: "order", args });
    return this;
  }

  eq(...args: unknown[]): this {
    this.calls.push({ method: "eq", args });
    return this;
  }

  is(...args: unknown[]): this {
    this.calls.push({ method: "is", args });
    return this;
  }

  or(...args: unknown[]): this {
    this.calls.push({ method: "or", args });
    return this;
  }

  ilike(...args: unknown[]): this {
    this.calls.push({ method: "ilike", args });
    return this;
  }

  in(...args: unknown[]): this {
    this.calls.push({ method: "in", args });
    return this;
  }

  limit(...args: unknown[]): this {
    this.calls.push({ method: "limit", args });
    return this;
  }

  range(...args: unknown[]): this {
    this.calls.push({ method: "range", args });
    return this;
  }

  then(resolve: (value: unknown) => void): void {
    resolve(this.result);
  }
}

function createSupabaseMock(result: unknown): {
  supabase: { from: jest.Mock<MockQuery, [string]> };
  query: MockQuery;
} {
  const query = new MockQuery(result);
  const from: jest.Mock<MockQuery, [string]> = jest.fn(
    (_table: string) => query
  );
  return {
    supabase: {
      from,
    },
    query,
  };
}

describe("terrain database filters", () => {
  it("parses --missing-only with dry-run arguments", () => {
    expect(
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--missing-only",
        "--dry-run",
        "--concurrency=2",
        "--output-json",
        "/tmp/terrain-proposed.json",
      ])
    ).toEqual({
      dryRun: true,
      force: false,
      concurrency: 2,
      missingOnly: true,
      outputJsonPath: "/tmp/terrain-proposed.json",
    });
  });

  it("parses proposed artifact validation mode", () => {
    expect(
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--validate-output-json",
        "/tmp/terrain-proposed.json",
        "--max-artifact-age-hours=24",
      ])
    ).toEqual({
      dryRun: false,
      force: false,
      concurrency: 4,
      validateOutputJsonPath: "/tmp/terrain-proposed.json",
      maxArtifactAgeHours: 24,
    });
  });

  it("rejects duplicate --beach-ids entries", () => {
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--beach-ids",
        "beach-1, beach-2,beach-1",
        "--dry-run",
      ])
    ).toThrow("Duplicate --beach-ids value(s): beach-1.");
  });

  it("rejects terrain CLI value flags without values", () => {
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--beach-id",
      ])
    ).toThrow("--beach-id requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--beach-ids=",
      ])
    ).toThrow("--beach-ids requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--region",
        "--dry-run",
      ])
    ).toThrow("--region requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--limit",
      ])
    ).toThrow("--limit requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--output-json=",
      ])
    ).toThrow("--output-json requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--validate-output-json",
      ])
    ).toThrow("--validate-output-json requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--max-artifact-age-hours=",
      ])
    ).toThrow("--max-artifact-age-hours requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--approval-report-json",
        "--approval-proposed-json",
        "/tmp/proposed.json",
      ])
    ).toThrow("--approval-report-json requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--approval-proposed-json=",
      ])
    ).toThrow("--approval-proposed-json requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--max-approval-report-age-hours",
      ])
    ).toThrow("--max-approval-report-age-hours requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--min-approval-gate-samples=",
      ])
    ).toThrow("--min-approval-gate-samples requires a value.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--min-approval-slice-samples",
      ])
    ).toThrow("--min-approval-slice-samples requires a value.");
  });

  it("rejects unknown terrain CLI arguments", () => {
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--dryrun",
      ])
    ).toThrow("Unknown argument: --dryrun.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--approval-report",
        "/tmp/harness.json",
      ])
    ).toThrow("Unknown argument: --approval-report.");
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "/tmp/extra.json",
      ])
    ).toThrow("Unknown argument: /tmp/extra.json.");
  });

  it("parses terrain write approval artifacts and thresholds", () => {
    expect(
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--beach-ids=beach-1,beach-2",
        "--approval-report-json",
        "/tmp/harness.json",
        "--approval-proposed-json=/tmp/proposed.json",
        "--human-approval-token=2026-06-19-phase2-terrain-write-approved",
        "--max-approval-report-age-hours=12",
        "--min-approval-gate-samples",
        "75",
        "--min-approval-slice-samples=25",
      ])
    ).toEqual({
      dryRun: false,
      force: false,
      concurrency: 4,
      beachIds: ["beach-1", "beach-2"],
      approvalReportJsonPath: "/tmp/harness.json",
      approvalProposedJsonPath: "/tmp/proposed.json",
      humanApprovalToken: "2026-06-19-phase2-terrain-write-approved",
      maxApprovalReportAgeHours: 12,
      minApprovalGateSamples: 75,
      minApprovalSliceSamples: 25,
    });
  });

  it("rejects invalid terrain write approval thresholds", () => {
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--min-approval-gate-samples=abc",
      ])
    ).toThrow("--min-approval-gate-samples must be a positive integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--min-approval-slice-samples",
        "0",
      ])
    ).toThrow("--min-approval-slice-samples must be a positive integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--max-approval-report-age-hours=-1",
      ])
    ).toThrow("--max-approval-report-age-hours must be a positive integer.");
  });

  it("rejects invalid terrain batch numeric arguments", () => {
    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--limit=10beaches",
      ])
    ).toThrow("--limit must be a positive integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--limit",
        "0",
      ])
    ).toThrow("--limit must be a positive integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--offset=-1",
      ])
    ).toThrow("--offset must be a non-negative integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--offset",
        "1.5",
      ])
    ).toThrow("--offset must be a non-negative integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--concurrency=0",
      ])
    ).toThrow("--concurrency must be a positive integer.");

    expect(() =>
      parseTerrainAnalysisArgs([
        "node",
        "scripts/terrain-analysis.ts",
        "--concurrency",
        "2.5",
      ])
    ).toThrow("--concurrency must be a positive integer.");
  });

  it("loads only active terrain gaps when missingOnly is set", async () => {
    const { supabase, query } = createSupabaseMock({
      data: [
        {
          id: "beach-1",
          name: "Gap Beach",
          lat: 33,
          lon: -118,
          terrain_enabled: false,
        },
      ],
      error: null,
    });

    await loadBeaches(supabase as any, { missingOnly: true });

    expect(supabase.from).toHaveBeenCalledWith("beaches");
    expect(query.calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });
    expect(query.calls).toContainEqual({
      method: "or",
      args: [
        "terrain_status.is.null,swell_access_factors.is.null,wind_exposure_factors.is.null",
      ],
    });
  });

  it("filters by region without referencing the removed location column", async () => {
    const { supabase, query } = createSupabaseMock({
      data: [],
      error: null,
    });

    await loadBeaches(supabase as any, { region: "Jersey Shore" });

    expect(query.calls).toContainEqual({
      method: "ilike",
      args: ["region", "%jersey shore%"],
    });
    expect(query.calls).not.toContainEqual(
      expect.objectContaining({
        method: "or",
        args: expect.arrayContaining([
          expect.stringContaining("location.ilike"),
        ]),
      })
    );
  });

  it("loads exact beach IDs when beachIds is set", async () => {
    const { supabase, query } = createSupabaseMock({
      data: [],
      error: null,
    });

    await loadBeaches(supabase as any, {
      beachIds: ["beach-1", "beach-2"],
    });

    expect(query.calls).toContainEqual({
      method: "in",
      args: ["id", ["beach-1", "beach-2"]],
    });
  });

  it("counts only active terrain gaps when missingOnly is set", async () => {
    const { supabase, query } = createSupabaseMock({
      count: 57,
      error: null,
    });

    await expect(countBeaches(supabase as any, { missingOnly: true })).resolves.toBe(57);

    expect(supabase.from).toHaveBeenCalledWith("beaches");
    expect(query.calls).toContainEqual({
      method: "is",
      args: ["deleted_at", null],
    });
    expect(query.calls).toContainEqual({
      method: "or",
      args: [
        "terrain_status.is.null,swell_access_factors.is.null,wind_exposure_factors.is.null",
      ],
    });
  });

  it("counts exact beach IDs when beachIds is set", async () => {
    const { supabase, query } = createSupabaseMock({
      count: 2,
      error: null,
    });

    await expect(
      countBeaches(supabase as any, {
        beachIds: ["beach-1", "beach-2"],
      })
    ).resolves.toBe(2);

    expect(query.calls).toContainEqual({
      method: "in",
      args: ["id", ["beach-1", "beach-2"]],
    });
  });
});
