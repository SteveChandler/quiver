/**
 * Transport/receipt state matrix and server-only read matrix (Phase 21, 21-04).
 *
 * Fixture provenance: every issue row fed to the repository here is a verbatim
 * row from `trusted-forecast-issues.real.json` (21-01's shipped parsers via
 * 21-03's fixture), with only the database-assigned `issue_id` added by the
 * shared loader. Receipt and error shapes are synthetic by necessity — no live
 * database ran in this worktree — and each is built from the migration's own
 * column list and SQLSTATE codes.
 */

jest.mock("server-only", () => ({}));

import {
  TRUSTED_FORECAST_BUILD_SCHEMA_VERSION,
  TrustedForecastPersistenceError,
  persistTrustedForecastBuild,
  toTrustedForecastSnapshotPayload,
  trustedForecastBuildKey,
  type RpcResult,
  type TrustedForecastBuildPayload,
  type TrustedForecastPersistenceStore,
} from "../trusted-forecast-persistence";
import {
  TrustedForecastRepositoryError,
  createTrustedForecastReadStore,
  loadBeachIdsBySlug,
  loadEligibleTrustedForecastIssues,
  loadTrustedForecastApplications,
  loadTrustedForecastDecisions,
  type StoreResult,
  type TrustedForecastReadStore,
} from "../trusted-forecast-repository";
import { TrustedForecastCoverageError } from "../trusted-forecast-coverage";
import { TRUSTED_FORECAST_POLICY_VERSION } from "../trusted-forecast-policy";
import type { TrustedForecastCoverageEntry } from "../trusted-forecast-policy";
import type { DisplayPredictionRow } from "../log-display-prediction";
import {
  realIssueRow,
  storedIssueId,
} from "./fixtures/trusted-forecast-real-issues";

// ---------------------------------------------------------------------------
// Persistence: the eight transport states
// ---------------------------------------------------------------------------

const BEACH_ID = "00000000-0000-4000-8000-00000000beac";
const BUILD_ANCHOR = new Date("2026-08-06T12:00:00.000Z");

function payloadWith(
  counts: Partial<
    Pick<
      TrustedForecastBuildPayload,
      | "expectedDecisionCount"
      | "expectedApplicationCount"
      | "expectedAlertCount"
      | "expectedSnapshotCount"
    >
  > = {},
): TrustedForecastBuildPayload {
  return {
    schemaVersion: TRUSTED_FORECAST_BUILD_SCHEMA_VERSION,
    policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
    buildKey: trustedForecastBuildKey({
      beachId: BEACH_ID,
      buildAnchorAt: BUILD_ANCHOR,
      policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
    }),
    buildAnchorAt: BUILD_ANCHOR.toISOString(),
    decisions: [],
    applications: [],
    alerts: [],
    snapshots: [],
    expectedDecisionCount: 1,
    expectedApplicationCount: 2,
    expectedAlertCount: 0,
    expectedSnapshotCount: 2,
    ...counts,
  };
}

const PAYLOAD_SHA =
  "1111111111111111111111111111111111111111111111111111111111111111";

function receiptRow(
  payload: TrustedForecastBuildPayload,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    build_key: payload.buildKey,
    payload_sha256: PAYLOAD_SHA,
    schema_version: payload.schemaVersion,
    policy_version: payload.policyVersion,
    expected_decision_count: payload.expectedDecisionCount,
    expected_application_count: payload.expectedApplicationCount,
    expected_alert_count: payload.expectedAlertCount,
    expected_snapshot_count: payload.expectedSnapshotCount,
    inserted_decision_count: payload.expectedDecisionCount,
    reused_decision_count: 0,
    inserted_application_count: payload.expectedApplicationCount,
    reused_application_count: 0,
    inserted_alert_count: payload.expectedAlertCount,
    reused_alert_count: 0,
    inserted_snapshot_count: 0,
    reused_snapshot_count: payload.expectedSnapshotCount,
    durable_alert_count: payload.expectedAlertCount,
    ...overrides,
  };
}

interface ScriptedStore extends TrustedForecastPersistenceStore {
  readonly persistCalls: TrustedForecastBuildPayload[];
  readonly receiptCalls: string[];
}

function scriptedStore(script: {
  persist: readonly (RpcResult | Error)[];
  receipt?: readonly (RpcResult | Error)[];
}): ScriptedStore {
  const persistCalls: TrustedForecastBuildPayload[] = [];
  const receiptCalls: string[] = [];
  let persistIndex = 0;
  let receiptIndex = 0;
  return {
    persistCalls,
    receiptCalls,
    async persistBuild(payload) {
      persistCalls.push(payload);
      const next = script.persist[persistIndex];
      persistIndex += 1;
      if (next === undefined) throw new Error("unscripted persist call");
      if (next instanceof Error) throw next;
      return next;
    },
    async loadReceipt(buildKey) {
      receiptCalls.push(buildKey);
      const next = script.receipt?.[receiptIndex];
      receiptIndex += 1;
      if (next === undefined) throw new Error("unscripted receipt call");
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const ok = (data: unknown): RpcResult => ({ data, error: null });
const failed = (code: string): RpcResult => ({
  data: null,
  error: { code, message: `simulated ${code}` },
});

describe("persistTrustedForecastBuild — the eight transport states", () => {
  it("state 1: a matching returned receipt authorizes adjusted output", async () => {
    const payload = payloadWith();
    const store = scriptedStore({ persist: [ok([receiptRow(payload)])] });

    const outcome = await persistTrustedForecastBuild({ store, payload });

    expect(outcome).toEqual({
      kind: "receipt",
      receipt: expect.objectContaining({ buildKey: payload.buildKey }),
      reconciled: false,
    });
    expect(store.receiptCalls).toEqual([]);
  });

  it("state 2: a returned receipt with the wrong counts throws, never serves", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [
        ok([receiptRow(payload, { expected_application_count: 99 })]),
      ],
    });

    await expect(persistTrustedForecastBuild({ store, payload })).rejects.toThrow(
      TrustedForecastPersistenceError,
    );
  });

  it.each([
    ["22023", "the RPC's own strict contract checks"],
    ["23503", "an application with no daily decision"],
    ["23514", "a check constraint"],
    ["42501", "insufficient privilege — nothing written"],
    ["PGRST202", "the migration is not applied yet"],
  ])(
    "state 3: definite rejection %s (%s) permits byte-identical baseline",
    async (code) => {
      const payload = payloadWith();
      const store = scriptedStore({ persist: [failed(code)] });

      const outcome = await persistTrustedForecastBuild({ store, payload });

      expect(outcome).toEqual({ kind: "definite_rejection", code });
      // Baseline is only safe because nothing was written; reconciliation must
      // not have been attempted.
      expect(store.receiptCalls).toEqual([]);
    },
  );

  it("state 4: a uniqueness collision is reconciliation-required, never baseline", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [failed("23505"), ok([receiptRow(payload)])],
      receipt: [ok([receiptRow(payload)])],
    });

    const outcome = await persistTrustedForecastBuild({ store, payload });

    expect(outcome).toEqual({
      kind: "receipt",
      receipt: expect.objectContaining({ buildKey: payload.buildKey }),
      reconciled: true,
    });
    expect(store.receiptCalls).toEqual([payload.buildKey]);
  });

  it("state 5: a thrown transport error triggers reconciliation", async () => {
    const payload = payloadWith();
    const timeout = new Error("socket hang up");
    timeout.name = "AbortError";
    const store = scriptedStore({
      persist: [timeout, ok([receiptRow(payload)])],
      receipt: [ok([receiptRow(payload)])],
    });

    const outcome = await persistTrustedForecastBuild({ store, payload });

    expect(outcome).toMatchObject({ kind: "receipt", reconciled: true });
  });

  it("state 6: reconciliation that finds a matching durable receipt authorizes output", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [failed("57014"), ok([receiptRow(payload)])],
      receipt: [ok([receiptRow(payload)])],
    });

    const outcome = await persistTrustedForecastBuild({ store, payload });

    expect(outcome).toMatchObject({ kind: "receipt", reconciled: true });
    // The database, not this process, compared the canonical hash: the replay
    // is the only way a caller can have it checked at all.
    expect(store.persistCalls).toHaveLength(2);
  });

  it("state 7: a missing receipt after ambiguity throws retriable", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [failed("23505")],
      receipt: [ok([])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_missing", retriable: true });
  });

  it("state 7b: a mismatched receipt after ambiguity throws retriable", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [failed("23505")],
      receipt: [ok([receiptRow(payload, { expected_decision_count: 7 })])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_mismatch" });
  });

  it("state 8: an unreadable receipt after ambiguity throws retriable", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [failed("23505")],
      receipt: [failed("08006")],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_unreadable" });
  });

  it("an unclassifiable error is treated as ambiguity, not as a definite rejection", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [failed("XX000")],
      receipt: [ok([])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_missing" });
  });

  it("a success with no parseable receipt row reconciles rather than serving", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [ok(null)],
      receipt: [ok([])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_missing" });
  });

  it("reconciliation refuses when the database's own hash comparison fails", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      // The durable receipt looks right on counts, but replaying the identical
      // build raises the RPC's idempotency collision: the stored canonical hash
      // belongs to a different payload.
      persist: [failed("23505"), failed("23505")],
      receipt: [ok([receiptRow(payload)])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_mismatch" });
  });

  it("reconciliation refuses when the replayed receipt carries a different hash", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [
        failed("23505"),
        ok([
          receiptRow(payload, {
            payload_sha256:
              "2222222222222222222222222222222222222222222222222222222222222222",
          }),
        ]),
      ],
      receipt: [ok([receiptRow(payload)])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_mismatch" });
  });

  it("a receipt whose inserted+reused does not equal expected is a mismatch", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [ok([receiptRow(payload, { inserted_application_count: 0 })])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toMatchObject({ code: "receipt_mismatch" });
  });

  it("the build key is deterministic and inside the RPC's 200-character bound", () => {
    const first = trustedForecastBuildKey({
      beachId: BEACH_ID,
      buildAnchorAt: BUILD_ANCHOR,
      policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
    });
    const second = trustedForecastBuildKey({
      beachId: BEACH_ID,
      buildAnchorAt: new Date(BUILD_ANCHOR.getTime()),
      policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
    });
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThanOrEqual(200);
  });

  it("snapshot payloads carry the RPC's column names, not the buffer's", () => {
    const row = {
      beach_id: BEACH_ID,
      predicted_at: BUILD_ANCHOR.toISOString(),
      wave_height_om_m: 1.1,
      display_source: "face-Hs-transformer-v1",
    } as unknown as DisplayPredictionRow;

    const payload = toTrustedForecastSnapshotPayload(row);

    expect(payload).not.toHaveProperty("wave_height_om_m");
    expect(payload.wave_height_om).toBe(1.1);
    expect(payload.model_version).toBe("face-Hs-transformer-v1");
  });

  it("no error message carries source content — statuses and counts only", async () => {
    const payload = payloadWith();
    const store = scriptedStore({
      persist: [
        {
          data: null,
          error: {
            code: "23505",
            message:
              "duplicate key value violates unique constraint; https://wavecast.com/socal/ said 8 to 12 feet",
          },
        },
      ],
      receipt: [ok([])],
    });

    await expect(
      persistTrustedForecastBuild({ store, payload }),
    ).rejects.toThrow(/^trusted forecast build receipt_missing: sqlstate_23505$/);
  });
});

// ---------------------------------------------------------------------------
// Repository: empty means "read fine, no rows" and nothing else
// ---------------------------------------------------------------------------

const COVERAGE_ENTRY: TrustedForecastCoverageEntry = {
  beachId: BEACH_ID,
  localTimezone: "America/Los_Angeles",
  spotRegionKeys: ["trestles"],
  regionalRegionKeys: ["socal"],
  compatibleExposures: ["NNW", "SSW"],
  regionalAuthorityLineages: [],
};

function realRowWithId(documentId: string, index: number): Record<string, unknown> {
  const row = realIssueRow(documentId, index);
  row.issue_id = storedIssueId(documentId, index);
  return row;
}

function readStore(
  overrides: Partial<TrustedForecastReadStore> = {},
): TrustedForecastReadStore {
  const empty = async (): Promise<StoreResult<unknown[]>> => ({
    data: [],
    error: null,
  });
  return {
    selectBeachIdsBySlug: overrides.selectBeachIdsBySlug ?? empty,
    selectIssuePage: overrides.selectIssuePage ?? empty,
    selectDecisions: overrides.selectDecisions ?? empty,
    selectApplications: overrides.selectApplications ?? empty,
  };
}

describe("trusted forecast repository — reads fail closed", () => {
  const TRESTLES_ROWS = [
    realRowWithId("wavecast_spot_chart_live_trestles", 0),
    realRowWithId("wavecast_spot_chart_live_trestles", 1),
  ];

  it("lets policy inspect non-authority superseders before it filters authority", async () => {
    const eqCalls: string[][] = [];
    const inCalls: string[][] = [];
    const chain: Record<string, jest.Mock> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn((column: string, value: unknown) => {
        eqCalls.push([column, String(value)]);
        return chain;
      });
    chain.in = jest.fn((column: string, values: unknown[]) => {
      inCalls.push([column, values.join(",")]);
      return chain;
    });
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(async () => ({ data: [], error: null }));
    chain.gt = jest.fn(() => chain);
    const store = createTrustedForecastReadStore(
      () => ({ from: jest.fn(() => chain) }) as never,
    );

    await store.selectIssuePage({
      regionKeys: ["trestles"],
      localDates: ["2026-08-06"],
      afterIssueId: null,
      limit: 500,
    });

    expect(eqCalls).not.toContainEqual(["authority_eligible", "true"]);
    expect(inCalls).toContainEqual(["region_key", "trestles"]);
  });

  it("returns strictly parsed real rows on a successful read", async () => {
    const store = readStore({
      selectIssuePage: async () => ({ data: TRESTLES_ROWS, error: null }),
    });

    const issues = await loadEligibleTrustedForecastIssues(store, {
      entry: COVERAGE_ENTRY,
      localDates: [TRESTLES_ROWS[0].valid_local_date as string],
    });

    expect(issues).toHaveLength(2);
    expect(issues[0].sourceKey).toBe("socal");
    expect(issues[0].regionKey).toBe("trestles");
    expect(issues[0].issueId).toBe(TRESTLES_ROWS[0].issue_id);
  });

  it("an empty result means a successful read with no matching rows", async () => {
    const store = readStore({
      selectIssuePage: async () => ({ data: [], error: null }),
    });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: ["2026-08-06"],
      }),
    ).resolves.toEqual([]);
  });

  it("a query failure is a typed retriable error, never an empty evidence result", async () => {
    const store = readStore({
      selectIssuePage: async () => ({
        data: null,
        error: { code: "57014", message: "canceling statement" },
      }),
    });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: ["2026-08-06"],
      }),
    ).rejects.toMatchObject({ code: "issue_read_failed", retriable: true });
  });

  it("a null result with no error is still a failure, not an empty read", async () => {
    const store = readStore({
      selectIssuePage: async () => ({ data: null, error: null }),
    });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: ["2026-08-06"],
      }),
    ).rejects.toMatchObject({ code: "issue_read_failed" });
  });

  it("a malformed private row fails with the offending field, never masquerades as no evidence", async () => {
    const broken: Record<string, unknown> = {
      ...TRESTLES_ROWS[0],
      max_face_ft: "eight",
    };
    const store = readStore({
      selectIssuePage: async () => ({ data: [broken], error: null }),
    });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: [TRESTLES_ROWS[0].valid_local_date as string],
      }),
    ).rejects.toThrow(/issue_row_invalid: max_face_ft/);
  });

  it("an unknown source_key is loud instead of silently inheriting the strictest bound", async () => {
    // A new Seaside source with a 336-hour cadence would otherwise be treated
    // as stale at 24 hours and vanish with no log at all.
    const drifted: Record<string, unknown> = {
      ...TRESTLES_ROWS[0],
      source_key: "socal_v2",
    };
    const store = readStore({
      selectIssuePage: async () => ({ data: [drifted], error: null }),
    });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: [TRESTLES_ROWS[0].valid_local_date as string],
      }),
    ).rejects.toMatchObject({ code: "unknown_source_key" });
  });

  it("a Seaside-resolved beach_id trips the collapse-key guard at the read boundary", async () => {
    const resolved: Record<string, unknown> = {
      ...TRESTLES_ROWS[0],
      beach_id: BEACH_ID,
    };
    const store = readStore({
      selectIssuePage: async () => ({ data: [resolved], error: null }),
    });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: [TRESTLES_ROWS[0].valid_local_date as string],
      }),
    ).rejects.toBeInstanceOf(TrustedForecastCoverageError);
  });

  it("an entry with no region keys or no local dates reads nothing at all", async () => {
    const selectIssuePage = jest.fn();
    const store = readStore({ selectIssuePage });
    await expect(
      loadEligibleTrustedForecastIssues(store, {
        entry: COVERAGE_ENTRY,
        localDates: [],
      }),
    ).resolves.toEqual([]);
    expect(selectIssuePage).not.toHaveBeenCalled();
  });

  it("durable decisions are returned only for the exact beach and local dates asked for", async () => {
    const store = readStore({
      selectDecisions: async () => ({
        data: [
          {
            decision_id: "00000000-0000-4000-8000-00000000dec1",
            beach_id: BEACH_ID,
            local_date: "2026-08-06",
            applied_delta_ft: "0.2500",
            status: "applied",
          },
        ],
        error: null,
      }),
    });

    await expect(
      loadTrustedForecastDecisions(store, {
        beachId: BEACH_ID,
        localDates: ["2026-08-06"],
      }),
    ).resolves.toEqual([
      {
        decisionId: "00000000-0000-4000-8000-00000000dec1",
        beachId: BEACH_ID,
        localDate: "2026-08-06",
        appliedDeltaFt: 0.25,
        status: "applied",
      },
    ]);
  });

  it("a decision row outside the requested scope is a failure, not another beach's day", async () => {
    const store = readStore({
      selectDecisions: async () => ({
        data: [
          {
            decision_id: "00000000-0000-4000-8000-00000000dec1",
            beach_id: "00000000-0000-4000-8000-00000000bea9",
            local_date: "2026-08-06",
            applied_delta_ft: 0.25,
            status: "applied",
          },
        ],
        error: null,
      }),
    });

    await expect(
      loadTrustedForecastDecisions(store, {
        beachId: BEACH_ID,
        localDates: ["2026-08-06"],
      }),
    ).rejects.toMatchObject({ code: "decision_row_invalid" });
  });

  it("a decision read failure is retriable", async () => {
    const store = readStore({
      selectDecisions: async () => ({
        data: null,
        error: { code: "42501", message: "permission denied" },
      }),
    });
    await expect(
      loadTrustedForecastDecisions(store, {
        beachId: BEACH_ID,
        localDates: ["2026-08-06"],
      }),
    ).rejects.toMatchObject({ code: "decision_read_failed", retriable: true });
  });

  it("durable applications name the exact slots a reused decision already claimed", async () => {
    const store = readStore({
      selectApplications: async () => ({
        data: [
          {
            beach_id: BEACH_ID,
            forecast_at: "2026-08-06T15:00:00+00:00",
            applied_delta_ft: "-0.5000",
          },
        ],
        error: null,
      }),
    });

    const applications = await loadTrustedForecastApplications(store, {
      beachId: BEACH_ID,
      forecastAts: ["2026-08-06T15:00:00.000Z"],
    });

    expect([...applications]).toEqual([["2026-08-06T15:00:00.000Z", -0.5]]);
  });

  it("an application read failure is retriable", async () => {
    const store = readStore({
      selectApplications: async () => ({
        data: null,
        error: { code: "08006", message: "connection failure" },
      }),
    });
    await expect(
      loadTrustedForecastApplications(store, {
        beachId: BEACH_ID,
        forecastAts: ["2026-08-06T15:00:00.000Z"],
      }),
    ).rejects.toMatchObject({ code: "application_read_failed" });
  });

  it("beach slug resolution distinguishes a failed read from a missing row", async () => {
    await expect(
      loadBeachIdsBySlug(
        readStore({
          selectBeachIdsBySlug: async () => ({
            data: null,
            error: { code: "57014", message: "canceling statement" },
          }),
        }),
        ["lower-trestles"],
      ),
    ).rejects.toBeInstanceOf(TrustedForecastRepositoryError);

    await expect(
      loadBeachIdsBySlug(
        readStore({
          selectBeachIdsBySlug: async () => ({ data: [], error: null }),
        }),
        ["lower-trestles"],
      ),
    ).resolves.toEqual(new Map());
  });

  it("a malformed beach row is rejected rather than silently skipped", async () => {
    await expect(
      loadBeachIdsBySlug(
        readStore({
          selectBeachIdsBySlug: async () => ({
            data: [{ id: "not-a-uuid", slug: "lower-trestles" }],
            error: null,
          }),
        }),
        ["lower-trestles"],
      ),
    ).rejects.toMatchObject({ code: "beach_row_invalid" });
  });

  it("read errors carry codes only, never source ranges, hosts or hashes", async () => {
    const row = TRESTLES_ROWS[0];
    const store = readStore({
      selectIssuePage: async () => ({
        data: null,
        error: {
          code: "57014",
          message: `canceling statement for ${row.source_hash} at https://wavecast.com`,
        },
      }),
    });

    const message = await loadEligibleTrustedForecastIssues(store, {
      entry: COVERAGE_ENTRY,
      localDates: ["2026-08-06"],
    }).then(
      () => "no failure was raised",
      (error: Error) => error.message,
    );

    expect(message).toBe("trusted forecast repository issue_read_failed: 57014");
    expect(message).not.toContain(row.source_hash as string);
    expect(message).not.toContain("wavecast.com");
  });
});
