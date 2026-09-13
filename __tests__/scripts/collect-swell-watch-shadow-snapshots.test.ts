import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  collectSwellWatchShadowSnapshots,
  normalizeSnapshotRow,
  type CollectorDependencies,
  type ForecastSourceRow,
} from "@/scripts/collect-swell-watch-shadow-snapshots";

const enhanced: ForecastSourceRow = {
  source_table: "enhanced_forecasts",
  beach_id: "raw-beach-id",
  source_key: "2026-09-03T18:00:00.000Z:raw-beach-id",
  forecast_at: "2026-09-03T18:00:00.000Z",
  updated_at: "2026-09-03T17:00:00.000Z",
  data_source: "NOAA_NWS",
  swell_1_height: "2 ft",
  swell_1_period: "12s",
  swell_1_direction: "S",
  swell_2_height: null,
  swell_2_period: null,
  swell_2_direction: null,
  swell_height_om: 1.5,
  swell_period_om: 12,
  swell_direction_om: 170,
};
const gfs: ForecastSourceRow = {
  source_table: "gfs_wave_shadow_forecasts",
  beach_id: "raw-beach-id",
  source_key: "2026-09-03T17:00:00.000Z:gfs-row-1",
  forecast_at: "2026-09-03T18:00:00.000Z",
  updated_at: "2026-09-03T17:00:00.000Z",
  swell_height_om: 1.5,
  swell_period_om: 12,
  swell_direction_om: 170,
  secondary_swell_height_m: 0,
  secondary_swell_period_s: 9,
  secondary_swell_direction_deg: 220,
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deps(
  overrides: Partial<CollectorDependencies> = {},
): CollectorDependencies {
  return {
    checkIgnored: jest.fn().mockResolvedValue(true),
    loadCredentials: jest
      .fn()
      .mockResolvedValue({ url: "https://example.invalid", key: "test" }),
    fetchPage: jest.fn().mockImplementation((_credentials, source, cursor) => {
      if (cursor) return Promise.resolve([]);
      return Promise.resolve(
        source === "enhanced_forecasts" ? [enhanced] : [gfs],
      );
    }),
    now: jest.fn().mockReturnValue(new Date("2026-09-03T18:30:00.000Z")),
    randomBytes: jest.fn().mockReturnValue(Buffer.alloc(32, 7)),
    ...overrides,
  };
}

async function options(): Promise<{
  directory: string;
  outDir: string;
  worktreeRoot: string;
  envFile: string;
  maxRows: number;
  pageSize: number;
}> {
  const directory = await mkdtemp(join(tmpdir(), "swell-watch-collector-"));
  return {
    directory,
    outDir: join(directory, "collection"),
    worktreeRoot: directory,
    envFile: join(directory, ".env.production.local"),
    maxRows: 10,
    pageSize: 5,
  };
}

describe("swell-watch shadow snapshot collection", () => {
  it("accepts the expanded row cap and rejects larger requests before access", async () => {
    const input = await options();
    const dependencies = deps();
    try {
      await expect(
        collectSwellWatchShadowSnapshots({ ...input, maxRows: 250_001 }, dependencies),
      ).rejects.toThrow();
      expect(dependencies.loadCredentials).not.toHaveBeenCalled();
      expect(dependencies.fetchPage).not.toHaveBeenCalled();
      const result = await collectSwellWatchShadowSnapshots(
        { ...input, maxRows: 250_000 }, dependencies,
      );
      expect(result.manifest).toMatchObject({ status: "complete", queried_row_count: 2, truncated: false });
    } finally {
      await rm(input.directory, { recursive: true, force: true });
    }
  });

  it("distinguishes absent from numeric-zero tuples and parses canonical ft/cardinals", () => {
    const canonical = normalizeSnapshotRow(
      enhanced,
      Buffer.alloc(32, 1),
      "2026-09-03T18:30:00.000Z",
    );
    const raw = normalizeSnapshotRow(
      gfs,
      Buffer.alloc(32, 1),
      "2026-09-03T18:30:00.000Z",
    );

    expect(canonical?.canonical_swell).toMatchObject({
      primary: {
        height_m: 0.6096,
        period_s: 12,
        direction_deg: 180,
        completeness: "complete",
      },
      secondary: { completeness: "absent", height_m: null },
    });
    expect(canonical?.raw_open_meteo_swell?.secondary).toMatchObject({
      completeness: "absent",
      height_m: null,
    });
    expect(raw?.raw_open_meteo_swell?.secondary).toMatchObject({
      height_m: 0,
      period_s: 9,
      direction_deg: 220,
      completeness: "complete",
    });
    expect(canonical?.provider).toBe("noaa");
    expect(raw?.provider).toBe("open_meteo");
  });

  it("rejects a nonignored destination before credentials, requests, or writes", async () => {
    const input = await options();
    const dependencies = deps({
      checkIgnored: jest.fn().mockResolvedValue(false),
    });
    await expect(
      collectSwellWatchShadowSnapshots(input, dependencies),
    ).rejects.toThrow("output destination is not ignored");
    expect(dependencies.loadCredentials).not.toHaveBeenCalled();
    expect(dependencies.fetchPage).not.toHaveBeenCalled();
    await expect(stat(input.outDir)).rejects.toThrow();
    await rm(input.directory, { recursive: true, force: true });
  });

  it("writes private split-source snapshots, quarantines V1, and does not inflate duplicate evaluations", async () => {
    const input = await options();
    const first = await collectSwellWatchShadowSnapshots(input, deps());
    const artifact = await readFile(first.artifactPath, "utf8");
    expect(artifact).not.toContain("raw-beach-id");
    expect(artifact).not.toContain("test");
    expect(first.manifest).toMatchObject({
      schema_version: "swell-watch-shadow-snapshot.v2",
      source_coverage: { enhanced_forecasts: 1, gfs_wave_shadow_forecasts: 1 },
      immutable_issuance_count: 0,
      completed_evaluation_count: 0,
      new_observation_count: 2,
    });
    expect((await stat(input.outDir)).mode & 0o777).toBe(0o700);
    expect((await stat(first.artifactPath)).mode & 0o777).toBe(0o600);
    const second = await collectSwellWatchShadowSnapshots(
      { ...input },
      deps({
        now: jest.fn().mockReturnValue(new Date("2026-09-03T18:31:00.000Z")),
      }),
    );
    expect(second.manifest).toMatchObject({
      new_observation_count: 0,
      deduplicated_observation_count: 2,
      completed_evaluation_count: 0,
    });
    await rm(input.directory, { recursive: true, force: true });
  });

  it("fails closed on a changed or missing key and a tampered prior artifact", async () => {
    const input = await options();
    const first = await collectSwellWatchShadowSnapshots(input, deps());
    await writeFile(
      join(input.outDir, ".collection-hmac-key.v1"),
      Buffer.alloc(32, 9).toString("base64"),
      { mode: 0o600 },
    );
    await expect(
      collectSwellWatchShadowSnapshots(
        { ...input },
        deps({
          now: jest.fn().mockReturnValue(new Date("2026-09-03T18:31:00.000Z")),
        }),
      ),
    ).rejects.toThrow("collector key changed");
    await writeFile(
      join(input.outDir, ".collection-hmac-key.v1"),
      Buffer.alloc(32, 7).toString("base64"),
      { mode: 0o600 },
    );
    await writeFile(first.artifactPath, "tampered\n", { mode: 0o600 });
    await expect(
      collectSwellWatchShadowSnapshots(
        { ...input },
        deps({
          now: jest.fn().mockReturnValue(new Date("2026-09-03T18:32:00.000Z")),
        }),
      ),
    ).rejects.toThrow("prior artifact integrity");
    await unlink(join(input.outDir, ".collection-hmac-key.v1"));
    await expect(
      collectSwellWatchShadowSnapshots(
        { ...input },
        deps({
          now: jest.fn().mockReturnValue(new Date("2026-09-03T18:33:00.000Z")),
        }),
      ),
    ).rejects.toThrow("collector key is missing");
    await rm(input.directory, { recursive: true, force: true });
  });

  it("rejects a corrupted prior manifest before loading credentials or fetching", async () => {
    const input = await options();
    const first = await collectSwellWatchShadowSnapshots(input, deps());
    const manifest = JSON.parse(
      await readFile(first.manifestPath, "utf8"),
    ) as Record<string, unknown>;
    manifest.page_size = 999;
    await writeFile(first.manifestPath, `${JSON.stringify(manifest)}\n`, {
      mode: 0o600,
    });
    const dependencies = deps({
      now: jest.fn().mockReturnValue(new Date("2026-09-03T18:31:00.000Z")),
    });

    await expect(
      collectSwellWatchShadowSnapshots(input, dependencies),
    ).rejects.toThrow("prior manifest integrity");
    expect(dependencies.loadCredentials).not.toHaveBeenCalled();
    expect(dependencies.fetchPage).not.toHaveBeenCalled();
    await rm(input.directory, { recursive: true, force: true });
  });

  it("rejects a prior artifact whose observation hash no longer matches its row", async () => {
    const input = await options();
    const first = await collectSwellWatchShadowSnapshots(input, deps());
    const row = JSON.parse(
      (await readFile(first.artifactPath, "utf8")).split("\n")[0],
    ) as Record<string, unknown>;
    row.observation_hash = "0".repeat(64);
    const artifact = `${stable(row)}\n`;
    const manifest = JSON.parse(
      await readFile(first.manifestPath, "utf8"),
    ) as Record<string, unknown>;
    manifest.artifact_sha256 = sha256(artifact);
    manifest.observation_hashes = [row.observation_hash];
    const { manifest_sha256: _oldHash, ...base } = manifest;
    manifest.manifest_sha256 = sha256(stable(base));
    await writeFile(first.artifactPath, artifact, { mode: 0o600 });
    await writeFile(first.manifestPath, `${stable(manifest)}\n`, {
      mode: 0o600,
    });
    const dependencies = deps({
      now: jest.fn().mockReturnValue(new Date("2026-09-03T18:31:00.000Z")),
    });

    await expect(
      collectSwellWatchShadowSnapshots(input, dependencies),
    ).rejects.toThrow("prior artifact integrity");
    expect(dependencies.fetchPage).not.toHaveBeenCalled();
    await rm(input.directory, { recursive: true, force: true });
  });

  it("rejects public and symlinked prior artifacts before fetching", async () => {
    const input = await options();
    const first = await collectSwellWatchShadowSnapshots(input, deps());
    const publicDependencies = deps({
      now: jest.fn().mockReturnValue(new Date("2026-09-03T18:31:00.000Z")),
    });
    await chmod(first.artifactPath, 0o644);

    await expect(
      collectSwellWatchShadowSnapshots(input, publicDependencies),
    ).rejects.toThrow("prior artifact is unavailable");
    expect(publicDependencies.fetchPage).not.toHaveBeenCalled();
    await chmod(first.artifactPath, 0o600);
    const target = join(input.directory, "artifact-target");
    await writeFile(target, "not an artifact", { mode: 0o600 });
    await unlink(first.artifactPath);
    await symlink(target, first.artifactPath);
    const symlinkDependencies = deps({
      now: jest.fn().mockReturnValue(new Date("2026-09-03T18:32:00.000Z")),
    });

    await expect(
      collectSwellWatchShadowSnapshots(input, symlinkDependencies),
    ).rejects.toThrow("prior artifact is unavailable");
    expect(symlinkDependencies.fetchPage).not.toHaveBeenCalled();
    await rm(input.directory, { recursive: true, force: true });
  });

  it("does not overwrite an existing capture when its generated ID collides", async () => {
    const input = await options();
    const fixedNow = jest
      .fn()
      .mockReturnValue(new Date("2026-09-03T18:30:00.000Z"));
    const fixedRandom = jest.fn().mockReturnValue(Buffer.alloc(32, 7));
    const first = await collectSwellWatchShadowSnapshots(
      input,
      deps({ now: fixedNow, randomBytes: fixedRandom }),
    );
    const originalArtifact = await readFile(first.artifactPath, "utf8");
    const originalManifest = await readFile(first.manifestPath, "utf8");

    await expect(
      collectSwellWatchShadowSnapshots(
        input,
        deps({ now: fixedNow, randomBytes: fixedRandom }),
      ),
    ).rejects.toMatchObject({ code: "EEXIST" });
    await expect(readFile(first.artifactPath, "utf8")).resolves.toBe(
      originalArtifact,
    );
    await expect(readFile(first.manifestPath, "utf8")).resolves.toBe(
      originalManifest,
    );
    await rm(input.directory, { recursive: true, force: true });
  });

  it("marks skipped invalid rows as incomplete coverage", async () => {
    const input = await options();
    const invalid = { ...enhanced, beach_id: "" };
    const result = await collectSwellWatchShadowSnapshots(
      input,
      deps({
        fetchPage: jest
          .fn()
          .mockImplementation((_credentials, source, cursor) => {
            if (cursor) return Promise.resolve([]);
            return Promise.resolve(
              source === "enhanced_forecasts" ? [enhanced, invalid] : [],
            );
          }),
      }),
    );

    expect(result.manifest).toMatchObject({
      status: "incomplete",
      skipped_invalid_row_count: 1,
    });
    expect(result.manifest.coverage_gaps).toContain(
      "capture skipped invalid source rows and is incomplete",
    );
    await rm(input.directory, { recursive: true, force: true });
  });

  it("uses the nondivisible remaining-row limit and marks a capped capture incomplete", async () => {
    const input = await options();
    input.maxRows = 7;
    const rows = Array.from({ length: 7 }, (_, index) => ({
      ...enhanced,
      beach_id: `beach-${index}`,
      source_key: `2026-09-03T${String(index).padStart(2, "0")}:00:00.000Z:beach-${index}`,
      forecast_at: `2026-09-03T${String(index).padStart(2, "0")}:00:00.000Z`,
    }));
    const fetchPage = jest
      .fn()
      .mockImplementation((_credentials, source, cursor, limit) => {
        if (source !== "enhanced_forecasts") return Promise.resolve([]);
        return Promise.resolve(
          cursor ? rows.slice(5, 5 + limit) : rows.slice(0, limit),
        );
      });
    const result = await collectSwellWatchShadowSnapshots(
      input,
      deps({ fetchPage }),
    );
    expect(fetchPage.mock.calls.map((call) => call[3])).toEqual([5, 2]);
    expect(result.manifest).toMatchObject({
      status: "incomplete",
      truncated: true,
      queried_row_count: 7,
    });
    await rm(input.directory, { recursive: true, force: true });
  });

  it("rejects symlink destinations and cleans an interrupted capture without an artifact", async () => {
    const input = await options();
    const target = join(input.directory, "target");
    await writeFile(target, "not-a-directory");
    await symlink(target, input.outDir);
    await expect(
      collectSwellWatchShadowSnapshots(input, deps()),
    ).rejects.toThrow("contains a symlink");
    await unlink(input.outDir);
    await unlink(target);
    await expect(
      collectSwellWatchShadowSnapshots(
        input,
        deps({
          fetchPage: jest
            .fn()
            .mockRejectedValue(new Error("source unavailable")),
        }),
      ),
    ).rejects.toThrow("source unavailable");
    expect(
      (await readdir(input.outDir)).filter(
        (name) => name.endsWith(".jsonl") || name.endsWith(".manifest.json"),
      ),
    ).toEqual([]);
    await rm(input.directory, { recursive: true, force: true });
  });
});
