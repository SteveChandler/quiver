import { execFile as execFileCallback } from "node:child_process";
import {
  createHash,
  createHmac,
  randomBytes as nodeRandomBytes,
} from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";
import { FEET_TO_METERS } from "@/lib/utils/unit-conversions";

const execFile = promisify(execFileCallback);
const VERSION: "swell-watch-shadow-snapshot.v2" =
  "swell-watch-shadow-snapshot.v2";
const KEY = ".collection-hmac-key.v1",
  LOCK = ".collection.lock",
  MAX_ROWS = 250_000,
  MAX_PAGE = 500,
  TIMEOUT = 20_000;
const SOURCES = ["enhanced_forecasts", "gfs_wave_shadow_forecasts"] as const;
type Source = (typeof SOURCES)[number];
type Cursor = { first: string; second: string } | null;
type Tuple = {
  height_m: number | null;
  period_s: number | null;
  direction_deg: number | null;
  completeness: "complete" | "incomplete" | "absent";
};
export interface CollectorOptions {
  outDir: string;
  worktreeRoot: string;
  envFile: string;
  maxRows: number;
  pageSize: number;
}
export interface ForecastSourceRow {
  source_table: Source;
  beach_id: string;
  forecast_at: string;
  updated_at: string;
  source_key: string;
  data_source?: string | null;
  swell_1_height?: string | number | null;
  swell_1_period?: string | number | null;
  swell_1_direction?: string | number | null;
  swell_2_height?: string | number | null;
  swell_2_period?: string | number | null;
  swell_2_direction?: string | number | null;
  swell_height_om?: number | null;
  swell_period_om?: number | null;
  swell_direction_om?: number | null;
  secondary_swell_height_m?: number | null;
  secondary_swell_period_s?: number | null;
  secondary_swell_direction_deg?: number | null;
}
type Credentials = { url: string; key: string };
export interface CollectorDependencies {
  checkIgnored: (root: string, path: string) => Promise<boolean>;
  loadCredentials: (file: string) => Promise<Credentials>;
  fetchPage: (
    credentials: Credentials,
    source: Source,
    cursor: Cursor,
    limit: number,
    signal: AbortSignal,
  ) => Promise<ForecastSourceRow[]>;
  now: () => Date;
  randomBytes: (n: number) => Buffer;
}
export interface CaptureManifest {
  schema_version: typeof VERSION;
  status: "complete" | "incomplete";
  capture_id: string;
  captured_at: string;
  artifact_file: string;
  artifact_sha256: string;
  manifest_sha256: string;
  key_fingerprint: string;
  source_tables: Source[];
  page_size: number;
  page_count: number;
  queried_row_count: number;
  retained_row_count: number;
  new_observation_count: number;
  deduplicated_observation_count: number;
  duplicate_within_capture_count: number;
  skipped_invalid_row_count: number;
  immutable_issuance_count: number;
  immutable_issuance_unavailable_count: number;
  completed_evaluation_count: number;
  truncated: boolean;
  source_coverage: Record<Source, number>;
  coverage_gaps: string[];
  observation_hashes: string[];
  quarantined_prior_capture_count: number;
  quarantine_reason: string | null;
}
export interface CaptureResult {
  artifactPath: string;
  manifestPath: string;
  manifest: CaptureManifest;
}
type Snapshot = {
  schema_version: typeof VERSION;
  observation_hash: string;
  beach_pseudonym: string;
  source_row_pseudonym: string;
  forecast_at: string;
  source_updated_at: string;
  captured_at: string;
  source_table: Source;
  source_label: "NOAA_NWS" | "OPEN_METEO" | "FALLBACK" | "UNKNOWN";
  provider: "noaa" | "open_meteo" | null;
  provider_reason:
    | "allowlisted"
    | "unsupported_source_label"
    | "raw_open_meteo_shadow";
  issuance_id: null;
  issuance_reason: "immutable_issuance_unavailable";
  evaluation_id: null;
  evaluation_reason: "immutable_evaluation_unavailable";
  forecast_region_id: null;
  forecast_region_reason: "not_available_in_forecast_source";
  canonical_swell: { primary: Tuple; secondary: Tuple } | null;
  raw_open_meteo_swell: {
    primary: Tuple;
    secondary: Tuple;
    secondary_reason: "available" | "not_available_in_enhanced_forecasts";
  } | null;
};

const stable = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stable).join(",")}]`
    : value && typeof value === "object"
      ? `{${Object.keys(value as object)
          .sort()
          .map(
            (k) =>
              `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`,
          )
          .join(",")}}`
      : JSON.stringify(value);
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const number = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const textNumber = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = value.trim().match(/^-?(?:\d+\.?\d*|\.\d+)/);
  return match ? Number(match[0]) : null;
};
const tuple = (
  height: number | null,
  period: number | null,
  direction: number | null,
): Tuple => ({
  height_m: height,
  period_s: period,
  direction_deg: direction,
  completeness: [height, period, direction].every((v) => v !== null)
    ? "complete"
    : [height, period, direction].every((v) => v === null)
      ? "absent"
      : "incomplete",
});
const canonical = (
  height: string | number | null | undefined,
  period: string | number | null | undefined,
  direction: string | number | null | undefined,
): Tuple => {
  const feet = textNumber(height);
  return tuple(
    feet === null ? null : feet * FEET_TO_METERS,
    textNumber(period),
    cardinalToDegrees(direction),
  );
};
const raw = (
  height: number | null | undefined,
  period: number | null | undefined,
  direction: number | null | undefined,
): Tuple => tuple(number(height), number(period), number(direction));
const label = (value: string | null | undefined): Snapshot["source_label"] => {
  const v = value?.trim().toUpperCase();
  return v === "NOAA_NWS"
    ? v
    : v === "OPEN_METEO"
      ? v
      : v === "FALLBACK"
        ? v
        : "UNKNOWN";
};
function observationIdentity(
  row: Pick<
    Snapshot,
    | "schema_version"
    | "beach_pseudonym"
    | "source_row_pseudonym"
    | "forecast_at"
    | "source_updated_at"
    | "source_table"
    | "source_label"
    | "canonical_swell"
    | "raw_open_meteo_swell"
  >,
): Omit<
  Snapshot,
  | "observation_hash"
  | "captured_at"
  | "provider"
  | "provider_reason"
  | "issuance_id"
  | "issuance_reason"
  | "evaluation_id"
  | "evaluation_reason"
  | "forecast_region_id"
  | "forecast_region_reason"
> {
  return {
    schema_version: row.schema_version,
    beach_pseudonym: row.beach_pseudonym,
    source_row_pseudonym: row.source_row_pseudonym,
    forecast_at: row.forecast_at,
    source_updated_at: row.source_updated_at,
    source_table: row.source_table,
    source_label: row.source_label,
    canonical_swell: row.canonical_swell,
    raw_open_meteo_swell: row.raw_open_meteo_swell,
  };
}
export function normalizeSnapshotRow(
  input: ForecastSourceRow,
  key: Buffer,
  capturedAt: string,
): Snapshot | null {
  if (
    !input.beach_id ||
    !input.forecast_at ||
    !input.updated_at ||
    !input.source_key
  )
    return null;
  const sourceLabel =
    input.source_table === "gfs_wave_shadow_forecasts"
      ? "OPEN_METEO"
      : label(input.data_source);
  const provider =
    input.source_table === "gfs_wave_shadow_forecasts"
      ? "open_meteo"
      : sourceLabel === "NOAA_NWS"
        ? "noaa"
        : sourceLabel === "OPEN_METEO"
          ? "open_meteo"
          : null;
  const canonicalSwell =
    input.source_table === "enhanced_forecasts"
      ? {
          primary: canonical(
            input.swell_1_height,
            input.swell_1_period,
            input.swell_1_direction,
          ),
          secondary: canonical(
            input.swell_2_height,
            input.swell_2_period,
            input.swell_2_direction,
          ),
        }
      : null;
  const rawSwell =
    input.source_table === "enhanced_forecasts"
      ? {
          primary: raw(
            input.swell_height_om,
            input.swell_period_om,
            input.swell_direction_om,
          ),
          secondary: tuple(null, null, null),
          secondary_reason: "not_available_in_enhanced_forecasts" as const,
        }
      : {
          primary: raw(
            input.swell_height_om,
            input.swell_period_om,
            input.swell_direction_om,
          ),
          secondary: raw(
            input.secondary_swell_height_m,
            input.secondary_swell_period_s,
            input.secondary_swell_direction_deg,
          ),
          secondary_reason: "available" as const,
        };
  const identity = observationIdentity({
    schema_version: VERSION,
    beach_pseudonym: createHmac("sha256", key)
      .update(input.beach_id)
      .digest("hex"),
    source_row_pseudonym: createHmac("sha256", key)
      .update(`${input.source_table}:${input.source_key}`)
      .digest("hex"),
    forecast_at: input.forecast_at,
    source_updated_at: input.updated_at,
    source_table: input.source_table,
    source_label: sourceLabel,
    canonical_swell: canonicalSwell,
    raw_open_meteo_swell: rawSwell,
  });
  return {
    ...identity,
    observation_hash: hash(stable(identity)),
    captured_at: capturedAt,
    provider,
    provider_reason:
      input.source_table === "gfs_wave_shadow_forecasts"
        ? "raw_open_meteo_shadow"
        : provider
          ? "allowlisted"
          : "unsupported_source_label",
    issuance_id: null,
    issuance_reason: "immutable_issuance_unavailable",
    evaluation_id: null,
    evaluation_reason: "immutable_evaluation_unavailable",
    forecast_region_id: null,
    forecast_region_reason: "not_available_in_forecast_source",
  };
}
const checked = async (path: string) => lstat(path).catch(() => null);
function bound(value: number, name: string, max: number): void {
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new Error(`${name} must be an integer between 1 and ${max}`);
}
async function preflight(
  options: CollectorOptions,
  id: string,
  deps: CollectorDependencies,
): Promise<string> {
  const rootInfo = await checked(options.worktreeRoot);
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error("worktree root is unavailable");
  const root = resolve(options.worktreeRoot),
    output = resolve(options.outDir);
  if (output === root || !output.startsWith(`${root}${sep}`))
    throw new Error("output destination is outside worktree");
  const rel = relative(root, output);
  for (const target of [
    `${rel}/`,
    `${rel}/${KEY}`,
    `${rel}/${LOCK}`,
    `${rel}/${id}.jsonl`,
    `${rel}/${id}.manifest.json`,
    `${rel}/.${id}.jsonl.tmp`,
    `${rel}/.${id}.manifest.json.tmp`,
  ])
    if (!(await deps.checkIgnored(root, target)))
      throw new Error("output destination is not ignored");
  for (let cursor = output; cursor !== root; cursor = resolve(cursor, ".."))
    if ((await checked(cursor))?.isSymbolicLink())
      throw new Error("output destination contains a symlink");
  return output;
}
async function readKey(
  output: string,
  random: (n: number) => Buffer,
): Promise<Buffer> {
  const path = resolve(output, KEY),
    entry = await checked(path),
    files = await readdir(output).catch(() => []),
    hasArtifacts = files.some((file) => /\.(jsonl|manifest\.json)$/.test(file));
  if (entry) {
    if (!entry.isFile() || entry.isSymbolicLink() || (entry.mode & 0o077) !== 0)
      throw new Error("collector key is unavailable");
    const key = Buffer.from((await readFile(path, "utf8")).trim(), "base64");
    if (key.length !== 32) throw new Error("collector key is unavailable");
    return key;
  }
  if (hasArtifacts)
    throw new Error("collector key is missing while artifacts exist");
  const key = random(32);
  await writeFile(path, key.toString("base64"), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(path, 0o600);
  return key;
}
async function historical(
  output: string,
  key: Buffer,
): Promise<{ hashes: Set<string>; quarantined: number }> {
  const hashes = new Set<string>();
  let quarantined = 0;
  for (const file of (await readdir(output)).filter((name) =>
    name.endsWith(".manifest.json"),
  )) {
    const manifestPath = resolve(output, file),
      manifestInfo = await lstat(manifestPath);
    if (
      !manifestInfo.isFile() ||
      manifestInfo.isSymbolicLink() ||
      (manifestInfo.mode & 0o077) !== 0
    )
      throw new Error("prior manifest is unavailable");
    const manifest = JSON.parse(
      await readFile(manifestPath, "utf8"),
    ) as Partial<CaptureManifest>;
    if (manifest.schema_version !== VERSION) {
      quarantined += 1;
      continue;
    }
    const { manifest_sha256, ...canonicalManifest } = manifest;
    if (!manifest_sha256 || hash(stable(canonicalManifest)) !== manifest_sha256)
      throw new Error("prior manifest integrity check failed");
    if (manifest.key_fingerprint !== hash(key.toString("base64")))
      throw new Error("collector key changed since prior capture");
    if (
      !manifest.capture_id ||
      !manifest.artifact_file ||
      !manifest.artifact_sha256 ||
      basename(manifest.artifact_file) !== manifest.artifact_file ||
      manifest.artifact_file !== `${manifest.capture_id}.jsonl`
    )
      throw new Error("prior manifest is unavailable");
    const artifactPath = resolve(output, manifest.artifact_file);
    if (!artifactPath.startsWith(`${output}${sep}`))
      throw new Error("prior manifest is unavailable");
    const artifactInfo = await lstat(artifactPath);
    if (
      !artifactInfo.isFile() ||
      artifactInfo.isSymbolicLink() ||
      (artifactInfo.mode & 0o077) !== 0
    )
      throw new Error("prior artifact is unavailable");
    const artifact = await readFile(artifactPath, "utf8");
    if (hash(artifact) !== manifest.artifact_sha256)
      throw new Error("prior artifact integrity check failed");
    const artifactHashes = new Set<string>();
    for (const line of artifact.trim().split("\n").filter(Boolean)) {
      const row = JSON.parse(line) as Partial<Snapshot>;
      if (
        row.schema_version !== VERSION ||
        !row.observation_hash ||
        !row.beach_pseudonym ||
        !row.source_row_pseudonym ||
        !row.forecast_at ||
        !row.source_updated_at ||
        !row.source_table ||
        !row.source_label ||
        hash(stable(observationIdentity(row as Snapshot))) !==
          row.observation_hash
      )
        throw new Error("prior artifact integrity check failed");
      artifactHashes.add(row.observation_hash);
      hashes.add(row.observation_hash);
    }
    if (
      !manifest.observation_hashes ||
      manifest.observation_hashes.slice().sort().join(",") !==
        [...artifactHashes].sort().join(",")
    )
      throw new Error("prior manifest integrity check failed");
  }
  return { hashes, quarantined };
}
async function publish(path: string, body: string): Promise<void> {
  const temp = resolve(path, "..", `.${basename(path)}.tmp`);
  await writeFile(temp, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(temp, 0o600);
  try {
    await link(temp, path);
    await chmod(path, 0o600);
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}
async function acquire(output: string): Promise<() => Promise<void>> {
  const path = resolve(output, LOCK);
  const handle = await open(path, "wx", 0o600).catch(() => null);
  if (!handle) throw new Error("collector lock is unavailable");
  await handle.close();
  return async () => {
    await unlink(path).catch(() => undefined);
  };
}
async function timeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("collector request timed out"));
        }, TIMEOUT);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
  }
}
function defaults(): CollectorDependencies {
  return {
    checkIgnored: async (root, path) => {
      try {
        await execFile("git", [
          "-C",
          root,
          "check-ignore",
          "--quiet",
          "--",
          path,
        ]);
        return true;
      } catch {
        return false;
      }
    },
    loadCredentials: async (file) => {
      const entry = await checked(file);
      if (!entry?.isFile() || entry.isSymbolicLink())
        throw new Error("credential source is unavailable");
      const loaded = dotenv.config({ path: file, override: true });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
        key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (loaded.error || !url || !key)
        throw new Error("credential source is unavailable");
      return { url, key };
    },
    fetchPage: async ({ url, key }, source, cursor, limit, signal) => {
      const db = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      let query: any;
      if (source === "enhanced_forecasts") {
        query = db
          .from(source)
          .select(
            "beach_id,forecast_at,updated_at,data_source,swell_1_height,swell_1_period,swell_1_direction,swell_2_height,swell_2_period,swell_2_direction,swell_height_om,swell_period_om,swell_direction_om",
          )
          .order("forecast_at", { ascending: true })
          .order("beach_id", { ascending: true })
          .limit(limit);
        if (cursor)
          query = query.or(
            `forecast_at.gt.${cursor.first},and(forecast_at.eq.${cursor.first},beach_id.gt.${cursor.second})`,
          );
      } else {
        query = db
          .from(source)
          .select(
            "id,beach_id,predicted_at,fetched_at,swell_height_m,swell_period_s,swell_direction_deg,secondary_swell_height_m,secondary_swell_period_s,secondary_swell_direction_deg",
          )
          .order("fetched_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(limit);
        if (cursor)
          query = query.or(
            `fetched_at.gt.${cursor.first},and(fetched_at.eq.${cursor.first},id.gt.${cursor.second})`,
          );
      }
      const { data, error } = await query.abortSignal(signal);
      if (error) throw new Error("forecast snapshot query failed");
      return (data ?? []).map((row: any) =>
        source === "enhanced_forecasts"
          ? {
              ...row,
              source_table: source,
              source_key: `${row.forecast_at}:${row.beach_id}`,
            }
          : {
              ...row,
              source_table: source,
              forecast_at: row.predicted_at,
              updated_at: row.fetched_at,
              source_key: `${row.fetched_at}:${row.id}`,
              swell_height_om: row.swell_height_m,
              swell_period_om: row.swell_period_s,
              swell_direction_om: row.swell_direction_deg,
            },
      ) as ForecastSourceRow[];
    },
    now: () => new Date(),
    randomBytes: nodeRandomBytes,
  };
}
export async function collectSwellWatchShadowSnapshots(
  options: CollectorOptions,
  injected?: CollectorDependencies,
): Promise<CaptureResult> {
  bound(options.maxRows, "maxRows", MAX_ROWS);
  bound(options.pageSize, "pageSize", MAX_PAGE);
  const deps = injected ?? defaults(),
    captured = deps.now().toISOString(),
    id = `capture-${captured.replace(/[:.]/g, "-")}-${deps.randomBytes(6).toString("hex")}`,
    output = await preflight(options, id, deps);
  await mkdir(output, { recursive: true, mode: 0o700 });
  await chmod(output, 0o700);
  if ((await stat(output)).mode & 0o077)
    throw new Error("output directory permissions are unsafe");
  const release = await acquire(output);
  try {
    const key = await readKey(output, deps.randomBytes),
      previous = await historical(output, key),
      credentials = await deps.loadCredentials(options.envFile),
      rows: Snapshot[] = [],
      seen = new Set<string>(),
      coverage: Record<Source, number> = {
        enhanced_forecasts: 0,
        gfs_wave_shadow_forecasts: 0,
      };
    let queried = 0,
      pages = 0,
      skipped = 0,
      within = 0,
      truncated = false;
    for (const source of SOURCES) {
      let cursor: Cursor = null;
      while (queried < options.maxRows) {
        const limit = Math.min(options.pageSize, options.maxRows - queried),
          page = await timeout((signal) =>
            deps.fetchPage(credentials, source, cursor, limit, signal),
          );
        pages += 1;
        queried += page.length;
        coverage[source] += page.length;
        for (const input of page) {
          const row = normalizeSnapshotRow(input, key, captured);
          if (!row) {
            skipped += 1;
            continue;
          }
          if (seen.has(row.observation_hash)) {
            within += 1;
            continue;
          }
          seen.add(row.observation_hash);
          if (!previous.hashes.has(row.observation_hash)) rows.push(row);
        }
        if (page.length < limit) break;
        const last = page.at(-1);
        if (!last) break;
        cursor =
          source === "enhanced_forecasts"
            ? { first: last.forecast_at, second: last.beach_id }
            : {
                first: last.updated_at,
                second: last.source_key.split(":").at(-1) ?? "",
              };
        if (queried >= options.maxRows) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    const incomplete = truncated || skipped > 0,
      artifactFile = `${id}.jsonl`,
      artifactPath = resolve(output, artifactFile),
      artifact = `${rows.map(stable).join("\n")}${rows.length ? "\n" : ""}`,
      gaps = [
        "immutable provider issuance/evaluation identity unavailable",
        "no transactional batch receipt across paginated source reads",
        "candidate, regional, audience, projected-send, and delivery outcomes are not collected",
        ...(previous.quarantined
          ? ["prior v1 captures quarantined for faulty tuple normalization"]
          : []),
        ...(truncated ? ["capture reached maxRows and is incomplete"] : []),
        ...(skipped
          ? ["capture skipped invalid source rows and is incomplete"]
          : []),
      ],
      base = {
        schema_version: VERSION,
        status: incomplete ? ("incomplete" as const) : ("complete" as const),
        capture_id: id,
        captured_at: captured,
        artifact_file: artifactFile,
        artifact_sha256: hash(artifact),
        key_fingerprint: hash(key.toString("base64")),
        source_tables: [...SOURCES],
        page_size: options.pageSize,
        page_count: pages,
        queried_row_count: queried,
        retained_row_count: rows.length,
        new_observation_count: rows.length,
        deduplicated_observation_count:
          queried - skipped - rows.length - within,
        duplicate_within_capture_count: within,
        skipped_invalid_row_count: skipped,
        immutable_issuance_count: 0,
        immutable_issuance_unavailable_count: rows.length,
        completed_evaluation_count: 0,
        truncated,
        source_coverage: coverage,
        coverage_gaps: gaps,
        observation_hashes: rows.map((row) => row.observation_hash).sort(),
        quarantined_prior_capture_count: previous.quarantined,
        quarantine_reason: previous.quarantined
          ? "v1_null_and_canonical_normalization_defect"
          : null,
      },
      manifest: CaptureManifest = {
        ...base,
        manifest_sha256: hash(stable(base)),
      },
      manifestPath = resolve(output, `${id}.manifest.json`);
    await publish(artifactPath, artifact);
    try {
      await publish(manifestPath, `${stable(manifest)}\n`);
    } catch {
      await unlink(artifactPath).catch(() => undefined);
      throw new Error("capture publication failed");
    }
    return { artifactPath, manifestPath, manifest };
  } finally {
    await release();
  }
}
function arg(args: string[], name: string): string {
  const index = args.indexOf(name),
    value = args[index + 1];
  if (index === -1 || !value)
    throw new Error(`missing required argument ${name}`);
  return value;
}
if (require.main === module)
  collectSwellWatchShadowSnapshots({
    outDir: arg(process.argv, "--out-dir"),
    envFile: arg(process.argv, "--env-file"),
    maxRows: Number(arg(process.argv, "--max-rows")),
    pageSize: Number(arg(process.argv, "--page-size")),
    worktreeRoot: process.cwd(),
  })
    .then((result) =>
      console.log(
        JSON.stringify({
          capture_id: result.manifest.capture_id,
          artifact_file: basename(result.artifactPath),
          artifact_sha256: result.manifest.artifact_sha256,
          manifest_sha256: result.manifest.manifest_sha256,
          new_observation_count: result.manifest.new_observation_count,
          deduplicated_observation_count:
            result.manifest.deduplicated_observation_count,
          status: result.manifest.status,
        }),
      ),
    )
    .catch(() => {
      console.error("swell-watch snapshot collection failed");
      process.exitCode = 1;
    });
