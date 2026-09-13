import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, link, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type { CaptureManifest } from "./collect-swell-watch-shadow-snapshots";
import { verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const execFile = promisify(execFileCallback);
const SHA256 = /^[a-f0-9]{64}$/;
const SNAPSHOT_VERSION = "swell-watch-shadow-snapshot.v2";
const REPLAY_ROOT = ".artifacts/swell-watch/replay";

type SnapshotTuple = { height_m: number | null; period_s: number | null; direction_deg: number | null; completeness: "complete" | "incomplete" | "absent" };
type Snapshot = {
  schema_version: typeof SNAPSHOT_VERSION;
  observation_hash: string;
  beach_pseudonym: string;
  source_row_pseudonym: string;
  forecast_at: string;
  source_updated_at: string;
  captured_at: string;
  source_table: "enhanced_forecasts" | "gfs_wave_shadow_forecasts";
  source_label: "NOAA_NWS" | "OPEN_METEO" | "FALLBACK" | "UNKNOWN";
  provider: "noaa" | "open_meteo" | null;
  provider_reason: "allowlisted" | "unsupported_source_label" | "raw_open_meteo_shadow";
  issuance_id: null;
  issuance_reason: "immutable_issuance_unavailable";
  evaluation_id: null;
  evaluation_reason: "immutable_evaluation_unavailable";
  forecast_region_id: null;
  forecast_region_reason: "not_available_in_forecast_source";
  canonical_swell: { primary: SnapshotTuple; secondary: SnapshotTuple } | null;
  raw_open_meteo_swell: { primary: SnapshotTuple; secondary: SnapshotTuple; secondary_reason: "available" | "not_available_in_enhanced_forecasts" } | null;
};

export interface ReplayCapture { manifest: CaptureManifest; artifact: string }
type Missingness = { denominator: number; missing: number };
export interface SwellWatchReplayOutcome {
  status: "suppressed";
  reason: "immutable_issuance_unavailable";
  replay_key: string;
  provenance: { captureIds: string[]; manifestHashes: string[]; policyHash: string; codeHash: string; inputHash: string };
  counts: { captures: number; observedMissing: { primary: Missingness | null; secondary: Missingness | null }; observedDisagreement: null; candidates: null; stability: null; audience: null };
}

const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
const isTuple = (value: unknown): value is SnapshotTuple => {
  if (!value || typeof value !== "object") return false;
  const tuple = value as Record<string, unknown>;
  return ["complete", "incomplete", "absent"].includes(String(tuple.completeness)) && ["height_m", "period_s", "direction_deg"].every((key) => tuple[key] === null || (typeof tuple[key] === "number" && Number.isFinite(tuple[key])));
};
const complete = (value: SnapshotTuple | null | undefined): value is SnapshotTuple => value?.completeness === "complete" && value.height_m !== null && value.period_s !== null && value.direction_deg !== null;
const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/;
const timestamp = (value: unknown): value is string => typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));

function comparisonTimestampKey(value: string): string {
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) throw new Error("Replay capture integrity check failed");
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error("Replay capture integrity check failed");
  return `${milliseconds}:${(match[2] ?? "").slice(3).padEnd(3, "0")}`;
}

function identity(row: Snapshot): Omit<Snapshot, "observation_hash" | "captured_at" | "provider" | "provider_reason" | "issuance_id" | "issuance_reason" | "evaluation_id" | "evaluation_reason" | "forecast_region_id" | "forecast_region_reason"> {
  return { schema_version: row.schema_version, beach_pseudonym: row.beach_pseudonym, source_row_pseudonym: row.source_row_pseudonym, forecast_at: row.forecast_at, source_updated_at: row.source_updated_at, source_table: row.source_table, source_label: row.source_label, canonical_swell: row.canonical_swell, raw_open_meteo_swell: row.raw_open_meteo_swell };
}

export function resolveCaptureArtifactPath(manifestPath: string, artifactFile: unknown): string {
  if (typeof artifactFile !== "string" || basename(artifactFile) !== artifactFile) throw new Error("Replay capture integrity check failed");
  const manifestDirectory = resolve(manifestPath, "..");
  const artifactPath = resolve(manifestDirectory, artifactFile);
  if (!artifactPath.startsWith(`${manifestDirectory}${sep}`)) throw new Error("Replay capture integrity check failed");
  return artifactPath;
}

async function privateRegularFile(path: string): Promise<string> {
  const info = await lstat(path).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error("Replay input is unsafe");
  return readFile(path, "utf8");
}

export async function readReplayPolicyArtifact(path: string): Promise<string> {
  const info = await lstat(path).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) throw new Error("Replay policy input is unsafe");
  return readFile(path, "utf8");
}

function validRow(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const row = value as Snapshot;
  if (row.source_table !== "enhanced_forecasts" && row.source_table !== "gfs_wave_shadow_forecasts") return false;
  const sourceLabelValid = row.source_table === "enhanced_forecasts" ? ["NOAA_NWS", "OPEN_METEO", "FALLBACK", "UNKNOWN"].includes(row.source_label) : row.source_label === "OPEN_METEO";
  const providerValid = row.source_table === "gfs_wave_shadow_forecasts" ? row.source_label === "OPEN_METEO" && row.provider === "open_meteo" && row.provider_reason === "raw_open_meteo_shadow" : row.source_label === "NOAA_NWS" ? row.provider === "noaa" && row.provider_reason === "allowlisted" : row.source_label === "OPEN_METEO" ? row.provider === "open_meteo" && row.provider_reason === "allowlisted" : row.provider === null && row.provider_reason === "unsupported_source_label";
  return row.schema_version === SNAPSHOT_VERSION && SHA256.test(row.observation_hash) && SHA256.test(row.beach_pseudonym) && SHA256.test(row.source_row_pseudonym) && timestamp(row.forecast_at) && timestamp(row.source_updated_at) && timestamp(row.captured_at) && sourceLabelValid && providerValid && row.issuance_id === null && row.issuance_reason === "immutable_issuance_unavailable" && row.evaluation_id === null && row.evaluation_reason === "immutable_evaluation_unavailable" && row.forecast_region_id === null && row.forecast_region_reason === "not_available_in_forecast_source" && (row.canonical_swell === null || (isTuple(row.canonical_swell.primary) && isTuple(row.canonical_swell.secondary))) && (row.raw_open_meteo_swell === null || (isTuple(row.raw_open_meteo_swell.primary) && isTuple(row.raw_open_meteo_swell.secondary) && ["available", "not_available_in_enhanced_forecasts"].includes(row.raw_open_meteo_swell.secondary_reason))) && hash(stable(identity(row))) === row.observation_hash;
}

function parseCapture(capture: ReplayCapture): { manifest: CaptureManifest; rows: Snapshot[] } {
  const manifest = capture.manifest;
  const { manifest_sha256, ...base } = manifest;
  if (manifest.schema_version !== SNAPSHOT_VERSION || manifest.status !== "complete" || manifest.truncated || manifest.skipped_invalid_row_count !== 0 || !SHA256.test(manifest.artifact_sha256) || !SHA256.test(manifest_sha256) || hash(stable(base)) !== manifest_sha256 || hash(capture.artifact) !== manifest.artifact_sha256 || basename(manifest.artifact_file) !== manifest.artifact_file || manifest.completed_evaluation_count !== 0 || manifest.immutable_issuance_count !== 0) throw new Error("Replay capture integrity check failed");
  let decoded: unknown[];
  try { decoded = capture.artifact.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown); } catch { throw new Error("Replay capture integrity check failed"); }
  if (decoded.length !== manifest.retained_row_count) throw new Error("Replay capture integrity check failed");
  const hashes = new Set<string>();
  const rows: Snapshot[] = [];
  for (const row of decoded) {
    if (!validRow(row) || hashes.has(row.observation_hash)) throw new Error("Replay capture integrity check failed");
    hashes.add(row.observation_hash);
    rows.push(row);
  }
  if (hashes.size !== manifest.observation_hashes.length || [...hashes].sort().join(",") !== [...manifest.observation_hashes].sort().join(",")) throw new Error("Replay capture integrity check failed");
  return { manifest, rows: rows.sort((left, right) => left.observation_hash.localeCompare(right.observation_hash)) };
}

function observedMissing(captures: readonly { manifest: CaptureManifest; rows: Snapshot[] }[]): { primary: Missingness | null; secondary: Missingness | null } {
  const primary: Missingness = { denominator: 0, missing: 0 };
  const secondary: Missingness = { denominator: 0, missing: 0 };
  for (const capture of captures) {
    const groups = new Map<string, { noaa: Snapshot[]; openMeteo: Snapshot[] }>();
    for (const row of capture.rows) {
      const key = `${row.beach_pseudonym}:${comparisonTimestampKey(row.forecast_at)}`;
      const group = groups.get(key) ?? { noaa: [], openMeteo: [] };
      if (row.source_table === "enhanced_forecasts" && row.source_label === "NOAA_NWS" && row.provider === "noaa" && row.canonical_swell) group.noaa.push(row);
      if (row.source_table === "gfs_wave_shadow_forecasts" && row.source_label === "OPEN_METEO" && row.provider === "open_meteo" && row.raw_open_meteo_swell) group.openMeteo.push(row);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (group.noaa.length !== 1 || group.openMeteo.length !== 1) continue;
      const [noaa] = group.noaa;
      const [openMeteo] = group.openMeteo;
      primary.denominator += 1;
      secondary.denominator += 1;
      if (!complete(noaa.canonical_swell?.primary) || !complete(openMeteo.raw_open_meteo_swell?.primary)) primary.missing += 1;
      if (!complete(noaa.canonical_swell?.secondary) || !complete(openMeteo.raw_open_meteo_swell?.secondary)) secondary.missing += 1;
    }
  }
  return { primary: primary.denominator ? primary : null, secondary: secondary.denominator ? secondary : null };
}

/** No-send replay. V2 has no immutable completed batch, so disagreement remains unknown. */
export function replaySwellWatchSnapshots(input: { captures: readonly ReplayCapture[]; policy: SwellWatchPolicy; codeArtifact: string }): SwellWatchReplayOutcome {
  if (input.captures.length === 0 || !verifySwellWatchPolicy(input.policy) || !input.codeArtifact) throw new Error("Replay requires verified captures, policy, and code artifact");
  const parsed = input.captures.map(parseCapture).sort((left, right) => left.manifest.capture_id.localeCompare(right.manifest.capture_id));
  const captureIds = parsed.map((capture) => capture.manifest.capture_id);
  if (new Set(captureIds).size !== captureIds.length) throw new Error("Replay captures must have unique capture IDs");
  const manifestHashes = parsed.map((capture) => capture.manifest.manifest_sha256);
  const inputHash = hash(stable({ captureIds, manifestHashes, artifactHashes: parsed.map((capture) => capture.manifest.artifact_sha256) }));
  const codeHash = hash(input.codeArtifact);
  const replayKey = hash(stable({ captureIds, policyHash: input.policy.value_hash, codeHash, inputHash }));
  return { status: "suppressed", reason: "immutable_issuance_unavailable", replay_key: replayKey, provenance: { captureIds, manifestHashes, policyHash: input.policy.value_hash, codeHash, inputHash }, counts: { captures: parsed.length, observedMissing: observedMissing(parsed), observedDisagreement: null, candidates: null, stability: null, audience: null } };
}

async function checkIgnored(root: string, target: string): Promise<boolean> {
  try { await execFile("git", ["-C", root, "check-ignore", "--quiet", "--", target]); return true; } catch { return false; }
}

async function safeExistingAncestors(root: string, output: string): Promise<void> {
  const rootInfo = await lstat(root).catch(() => null);
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Replay worktree is unsafe");
  let cursor = root;
  for (const part of relative(root, output).split(sep)) {
    cursor = resolve(cursor, part);
    const info = await lstat(cursor).catch(() => null);
    if (!info) return;
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error("Replay output directory is unsafe");
  }
}

async function privateDirectory(root: string, outDir: string, isIgnored: (root: string, target: string) => Promise<boolean>): Promise<string> {
  const rootPath = resolve(root);
  const replayRoot = resolve(rootPath, REPLAY_ROOT);
  const output = resolve(outDir);
  if ((output !== replayRoot && !output.startsWith(`${replayRoot}${sep}`)) || !(await isIgnored(rootPath, `${REPLAY_ROOT}/`))) throw new Error("Replay output is not an ignored replay destination");
  await safeExistingAncestors(rootPath, output);
  let cursor = rootPath;
  for (const part of relative(rootPath, output).split(sep)) {
    cursor = resolve(cursor, part);
    const existing = await lstat(cursor).catch(() => null);
    if (existing) continue;
    await mkdir(cursor, { mode: 0o700 });
    const info = await lstat(cursor);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error("Replay output directory is unsafe");
    await chmod(cursor, 0o700);
  }
  return output;
}

/** Publishes once by a verified SHA-256 replay key; different content never overwrites it. */
export async function publishPrivateReplayOutcome(input: { worktreeRoot: string; outDir: string; outcome: SwellWatchReplayOutcome; isIgnored?: (root: string, target: string) => Promise<boolean> }): Promise<{ path: string; reused: boolean }> {
  if (!SHA256.test(input.outcome.replay_key)) throw new Error("Replay outcome key is invalid");
  const output = await privateDirectory(input.worktreeRoot, input.outDir, input.isIgnored ?? checkIgnored);
  const path = resolve(output, `replay-${input.outcome.replay_key}.json`);
  const body = `${stable(input.outcome)}\n`;
  const existing = await lstat(path).catch(() => null);
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink() || (existing.mode & 0o077) !== 0) throw new Error("Replay outcome is unsafe");
    if ((await readFile(path, "utf8")) !== body) throw new Error("Replay outcome collision");
    return { path, reused: true };
  }
  const temp = resolve(output, `.${basename(path)}.tmp`);
  await writeFile(temp, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
  try { await chmod(temp, 0o600); await link(temp, path); await chmod(path, 0o600); }
  finally { await unlink(temp).catch(() => undefined); }
  return { path, reused: false };
}

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { throw new Error("Replay input is invalid"); }
}

async function main(): Promise<void> {
  const [manifestPath, policyPath, outDir] = process.argv.slice(2);
  if (!manifestPath || !policyPath || !outDir) throw new Error("Usage: tsx replay-swell-watch-snapshots.ts <capture.manifest.json> <policy.json> <ignored-output-dir>");
  const manifest = parseJson(await privateRegularFile(manifestPath)) as CaptureManifest;
  const artifactPath = resolveCaptureArtifactPath(manifestPath, manifest.artifact_file);
  const [artifact, policyArtifact, codeArtifact] = await Promise.all([privateRegularFile(artifactPath), readReplayPolicyArtifact(policyPath), readFile(__filename, "utf8")]);
  const outcome = replaySwellWatchSnapshots({ captures: [{ manifest, artifact }], policy: parseJson(policyArtifact) as SwellWatchPolicy, codeArtifact });
  await publishPrivateReplayOutcome({ worktreeRoot: process.cwd(), outDir, outcome });
}

if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Swell Watch replay failed"); process.exitCode = 1; });
