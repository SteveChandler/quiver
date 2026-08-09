#!/usr/bin/env tsx
/**
 * Exact-target production smoke runner for the trusted-forecast layer (21-05).
 *
 * Every check below is a READ. The write-capable module is not imported — not
 * merely not called — until the whole preflight has passed, so an abort cannot
 * race a partially-initialised writer.
 *
 * Usage:
 *   yarn tsx scripts/trusted-forecast-production-smoke.ts \
 *     --mode=forecast \
 *     --beach-id=<uuid> \
 *     --local-date=YYYY-MM-DD \
 *     --build-anchor-at=<ISO-8601 instant> \
 *     --expected-build-key=<key> \
 *     --confirm-production \
 *     [--live-vocabulary=<path to the Seaside verifier's --vocabulary-out file>]
 *
 * Deviation from the plan's argument list, stated plainly: `--build-anchor-at`
 * is required in addition to the five the plan names. Without it the build key
 * cannot be derived from production inputs, and comparing a key the runner
 * derived from the key it was given would be a tautology rather than a check.
 *
 * Preflight order — each step aborts before the next, and all are reads:
 *   1  arguments: present, unique, well formed, no unknown flags
 *   2  D2 deploy ordering: the `trusted_forecast_*` relations must already
 *      exist. `PGRST202` (missing RPC) is unreachable, because every one of
 *      those tables comes from the same migration as the RPC, so the *read*
 *      fails on a missing relation first — and a read failure rejects
 *      `buildForecasts`. Migration `20260727231500` must land BEFORE 21-04's
 *      code deploys, and this is where that ordering is checkable.
 *   3  coverage: every approved coverage beach slug resolves to a real
 *      `beaches` row. An unresolvable slug makes the feature 100% inert and is
 *      logged once, ever, so it must be a hard preflight failure here.
 *   4  target beach: exactly one row for `--beach-id`, with an IANA zone
 *   5  local date: derived from the anchor in the beach's own zone, compared
 *      byte for byte with `--local-date`
 *   6  build key: derived by the production `trustedForecastBuildKey`, compared
 *      byte for byte with `--expected-build-key`
 *   7  vocabulary ratchet (optional): every `(scope_type, region_key, exposure)`
 *      triple PRODUCTION emits is covered or excused. 21-04's ratchet runs
 *      against the fixture corpus, so a triple production emits that the corpus
 *      lacks matches nothing, silently. This closes that.
 *
 * D-23: only sanitized target metadata is printed — ids, slugs, dates, counts
 * and codes. No source narrative, URL, hash or measured range.
 */

import { config } from "dotenv";

import {
  TRUSTED_FORECAST_UNCOVERED_VOCABULARY,
  coverageAcceptsVocabulary,
  resolveTrustedForecastCoveragePolicy,
  trustedForecastCoverageBeachSlugs,
} from "../lib/services/forecast/trusted-forecast-coverage";
import { localDateInTimeZone } from "../lib/services/forecast/trusted-forecast-adjustment";
import {
  TRUSTED_FORECAST_POLICY_VERSION,
  type TrustedForecastScopeType,
} from "../lib/services/forecast/trusted-forecast-policy";
import { TRUSTED_FORECAST_BUILD_SCHEMA_VERSION } from "../lib/services/forecast/trusted-forecast-persistence";

export const SMOKE_MODES = ["forecast", "audit"] as const;
export type SmokeMode = (typeof SMOKE_MODES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface SmokeArgs {
  readonly mode: SmokeMode;
  readonly beachId: string;
  readonly localDate: string;
  readonly buildAnchorAt: Date;
  readonly expectedBuildKey: string;
  readonly confirmProduction: true;
  readonly liveVocabularyPath: string | null;
}

export type SmokeAbortCode =
  | "missing_argument"
  | "duplicate_argument"
  | "malformed_argument"
  | "unknown_argument"
  | "migration_not_deployed"
  | "preflight_read_failed"
  | "coverage_slug_unresolvable"
  | "beach_not_found"
  | "beach_ambiguous"
  | "beach_timezone_missing"
  | "local_date_mismatch"
  | "build_key_mismatch"
  | "vocabulary_uncovered"
  | "target_write_failed";

export class SmokeAbort extends Error {
  constructor(
    readonly code: SmokeAbortCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "SmokeAbort";
  }
}

/* -------------------------------------------------------------------------- */
/* Injected dependencies — everything the runner touches outside pure logic.  */
/* -------------------------------------------------------------------------- */

export interface BeachTargetRow {
  readonly id: string;
  readonly slug: string;
  readonly timezone: string | null;
}

export interface VocabularyTriple {
  readonly scope_type: string;
  readonly region_key: string;
  readonly exposure: string;
}

/** Read-only preflight surface. Every method is a SELECT. */
export interface SmokePreflightReader {
  /** Reads one row from `trusted_forecast_issues` to prove the migration landed. */
  probeTrustedForecastRelations(): Promise<
    { readonly ok: true } | { readonly ok: false; readonly code: string }
  >;
  selectBeachIdsBySlug(slugs: readonly string[]): Promise<Map<string, string>>;
  selectBeachById(beachId: string): Promise<readonly BeachTargetRow[]>;
  readLiveVocabulary(path: string): Promise<readonly VocabularyTriple[]>;
}

/** The one write-capable dependency. Never constructed before preflight passes. */
export interface SmokeWriteRunner {
  run(args: SmokeArgs): Promise<SmokeWriteResult>;
}

export interface SmokeWriteResult {
  readonly beachId: string;
  readonly buildKey: string;
  readonly receiptFound: boolean;
}

export interface SmokeDeps {
  readonly reader: SmokePreflightReader;
  /**
   * Derives the build key with the production function.
   *
   * Async and injected so preflight can complete before forecast tooling and
   * its write-capable dependencies are resolved.
   */
  readonly deriveBuildKey: (args: {
    readonly beachId: string;
    readonly buildAnchorAt: Date;
  }) => Promise<string>;
  /** Resolved lazily so the writer is not even imported on an abort. */
  readonly writeRunner: () => Promise<SmokeWriteRunner>;
  readonly log: (line: string) => void;
}

/* -------------------------------------------------------------------------- */
/* 1. Arguments                                                               */
/* -------------------------------------------------------------------------- */

export function parseSmokeArgs(argv: readonly string[]): SmokeArgs {
  const seen = new Set<string>();
  const values = new Map<string, string>();
  let confirmProduction = false;

  for (const arg of argv) {
    const name = arg.startsWith("--") ? (arg.split("=")[0] ?? arg) : arg;
    if (seen.has(name)) {
      throw new SmokeAbort("duplicate_argument", name);
    }
    seen.add(name);

    if (name === "--confirm-production") {
      if (arg !== "--confirm-production") {
        throw new SmokeAbort("malformed_argument", "--confirm-production takes no value");
      }
      confirmProduction = true;
      continue;
    }
    if (
      name === "--mode" ||
      name === "--beach-id" ||
      name === "--local-date" ||
      name === "--build-anchor-at" ||
      name === "--expected-build-key" ||
      name === "--live-vocabulary"
    ) {
      const value = arg.slice(name.length + 1);
      if (!arg.startsWith(`${name}=`) || value.length === 0) {
        throw new SmokeAbort("malformed_argument", `${name} requires a value`);
      }
      values.set(name, value);
      continue;
    }
    throw new SmokeAbort("unknown_argument", name);
  }

  const required = [
    "--mode",
    "--beach-id",
    "--local-date",
    "--build-anchor-at",
    "--expected-build-key",
  ];
  const missing = required.filter((name) => !values.has(name));
  if (!confirmProduction) missing.push("--confirm-production");
  if (missing.length > 0) {
    throw new SmokeAbort("missing_argument", missing.join(", "));
  }

  const mode = values.get("--mode") as SmokeMode;
  if (!SMOKE_MODES.includes(mode)) {
    throw new SmokeAbort("malformed_argument", `--mode must be forecast|audit`);
  }
  const beachId = values.get("--beach-id") as string;
  if (!UUID_RE.test(beachId)) {
    throw new SmokeAbort("malformed_argument", "--beach-id must be a uuid");
  }
  const localDate = values.get("--local-date") as string;
  if (!LOCAL_DATE_RE.test(localDate)) {
    throw new SmokeAbort("malformed_argument", "--local-date must be YYYY-MM-DD");
  }
  const anchorRaw = values.get("--build-anchor-at") as string;
  const buildAnchorAt = new Date(anchorRaw);
  if (Number.isNaN(buildAnchorAt.getTime())) {
    throw new SmokeAbort("malformed_argument", "--build-anchor-at must be an instant");
  }
  const expectedBuildKey = values.get("--expected-build-key") as string;

  return {
    mode,
    beachId,
    localDate,
    buildAnchorAt,
    expectedBuildKey,
    confirmProduction: true,
    liveVocabularyPath: values.get("--live-vocabulary") ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* 2-7. Preflight                                                             */
/* -------------------------------------------------------------------------- */

export interface SmokeTarget {
  readonly beachId: string;
  readonly beachSlug: string;
  readonly timezone: string;
  readonly localDate: string;
  readonly buildKey: string;
  readonly coveredSlugs: readonly string[];
  readonly vocabularyTripleCount: number;
}

/**
 * `PGRST205`/`42P01` mean the relation does not exist, which under D2 means the
 * migration has not landed. Anything else is an ordinary read failure.
 */
const MISSING_RELATION_CODES = new Set(["PGRST205", "PGRST202", "42P01"]);

export async function runPreflight(
  args: SmokeArgs,
  deps: SmokeDeps,
): Promise<SmokeTarget> {
  // 2. Deploy ordering (D2).
  const probe = await deps.reader.probeTrustedForecastRelations();
  if (!probe.ok) {
    if (MISSING_RELATION_CODES.has(probe.code)) {
      throw new SmokeAbort(
        "migration_not_deployed",
        "trusted_forecast_* relations are absent, so migration 20260727231500 " +
          "has not landed. It must be applied BEFORE 21-04's builder code " +
          "deploys: the issue READ fails on a missing relation before the RPC " +
          "is reached, and a read failure rejects buildForecasts",
      );
    }
    throw new SmokeAbort("preflight_read_failed", `relation probe: ${probe.code}`);
  }

  // 3. Coverage slugs resolve (otherwise the feature is inert).
  const slugs = trustedForecastCoverageBeachSlugs();
  const resolved = await deps.reader.selectBeachIdsBySlug(slugs);
  const unresolvable = slugs.filter((slug) => !resolved.has(slug));
  if (unresolvable.length > 0) {
    throw new SmokeAbort(
      "coverage_slug_unresolvable",
      `${unresolvable.join(", ")} — approved coverage names ${slugs.length} ` +
        `beach slug(s) and ${unresolvable.length} do not exist in beaches. ` +
        "The trusted layer is inert for those entries and says so only once " +
        "per process",
    );
  }
  // Timezone agreement is a pure check but belongs before any write.
  resolveTrustedForecastCoveragePolicy(resolved);

  // 4. Exact target beach.
  const rows = await deps.reader.selectBeachById(args.beachId);
  if (rows.length === 0) throw new SmokeAbort("beach_not_found", args.beachId);
  if (rows.length > 1) {
    throw new SmokeAbort("beach_ambiguous", `${rows.length} rows for ${args.beachId}`);
  }
  const beach = rows[0] as BeachTargetRow;
  if (!beach.timezone) {
    throw new SmokeAbort("beach_timezone_missing", beach.slug);
  }

  // 5. Local date, derived by the production calculation.
  const derivedLocalDate = localDateInTimeZone(args.buildAnchorAt, beach.timezone);
  if (derivedLocalDate !== args.localDate) {
    throw new SmokeAbort(
      "local_date_mismatch",
      `authorized=${args.localDate} derived=${derivedLocalDate} zone=${beach.timezone}`,
    );
  }

  // 6. Build key, derived by the production calculation.
  const derivedBuildKey = await deps.deriveBuildKey({
    beachId: args.beachId,
    buildAnchorAt: args.buildAnchorAt,
  });
  if (derivedBuildKey !== args.expectedBuildKey) {
    throw new SmokeAbort(
      "build_key_mismatch",
      `authorized=${args.expectedBuildKey} derived=${derivedBuildKey}`,
    );
  }

  // 7. Production vocabulary ratchet.
  let vocabularyTripleCount = 0;
  if (args.liveVocabularyPath !== null) {
    const triples = await deps.reader.readLiveVocabulary(args.liveVocabularyPath);
    vocabularyTripleCount = triples.length;
    const unclaimed = triples.filter(
      (triple) => !isTripleCoveredOrExcused(triple),
    );
    if (unclaimed.length > 0) {
      throw new SmokeAbort(
        "vocabulary_uncovered",
        unclaimed
          .map((t) => `${t.scope_type}/${t.region_key}/${t.exposure}`)
          .join(", ") +
          " — production emits these triples and no coverage entry accepts " +
          "them and no excusal names them, so they would match nothing and " +
          "say nothing",
      );
    }
  }

  return {
    beachId: args.beachId,
    beachSlug: beach.slug,
    timezone: beach.timezone,
    localDate: derivedLocalDate,
    buildKey: derivedBuildKey,
    coveredSlugs: slugs,
    vocabularyTripleCount,
  };
}

export function isTripleCoveredOrExcused(triple: VocabularyTriple): boolean {
  const scopeType = triple.scope_type as TrustedForecastScopeType;
  if (scopeType !== "spot" && scopeType !== "regional") return false;
  if (coverageAcceptsVocabulary(scopeType, triple.region_key, triple.exposure)) {
    return true;
  }
  return TRUSTED_FORECAST_UNCOVERED_VOCABULARY.some(
    (entry) =>
      entry.scopeType === scopeType &&
      entry.regionKey === triple.region_key &&
      entry.exposure === triple.exposure,
  );
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

export async function runSmoke(
  argv: readonly string[],
  deps: SmokeDeps,
): Promise<number> {
  let args: SmokeArgs;
  try {
    args = parseSmokeArgs(argv);
  } catch (error) {
    deps.log(describeAbort(error));
    return 2;
  }

  let target: SmokeTarget;
  try {
    target = await runPreflight(args, deps);
  } catch (error) {
    deps.log(describeAbort(error));
    deps.log("ABORTED before any write-capable dependency was resolved");
    return 1;
  }

  deps.log(
    JSON.stringify(
      {
        mode: args.mode,
        beach_id: target.beachId,
        beach_slug: target.beachSlug,
        timezone: target.timezone,
        local_date: target.localDate,
        build_key: target.buildKey,
        coverage_slugs: target.coveredSlugs,
        production_vocabulary_triples: target.vocabularyTripleCount,
      },
      null,
      2,
    ),
  );

  let result: SmokeWriteResult;
  try {
    const runner = await deps.writeRunner();
    result = await runner.run(args);
  } catch (error) {
    deps.log(
      `ABORT target_write_failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  if (
    result.beachId !== target.beachId ||
    result.buildKey !== target.buildKey ||
    !result.receiptFound
  ) {
    deps.log(
      `ABORT target_write_failed: expected beach=${target.beachId} build=${target.buildKey} ` +
        `receipt=true; got beach=${result.beachId} build=${result.buildKey} ` +
        `receipt=${result.receiptFound}`,
    );
    return 1;
  }
  return 0;
}

function describeAbort(error: unknown): string {
  if (error instanceof SmokeAbort) return `ABORT ${error.message}`;
  return `ABORT unexpected_error: ${error instanceof Error ? error.message : String(error)}`;
}

/* -------------------------------------------------------------------------- */
/* Production wiring                                                          */
/* -------------------------------------------------------------------------- */

export function createProductionDeps(): SmokeDeps {
  return {
    reader: {
      async probeTrustedForecastRelations() {
        const { createServiceRoleClient } = await import("../lib/supabase");
        const supabase = createServiceRoleClient();
        const { error } = await supabase
          .from("trusted_forecast_issues" as never)
          .select("issue_id")
          .limit(1);
        return error ? { ok: false as const, code: error.code ?? "unknown" } : { ok: true as const };
      },
      async selectBeachIdsBySlug(slugs) {
        const { createSupabaseTrustedForecastReadStore, loadBeachIdsBySlug } =
          await import("../lib/services/forecast/trusted-forecast-repository-node");
        return loadBeachIdsBySlug(createSupabaseTrustedForecastReadStore(), slugs);
      },
      async selectBeachById(beachId) {
        const { createServiceRoleClient } = await import("../lib/supabase");
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
          .from("beaches")
          .select("id, slug, timezone")
          .eq("id", beachId);
        if (error) {
          throw new SmokeAbort("preflight_read_failed", `beaches: ${error.code ?? "unknown"}`);
        }
        return (data ?? []) as unknown as BeachTargetRow[];
      },
      async readLiveVocabulary(path) {
        const { readFile } = await import("node:fs/promises");
        const parsed = JSON.parse(await readFile(path, "utf-8")) as {
          triples?: VocabularyTriple[];
        };
        return parsed.triples ?? [];
      },
    },
    async deriveBuildKey({ beachId, buildAnchorAt }) {
      const { trustedForecastBuildKey } = await import(
        "../lib/services/forecast/trusted-forecast-persistence"
      );
      return trustedForecastBuildKey({
        beachId,
        buildAnchorAt,
        policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
        schemaVersion: TRUSTED_FORECAST_BUILD_SCHEMA_VERSION,
      });
    },
    // Imported only here, only after the preflight has passed.
    writeRunner: async () => {
      const { updateBeachForecast } = await import("../lib/utils/forecast-server-utils");
      const { createSupabaseTrustedForecastPersistenceStore } = await import(
        "../lib/services/forecast/trusted-forecast-persistence-node"
      );
      return {
        async run(args: SmokeArgs) {
          const result = await updateBeachForecast(args.beachId, {
            buildAnchorAt: args.buildAnchorAt,
          });
          if (result.beachId !== args.beachId) {
            throw new SmokeAbort(
              "target_write_failed",
              `forecast updater returned beach=${result.beachId}`,
            );
          }
          const receiptResult = await createSupabaseTrustedForecastPersistenceStore().loadReceipt(
            args.expectedBuildKey,
          );
          if (receiptResult.error) {
            throw new SmokeAbort(
              "target_write_failed",
              `receipt read failed: ${receiptResult.error.code ?? "unknown"}`,
            );
          }
          const rows = Array.isArray(receiptResult.data)
            ? receiptResult.data
            : receiptResult.data == null
              ? []
              : [receiptResult.data];
          const row = rows.length === 1 ? rows[0] : null;
          const record =
            typeof row === "object" && row !== null
              ? (row as { build_key?: unknown; policy_version?: unknown })
              : null;
          if (
            record?.build_key !== args.expectedBuildKey ||
            record.policy_version !== TRUSTED_FORECAST_POLICY_VERSION
          ) {
            throw new SmokeAbort(
              "target_write_failed",
              `expected one matching receipt for build=${args.expectedBuildKey}`,
            );
          }
          return {
            beachId: result.beachId,
            buildKey: record.build_key,
            receiptFound: true,
          };
        },
      };
    },
    log: (line) => console.log(line),
  };
}

/* c8 ignore start - entrypoint */
const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1]?.endsWith("trusted-forecast-production-smoke.ts");

if (isEntrypoint) {
  config({ path: ".env.local" });
  config({ path: ".env.production.local" });
  runSmoke(process.argv.slice(2), createProductionDeps())
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
/* c8 ignore stop */
