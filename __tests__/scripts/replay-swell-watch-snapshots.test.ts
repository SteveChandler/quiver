import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { normalizeSnapshotRow, type ForecastSourceRow } from "@/scripts/collect-swell-watch-shadow-snapshots";
import { publishPrivateReplayOutcome, readReplayPolicyArtifact, replaySwellWatchSnapshots, resolveCaptureArtifactPath, type ReplayCapture } from "@/scripts/replay-swell-watch-snapshots";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const capturedAt = "2026-09-04T00:00:00.000Z";
const key = Buffer.alloc(32, 7);

function snapshot(source: ForecastSourceRow): Record<string, unknown> {
  const row = normalizeSnapshotRow(source, key, capturedAt);
  if (!row) throw new Error("fixture row is required");
  return row;
}

function enhanced(overrides: Partial<ForecastSourceRow> = {}): Record<string, unknown> {
  return snapshot({ source_table: "enhanced_forecasts", beach_id: "beach-a", source_key: "noaa-row", forecast_at: "2026-09-06T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z", data_source: "NOAA_NWS", swell_1_height: "2 ft", swell_1_period: "12s", swell_1_direction: "W", swell_2_height: "1 ft", swell_2_period: "9s", swell_2_direction: "SW", ...overrides });
}

function gfs(overrides: Partial<ForecastSourceRow> = {}): Record<string, unknown> {
  return snapshot({ source_table: "gfs_wave_shadow_forecasts", beach_id: "beach-a", source_key: "gfs-row", forecast_at: "2026-09-06T00:00:00.000Z", updated_at: "2026-09-04T00:00:00.000Z", swell_height_om: 0.61, swell_period_om: 12, swell_direction_om: 270, secondary_swell_height_m: 0.3, secondary_swell_period_s: 9, secondary_swell_direction_deg: 225, ...overrides });
}

function capture(captureId: string, rows: Record<string, unknown>[], overrides: Record<string, unknown> = {}): ReplayCapture {
  const artifact = `${rows.map(stable).join("\n")}\n`;
  const base = { schema_version: "swell-watch-shadow-snapshot.v2", status: "complete", capture_id: captureId, captured_at: capturedAt, artifact_file: `${captureId}.jsonl`, artifact_sha256: hash(artifact), key_fingerprint: hash(key.toString("base64")), source_tables: ["enhanced_forecasts", "gfs_wave_shadow_forecasts"], page_size: 2, page_count: 1, queried_row_count: rows.length, retained_row_count: rows.length, new_observation_count: rows.length, deduplicated_observation_count: 0, duplicate_within_capture_count: 0, skipped_invalid_row_count: 0, immutable_issuance_count: 0, immutable_issuance_unavailable_count: rows.length, completed_evaluation_count: 0, truncated: false, source_coverage: { enhanced_forecasts: 1, gfs_wave_shadow_forecasts: 1 }, coverage_gaps: ["immutable provider issuance/evaluation identity unavailable"], observation_hashes: rows.map((row) => row.observation_hash).sort(), quarantined_prior_capture_count: 0, quarantine_reason: null, ...overrides };
  return { artifact, manifest: { ...base, manifest_sha256: hash(stable(base)) } as any };
}

describe("replaySwellWatchSnapshots", () => {
  const policy = fixturePolicy as any;
  const valid = () => replaySwellWatchSnapshots({ captures: [capture("capture-a", [enhanced(), gfs()])], policy, codeArtifact: "replay-code-v1" });

  it("validates collector-shaped V2 rows and reports primary and S2 missingness with denominators", () => {
    expect(valid()).toMatchObject({ status: "suppressed", reason: "immutable_issuance_unavailable", counts: { captures: 1, observedMissing: { primary: { denominator: 1, missing: 0 }, secondary: { denominator: 1, missing: 0 } }, observedDisagreement: null, candidates: null, stability: null, audience: null }, provenance: { policyHash: policy.value_hash, codeHash: hash("replay-code-v1") } });
    const missingS2 = replaySwellWatchSnapshots({ captures: [capture("capture-b", [enhanced(), gfs({ secondary_swell_height_m: null, secondary_swell_period_s: null, secondary_swell_direction_deg: null })])], policy, codeArtifact: "replay-code-v1" });
    expect(missingS2.counts.observedMissing).toEqual({ primary: { denominator: 1, missing: 0 }, secondary: { denominator: 1, missing: 1 } });
  });

  it("preserves collector timestamptz offsets while validating finite instants", () => {
    const utc = { forecast_at: "2026-09-06T00:00:00+00:00", updated_at: "2026-09-04T00:00:00.123+00:00" };
    const nonzeroOffset = { forecast_at: "2026-09-06T05:30:00+05:30", updated_at: "2026-09-03T20:00:00.123456-04:00" };
    for (const timestamps of [utc, nonzeroOffset]) {
      const outcome = replaySwellWatchSnapshots({ captures: [capture(`capture-${timestamps.forecast_at}`, [enhanced(timestamps), gfs(timestamps)])], policy, codeArtifact: "replay-code-v1" });
      expect(outcome.counts.observedMissing.primary).toEqual({ denominator: 1, missing: 0 });
    }
  });

  it("pairs equivalent offset instants only within a capture, beach, and microsecond", () => {
    const noaa = enhanced({ forecast_at: "2026-09-06T05:30:00.1200+05:30" });
    const openMeteo = gfs({ forecast_at: "2026-09-06T00:00:00.12Z" });
    const paired = replaySwellWatchSnapshots({ captures: [capture("capture-offsets", [noaa, openMeteo])], policy, codeArtifact: "replay-code-v1" });
    expect(paired).toMatchObject({ status: "suppressed", counts: { observedMissing: { primary: { denominator: 1, missing: 0 } }, candidates: null, stability: null } });

    const differentMicroseconds = replaySwellWatchSnapshots({ captures: [capture("capture-micros", [enhanced({ forecast_at: "2026-09-06T00:00:00.120001Z" }), gfs({ forecast_at: "2026-09-06T00:00:00.120002Z" })])], policy, codeArtifact: "replay-code-v1" });
    expect(differentMicroseconds.counts.observedMissing.primary).toBeNull();

    const duplicateNoaa = replaySwellWatchSnapshots({ captures: [capture("capture-ambiguous", [enhanced({ forecast_at: "2026-09-06T00:00:00.12Z", source_key: "noaa-a" }), enhanced({ forecast_at: "2026-09-06T00:00:00.1200+00:00", source_key: "noaa-b" }), gfs({ forecast_at: "2026-09-06T00:00:00.120Z" })])], policy, codeArtifact: "replay-code-v1" });
    expect(duplicateNoaa.counts.observedMissing.primary).toBeNull();

    const separateCapture = replaySwellWatchSnapshots({ captures: [capture("capture-noaa", [noaa]), capture("capture-open-meteo", [openMeteo])], policy, codeArtifact: "replay-code-v1" });
    expect(separateCapture.counts.observedMissing.primary).toBeNull();
    const separateBeach = replaySwellWatchSnapshots({ captures: [capture("capture-beach", [noaa, gfs({ forecast_at: "2026-09-06T00:00:00.12Z", beach_id: "beach-b" })])], policy, codeArtifact: "replay-code-v1" });
    expect(separateBeach.counts.observedMissing.primary).toBeNull();
  });

  it("does not call OPEN_METEO/FALLBACK enhanced rows NOAA evidence", () => {
    const outcome = replaySwellWatchSnapshots({ captures: [capture("capture-a", [enhanced({ data_source: "OPEN_METEO" }), gfs()])], policy, codeArtifact: "replay-code-v1" });
    expect(outcome.counts).toMatchObject({ observedMissing: { primary: null, secondary: null }, observedDisagreement: null });
  });

  it("does not pair rows across captures and is invariant to capture order", () => {
    const noaa = capture("capture-a", [enhanced()]);
    const openMeteo = capture("capture-b", [gfs()]);
    const forward = replaySwellWatchSnapshots({ captures: [noaa, openMeteo], policy, codeArtifact: "replay-code-v1" });
    const reverse = replaySwellWatchSnapshots({ captures: [openMeteo, noaa], policy, codeArtifact: "replay-code-v1" });
    expect(forward).toEqual(reverse);
    expect(forward.counts.observedMissing).toEqual({ primary: null, secondary: null });
    expect(() => replaySwellWatchSnapshots({ captures: [noaa, noaa], policy, codeArtifact: "replay-code-v1" })).toThrow("unique");
  });

  it("rejects tampered row hashes and incomplete capture evidence", () => {
    const badRow = enhanced();
    badRow.observation_hash = "0".repeat(64);
    expect(() => replaySwellWatchSnapshots({ captures: [capture("capture-a", [badRow, gfs()])], policy, codeArtifact: "replay-code-v1" })).toThrow("integrity");
    expect(() => replaySwellWatchSnapshots({ captures: [capture("capture-a", [enhanced(), gfs()], { status: "incomplete" })], policy, codeArtifact: "replay-code-v1" })).toThrow("integrity");
  });

  it("rejects hash-valid malformed source provenance, timestamps, and non-object rows", () => {
    const identity = (row: Record<string, unknown>) => ({ schema_version: row.schema_version, beach_pseudonym: row.beach_pseudonym, source_row_pseudonym: row.source_row_pseudonym, forecast_at: row.forecast_at, source_updated_at: row.source_updated_at, source_table: row.source_table, source_label: row.source_label, canonical_swell: row.canonical_swell, raw_open_meteo_swell: row.raw_open_meteo_swell });
    const malformedSource: Record<string, unknown> = { ...enhanced(), source_table: "unexpected", source_label: "OPEN_METEO", provider: "open_meteo", provider_reason: "allowlisted" };
    malformedSource.observation_hash = hash(stable(identity(malformedSource)));
    expect(() => replaySwellWatchSnapshots({ captures: [capture("capture-a", [malformedSource, gfs()])], policy, codeArtifact: "replay-code-v1" })).toThrow("integrity");
    const malformedTimestamp: Record<string, unknown> = { ...enhanced(), forecast_at: "2026-09-06T00:00:00" };
    malformedTimestamp.observation_hash = hash(stable(identity(malformedTimestamp)));
    expect(() => replaySwellWatchSnapshots({ captures: [capture("capture-a", [malformedTimestamp, gfs()])], policy, codeArtifact: "replay-code-v1" })).toThrow("integrity");
    const invalidOffset: Record<string, unknown> = { ...enhanced(), source_updated_at: "2026-09-04T00:00:00+99:00" };
    invalidOffset.observation_hash = hash(stable(identity(invalidOffset)));
    expect(() => replaySwellWatchSnapshots({ captures: [capture("capture-a", [invalidOffset, gfs()])], policy, codeArtifact: "replay-code-v1" })).toThrow("integrity");
    const nullCapture = capture("capture-null", []);
    nullCapture.artifact = "null\n";
    nullCapture.manifest.artifact_sha256 = hash(nullCapture.artifact);
    nullCapture.manifest.retained_row_count = 1;
    nullCapture.manifest.immutable_issuance_unavailable_count = 1;
    nullCapture.manifest.manifest_sha256 = hash(stable(Object.fromEntries(Object.entries(nullCapture.manifest).filter(([key]) => key !== "manifest_sha256"))));
    expect(() => replaySwellWatchSnapshots({ captures: [nullCapture], policy, codeArtifact: "replay-code-v1" })).toThrow("integrity");
  });

  it("rejects a manifest artifact path before reading it", () => {
    expect(() => resolveCaptureArtifactPath("/private/capture.manifest.json", "../outside.jsonl")).toThrow("integrity");
    expect(() => resolveCaptureArtifactPath("/private/capture.manifest.json", "/tmp/outside.jsonl")).toThrow("integrity");
  });

  it("verifies the fixture policy artifact integrity rather than treating it as authority", () => {
    const forged = { ...policy, value_hash: "f".repeat(64) };
    expect(() => replaySwellWatchSnapshots({ captures: [capture("capture-a", [enhanced(), gfs()])], policy: forged, codeArtifact: "replay-code-v1" })).toThrow("verified captures");
  });

  it("accepts the tracked public policy artifact while capture inputs remain private", async () => {
    const policyPath = join(process.cwd(), "__tests__/fixtures/swell-watch-provisional-policy.json");
    expect((await lstat(policyPath)).mode & 0o077).not.toBe(0);
    await expect(readReplayPolicyArtifact(policyPath)).resolves.toContain("provisional_fixture");
  });

  it("publishes only below ignored replay root without overwrite or symlink traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "swell-replay-"));
    const outDir = join(root, ".artifacts", "swell-watch", "replay", "fixture");
    const outcome = valid();
    const input = { worktreeRoot: root, outDir, outcome, isIgnored: async () => true };
    const first = await publishPrivateReplayOutcome(input);
    expect(first.reused).toBe(false);
    expect((await readFile(first.path, "utf8"))).toContain(outcome.replay_key);
    await expect(publishPrivateReplayOutcome(input)).resolves.toMatchObject({ reused: true });
    await chmod(first.path, 0o644);
    await expect(publishPrivateReplayOutcome(input)).rejects.toThrow("unsafe");
    await chmod(first.path, 0o600);
    await expect(publishPrivateReplayOutcome({ ...input, outcome: { ...outcome, replay_key: "not-a-hash" } as any })).rejects.toThrow("key");
    await expect(publishPrivateReplayOutcome({ ...input, outDir: join(root, "tracked"), isIgnored: async () => false })).rejects.toThrow("ignored");
    await expect(lstat(join(root, "tracked"))).rejects.toThrow();
    await chmod(join(root, ".artifacts", "swell-watch"), 0o755);
    await expect(publishPrivateReplayOutcome(input)).rejects.toThrow("unsafe");
    expect((await lstat(join(root, ".artifacts", "swell-watch"))).mode & 0o777).toBe(0o755);
    await chmod(join(root, ".artifacts", "swell-watch"), 0o700);
    const symlinkRoot = await mkdtemp(join(tmpdir(), "swell-replay-symlink-"));
    const outside = join(symlinkRoot, "outside");
    const replayParent = join(symlinkRoot, ".artifacts", "swell-watch");
    await mkdir(outside);
    await mkdir(replayParent, { recursive: true, mode: 0o700 });
    await symlink(outside, join(replayParent, "replay"));
    const outsideChild = join(outside, "must-not-exist");
    await expect(publishPrivateReplayOutcome({ ...input, worktreeRoot: symlinkRoot, outDir: join(replayParent, "replay", "must-not-exist") })).rejects.toThrow("unsafe");
    await expect(lstat(outsideChild)).rejects.toThrow();
    await rm(symlinkRoot, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });
});
