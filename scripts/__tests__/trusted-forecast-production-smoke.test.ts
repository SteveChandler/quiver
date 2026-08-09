/**
 * 21-05 Task 1 — the exact-target production smoke runner.
 *
 * Every test here proves the same thing from a different angle: the
 * write-capable dependency is not resolved unless the whole preflight passed.
 * `writeRunner` is a jest.fn, so "no write" is asserted on the call count, not
 * inferred from the exit code.
 */

import {
  SmokeAbort,
  createProductionDeps,
  isTripleCoveredOrExcused,
  parseSmokeArgs,
  runPreflight,
  runSmoke,
  type BeachTargetRow,
  type SmokeDeps,
  type SmokePreflightReader,
  type VocabularyTriple,
} from "../trusted-forecast-production-smoke";
import {
  TRUSTED_FORECAST_COVERAGE_DEFINITIONS,
  TRUSTED_FORECAST_UNCOVERED_VOCABULARY,
  trustedForecastCoverageBeachSlugs,
} from "../../lib/services/forecast/trusted-forecast-coverage";
import { TRUSTED_FORECAST_POLICY_VERSION } from "../../lib/services/forecast/trusted-forecast-policy";
import { trustedForecastBuildKey } from "../../lib/services/forecast/trusted-forecast-persistence";

const BEACH_ID = "11111111-2222-4333-8444-555555555555";
const ANCHOR_ISO = "2026-08-07T13:00:00.000Z";
const TIMEZONE = "America/Los_Angeles";
const LOCAL_DATE = "2026-08-07";
const BUILD_KEY = trustedForecastBuildKey({
  beachId: BEACH_ID,
  buildAnchorAt: new Date(ANCHOR_ISO),
  policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
});

const COVERAGE_SLUGS = trustedForecastCoverageBeachSlugs();

function baseArgv(overrides: Partial<Record<string, string>> = {}): string[] {
  const values: Record<string, string | null> = {
    "--mode": "forecast",
    "--beach-id": BEACH_ID,
    "--local-date": LOCAL_DATE,
    "--build-anchor-at": ANCHOR_ISO,
    "--expected-build-key": BUILD_KEY,
    ...overrides,
  };
  const argv = Object.entries(values)
    .filter(([, value]) => value !== null)
    .map(([name, value]) => `${name}=${value}`);
  argv.push("--confirm-production");
  return argv;
}

interface HarnessOptions {
  readonly relationProbe?: Awaited<
    ReturnType<SmokePreflightReader["probeTrustedForecastRelations"]>
  >;
  readonly resolvedSlugs?: readonly string[];
  readonly beachRows?: readonly BeachTargetRow[];
  readonly vocabulary?: readonly VocabularyTriple[];
  readonly readVocabularyError?: Error;
}

function harness(options: HarnessOptions = {}) {
  const resolved = new Map<string, string>();
  for (const slug of options.resolvedSlugs ?? COVERAGE_SLUGS) {
    resolved.set(slug, `id-for-${slug}`);
  }
  const run = jest.fn(async (args: { beachId: string; expectedBuildKey: string }) => ({
    beachId: args.beachId,
    buildKey: args.expectedBuildKey,
    receiptFound: true,
  }));
  const writeRunner = jest.fn(async () => ({ run }));
  const lines: string[] = [];

  const deriveBuildKey = jest.fn(
    async (a: { beachId: string; buildAnchorAt: Date }) =>
      trustedForecastBuildKey({
        beachId: a.beachId,
        buildAnchorAt: a.buildAnchorAt,
        policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
      }),
  );

  const deps: SmokeDeps = {
    deriveBuildKey,
    reader: {
      probeTrustedForecastRelations: jest.fn(
        async () => options.relationProbe ?? { ok: true as const },
      ),
      selectBeachIdsBySlug: jest.fn(async () => resolved),
      selectBeachById: jest.fn(
        async () =>
          options.beachRows ?? [{ id: BEACH_ID, slug: "test-beach", timezone: TIMEZONE }],
      ),
      readLiveVocabulary: jest.fn(async () => {
        if (options.readVocabularyError) throw options.readVocabularyError;
        return options.vocabulary ?? [];
      }),
    },
    writeRunner,
    log: (line) => lines.push(line),
  };
  return { deps, writeRunner, run, lines, deriveBuildKey };
}

/* -------------------------------------------------------------------------- */
/* Arguments                                                                  */
/* -------------------------------------------------------------------------- */

describe("argument parsing", () => {
  it("accepts the full authorized argument set in both modes", () => {
    for (const mode of ["forecast", "audit"] as const) {
      const args = parseSmokeArgs(baseArgv({ "--mode": mode }));
      expect(args.mode).toBe(mode);
      expect(args.beachId).toBe(BEACH_ID);
      expect(args.localDate).toBe(LOCAL_DATE);
      expect(args.expectedBuildKey).toBe(BUILD_KEY);
      expect(args.confirmProduction).toBe(true);
      expect(args.buildAnchorAt.toISOString()).toBe(ANCHOR_ISO);
    }
  });

  it.each([
    ["--mode", "missing_argument"],
    ["--beach-id", "missing_argument"],
    ["--local-date", "missing_argument"],
    ["--build-anchor-at", "missing_argument"],
    ["--expected-build-key", "missing_argument"],
  ])("rejects a run missing %s", (name, code) => {
    const argv = baseArgv().filter((arg) => !arg.startsWith(`${name}=`));
    expect(() => parseSmokeArgs(argv)).toThrow(
      expect.objectContaining({ code }) as unknown as Error,
    );
  });

  it("refuses to run without --confirm-production", () => {
    const argv = baseArgv().filter((arg) => arg !== "--confirm-production");
    expect(() => parseSmokeArgs(argv)).toThrow(/missing_argument.*confirm-production/);
  });

  it("rejects a duplicated argument rather than taking the last one", () => {
    const argv = [...baseArgv(), `--beach-id=${BEACH_ID}`];
    expect(() => parseSmokeArgs(argv)).toThrow(/duplicate_argument: --beach-id/);
  });

  it.each([
    ["--mode=sideways", /--mode must be forecast\|audit/],
    ["--beach-id=not-a-uuid", /--beach-id must be a uuid/],
    ["--local-date=2026-8-7", /--local-date must be YYYY-MM-DD/],
    ["--build-anchor-at=not-a-date", /--build-anchor-at must be an instant/],
  ])("rejects malformed %s", (bad, expected) => {
    const name = bad.split("=")[0] as string;
    const argv = baseArgv().filter((arg) => !arg.startsWith(`${name}=`));
    argv.push(bad);
    expect(() => parseSmokeArgs(argv)).toThrow(expected);
  });

  it("rejects an unknown flag instead of ignoring it", () => {
    expect(() => parseSmokeArgs([...baseArgv(), "--force"])).toThrow(
      /unknown_argument: --force/,
    );
  });

  it("rejects --confirm-production carrying a value", () => {
    const argv = baseArgv().filter((arg) => arg !== "--confirm-production");
    argv.push("--confirm-production=false");
    expect(() => parseSmokeArgs(argv)).toThrow(/takes no value/);
  });
});

/* -------------------------------------------------------------------------- */
/* Abort before write                                                          */
/* -------------------------------------------------------------------------- */

describe("no write-capable dependency is resolved before the target matches", () => {
  it("runs the write only when every preflight step passed", async () => {
    const { deps, writeRunner, run, lines } = harness();
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(0);
    expect(writeRunner).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(lines.join("\n")).toContain(`"build_key": ${JSON.stringify(BUILD_KEY)}`);
  });

  it("exits 2 and never resolves the writer for a bad invocation", async () => {
    const { deps, writeRunner, run } = harness();
    const argv = baseArgv().filter((arg) => arg !== "--confirm-production");
    await expect(runSmoke(argv, deps)).resolves.toBe(2);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(deps.reader.probeTrustedForecastRelations).not.toHaveBeenCalled();
  });

  it.each([
    [
      "the migration has not landed (D2 deploy ordering)",
      { relationProbe: { ok: false as const, code: "PGRST205" } },
      /migration_not_deployed/,
    ],
    [
      "an approved coverage slug does not resolve",
      { resolvedSlugs: [] as readonly string[] },
      /coverage_slug_unresolvable/,
    ],
    ["the target beach does not exist", { beachRows: [] }, /beach_not_found/],
    [
      "the target beach id is ambiguous",
      {
        beachRows: [
          { id: BEACH_ID, slug: "a", timezone: TIMEZONE },
          { id: BEACH_ID, slug: "b", timezone: TIMEZONE },
        ],
      },
      /beach_ambiguous/,
    ],
    [
      "the beach carries no IANA zone",
      { beachRows: [{ id: BEACH_ID, slug: "a", timezone: null }] },
      /beach_timezone_missing/,
    ],
  ])("aborts with zero writes when %s", async (_label, options, expected) => {
    const { deps, writeRunner, run, lines } = harness(options as HarnessOptions);
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(lines.join("\n")).toMatch(expected);
    expect(lines.join("\n")).toContain(
      "ABORTED before any write-capable dependency was resolved",
    );
  });

  it("aborts with zero writes when the authorized local date is not the derived one", async () => {
    const { deps, writeRunner, run, lines } = harness();
    await expect(
      runSmoke(baseArgv({ "--local-date": "2026-08-08" }), deps),
    ).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(lines.join("\n")).toMatch(
      /local_date_mismatch: authorized=2026-08-08 derived=2026-08-07/,
    );
  });

  it("aborts with zero writes when the authorized build key is not the derived one", async () => {
    const { deps, writeRunner, run, lines } = harness();
    await expect(
      runSmoke(baseArgv({ "--expected-build-key": `${BUILD_KEY}x` }), deps),
    ).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(lines.join("\n")).toMatch(/build_key_mismatch/);
  });

  it.each([
    ["the writer exercised another beach", { beachId: "wrong-beach" }],
    ["the writer produced another build", { buildKey: "wrong-build" }],
    ["the writer found no receipt", { receiptFound: false }],
  ])("rejects a green writer result when %s", async (_label, override) => {
    const { deps, writeRunner, run, lines } = harness();
    run.mockResolvedValue({
      beachId: BEACH_ID,
      buildKey: BUILD_KEY,
      receiptFound: true,
      ...override,
    });

    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    expect(writeRunner).toHaveBeenCalledTimes(1);
    expect(lines.join("\n")).toContain("target_write_failed");
  });

  it("aborts with zero writes when a preflight read itself fails", async () => {
    const { deps, writeRunner, run, lines } = harness({
      relationProbe: { ok: false as const, code: "57014" },
    });
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(lines.join("\n")).toMatch(/preflight_read_failed: relation probe: 57014/);
  });

  it("aborts with zero writes when the vocabulary file cannot be read", async () => {
    const { deps, writeRunner, run } = harness({
      readVocabularyError: new Error("ENOENT"),
    });
    await expect(
      runSmoke(baseArgv({ "--live-vocabulary": "/nope.json" }), deps),
    ).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("uses the identical preflight in audit mode", async () => {
    const { deps, writeRunner } = harness({ beachRows: [] });
    await expect(runSmoke(baseArgv({ "--mode": "audit" }), deps)).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();

    const ok = harness();
    await expect(runSmoke(baseArgv({ "--mode": "audit" }), ok.deps)).resolves.toBe(0);
    expect(ok.run).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "audit" }),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* D2 — deploy ordering                                                        */
/* -------------------------------------------------------------------------- */

describe("D2: the migration must land before this code deploys", () => {
  it.each(["PGRST205", "PGRST202", "42P01"])(
    "classifies %s as migration_not_deployed and names the ordering rule",
    async (code) => {
      const { deps } = harness({ relationProbe: { ok: false as const, code } });
      await expect(
        runPreflight(parseSmokeArgs(baseArgv()), deps),
      ).rejects.toThrow(/migration_not_deployed/);
      await expect(
        runPreflight(parseSmokeArgs(baseArgv()), deps),
      ).rejects.toThrow(/must be applied BEFORE 21-04's builder code deploys/);
    },
  );

  it("probes the relations before anything else reads", async () => {
    const order: string[] = [];
    const { deps } = harness({ relationProbe: { ok: false as const, code: "PGRST205" } });
    (deps.reader.probeTrustedForecastRelations as jest.Mock).mockImplementation(
      async () => {
        order.push("probe");
        return { ok: false as const, code: "PGRST205" };
      },
    );
    (deps.reader.selectBeachIdsBySlug as jest.Mock).mockImplementation(async () => {
      order.push("slugs");
      return new Map<string, string>();
    });
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    expect(order).toEqual(["probe"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Carried item 4 — production vocabulary, not the fixture corpus              */
/* -------------------------------------------------------------------------- */

describe("production vocabulary ratchet", () => {
  it("passes when every production triple is covered or excused", async () => {
    const vocabulary: VocabularyTriple[] = [
      { scope_type: "spot", region_key: "trestles", exposure: "NNW" },
      ...TRUSTED_FORECAST_UNCOVERED_VOCABULARY.map((entry) => ({
        scope_type: entry.scopeType,
        region_key: entry.regionKey,
        exposure: entry.exposure,
      })),
    ];
    const { deps, run } = harness({ vocabulary });
    await expect(
      runSmoke(baseArgv({ "--live-vocabulary": "/live.json" }), deps),
    ).resolves.toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("aborts with zero writes on a triple production emits that nothing claims", async () => {
    const { deps, writeRunner, lines } = harness({
      vocabulary: [
        { scope_type: "regional", region_key: "gulf_coast", exposure: "primary" },
      ],
    });
    await expect(
      runSmoke(baseArgv({ "--live-vocabulary": "/live.json" }), deps),
    ).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
    expect(lines.join("\n")).toMatch(
      /vocabulary_uncovered: regional\/gulf_coast\/primary/,
    );
  });

  it("treats an unknown scope_type as unclaimed rather than silently true", () => {
    expect(
      isTripleCoveredOrExcused({
        scope_type: "planetary",
        region_key: "trestles",
        exposure: "NNW",
      }),
    ).toBe(false);
  });

  it("does not accept a covered region key with an incompatible exposure", () => {
    expect(
      isTripleCoveredOrExcused({
        scope_type: "spot",
        region_key: "trestles",
        exposure: "NNW",
      }),
    ).toBe(true);
    // `dominant` on trestles is excused, not covered — and it must still be
    // recognised, otherwise the excusal list is doing nothing.
    expect(
      isTripleCoveredOrExcused({
        scope_type: "spot",
        region_key: "trestles",
        exposure: "dominant",
      }),
    ).toBe(true);
    expect(
      isTripleCoveredOrExcused({
        scope_type: "spot",
        region_key: "trestles",
        exposure: "ESE",
      }),
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Carried item 5 — the covered slugs must exist                              */
/* -------------------------------------------------------------------------- */

describe("carried item 5: coverage slug resolution", () => {
  it("names every unresolvable slug and says the feature would be inert", async () => {
    const { deps, lines } = harness({ resolvedSlugs: [] });
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    const output = lines.join("\n");
    for (const slug of COVERAGE_SLUGS) expect(output).toContain(slug);
    expect(output).toMatch(/inert/);
  });

  it("fails on a partially resolvable coverage set, not only an empty one", async () => {
    expect(COVERAGE_SLUGS.length).toBeGreaterThan(1);
    const { deps, writeRunner } = harness({
      resolvedSlugs: COVERAGE_SLUGS.slice(0, 1),
    });
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    expect(writeRunner).not.toHaveBeenCalled();
  });

  it("checks exactly the slugs the approved coverage names", async () => {
    const { deps } = harness();
    await runSmoke(baseArgv(), deps);
    expect(deps.reader.selectBeachIdsBySlug).toHaveBeenCalledWith(COVERAGE_SLUGS);
    expect([...COVERAGE_SLUGS].sort()).toEqual(
      [
        ...new Set(TRUSTED_FORECAST_COVERAGE_DEFINITIONS.map((d) => d.beachSlug)),
      ].sort(),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Privacy and wiring                                                          */
/* -------------------------------------------------------------------------- */

describe("D-23 and production wiring", () => {
  it("prints only sanitized target metadata", async () => {
    const { deps, lines } = harness();
    await runSmoke(baseArgv(), deps);
    const output = lines.join("\n");
    const printed = JSON.parse(output) as Record<string, unknown>;
    expect(Object.keys(printed).sort()).toEqual([
      "beach_id",
      "beach_slug",
      "build_key",
      "coverage_slugs",
      "local_date",
      "mode",
      "production_vocabulary_triples",
      "timezone",
    ]);
    for (const forbidden of [
      "source_hash",
      "revision_hash",
      "issue_identity_key",
      "parser_version",
      "provider_lineage",
      "http",
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });

  it("wires production dependencies without importing the writer", () => {
    const deps = createProductionDeps();
    expect(typeof deps.writeRunner).toBe("function");
    expect(typeof deps.deriveBuildKey).toBe("function");
    expect(typeof deps.reader.probeTrustedForecastRelations).toBe("function");
  });

  it("derives the build key only after the beach target resolved", async () => {
    const { deps, deriveBuildKey } = harness({ beachRows: [] });
    await expect(runSmoke(baseArgv(), deps)).resolves.toBe(1);
    expect(deriveBuildKey).not.toHaveBeenCalled();
  });

  it("carries an abort code on every SmokeAbort", () => {
    const error = new SmokeAbort("beach_not_found", "x");
    expect(error.code).toBe("beach_not_found");
    expect(error.name).toBe("SmokeAbort");
  });
});
