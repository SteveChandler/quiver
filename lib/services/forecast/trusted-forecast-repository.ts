/**
 * Reads of private trusted-forecast state (Phase 21, MFA-05).
 *
 * Two reads, both strictly validated:
 *  - `trusted_forecast_issues` rows for one coverage entry and the local days
 *    a build covers; policy must see non-authority superseders before it
 *    decides which rows may act as authority;
 *  - the exact existing `(beach_id, local_date)` decisions, so a repeated build
 *    reuses the original durable decision instead of minting a second one.
 *
 * Fail-closed rule that governs the whole module: an empty result means a
 * successful read that matched no rows. A query failure, an over-long page, a
 * malformed row or an unknown `source_key` throws a typed retriable error and
 * never degrades into "no evidence".
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import {
  TRUSTED_FORECAST_SOURCE_KEYS,
  assertIssueBeachIdsUnresolved,
} from "./trusted-forecast-coverage";
import {
  TRUSTED_FORECAST_ISSUE_INPUT_FIELDS,
  parseTrustedForecastIssue,
  TrustedForecastIssueContractError,
  type TrustedForecastCoverageEntry,
  type TrustedForecastIssue,
} from "./trusted-forecast-policy";
import type {
  ExistingTrustedForecastDecision,
  TrustedForecastDecisionStatus,
} from "./trusted-forecast-adjustment";

/** Explicit projection. `select("*")` would drag private columns we never read. */
export const TRUSTED_FORECAST_ISSUE_COLUMNS: readonly string[] = Object.freeze([
  "issue_id",
  ...TRUSTED_FORECAST_ISSUE_INPUT_FIELDS,
]);

export const TRUSTED_FORECAST_DECISION_COLUMNS: readonly string[] = Object.freeze(
  ["decision_id", "beach_id", "local_date", "applied_delta_ft", "status"],
);

export const TRUSTED_FORECAST_APPLICATION_COLUMNS: readonly string[] =
  Object.freeze(["beach_id", "forecast_at", "applied_delta_ft"]);

const ISSUE_PAGE_SIZE = 500;
const MAX_ISSUE_PAGES = 20;

const KNOWN_SOURCE_KEYS: ReadonlySet<string> = new Set(
  TRUSTED_FORECAST_SOURCE_KEYS,
);

export type TrustedForecastRepositoryErrorCode =
  | "beach_read_failed"
  | "beach_row_invalid"
  | "issue_read_failed"
  | "issue_row_invalid"
  | "issue_page_limit_exceeded"
  | "unknown_source_key"
  | "decision_read_failed"
  | "decision_row_invalid"
  | "application_read_failed"
  | "application_row_invalid";

/**
 * Every repository failure is retriable: the caller must not serve an
 * unattributed adjustment, and it must not conclude "no trusted evidence"
 * either. Messages carry codes and counts only, never source content.
 */
export class TrustedForecastRepositoryError extends Error {
  readonly code: TrustedForecastRepositoryErrorCode;
  readonly retriable = true as const;

  constructor(code: TrustedForecastRepositoryErrorCode, detail?: string) {
    super(
      detail === undefined
        ? `trusted forecast repository ${code}`
        : `trusted forecast repository ${code}: ${detail}`,
    );
    this.name = "TrustedForecastRepositoryError";
    this.code = code;
  }
}

export interface StoreResult<T> {
  readonly data: T | null;
  readonly error: { readonly code?: string; readonly message?: string } | null;
}

/** Injectable so the read-state matrix is testable without a live database. */
export interface TrustedForecastReadStore {
  selectBeachIdsBySlug(slugs: readonly string[]): Promise<StoreResult<unknown[]>>;
  selectIssuePage(args: {
    readonly regionKeys: readonly string[];
    readonly localDates: readonly string[];
    readonly afterIssueId: string | null;
    readonly limit: number;
  }): Promise<StoreResult<unknown[]>>;
  selectDecisions(args: {
    readonly beachId: string;
    readonly localDates: readonly string[];
  }): Promise<StoreResult<unknown[]>>;
  selectApplications(args: {
    readonly beachId: string;
    readonly forecastAts: readonly string[];
  }): Promise<StoreResult<unknown[]>>;
}

type TrustedForecastSupabaseClient = SupabaseClient<Database>;

const BEACH_SLUG_ROW = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
});

const DECISION_STATUSES = [
  "applied",
  "no_adjustment",
  "no_authority",
  "blocked_conflict",
] as const;

const DECISION_ROW = z.object({
  decision_id: z.string().uuid(),
  beach_id: z.string().uuid(),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  applied_delta_ft: z.union([z.number(), z.string()]),
  status: z.enum(DECISION_STATUSES),
});

function numericFromDatabase(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TrustedForecastRepositoryError("decision_row_invalid");
  }
  return parsed;
}

export function createTrustedForecastReadStore(
  createClient: () => TrustedForecastSupabaseClient,
): TrustedForecastReadStore {
  return {
    async selectBeachIdsBySlug(slugs) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("beaches")
        .select("id, slug")
        .in("slug", [...slugs]);
      return { data: (data as unknown[]) ?? null, error };
    },
    async selectIssuePage({ regionKeys, localDates, afterIssueId, limit }) {
      const supabase = createClient();
      let query = supabase
        .from("trusted_forecast_issues" as never)
        .select(TRUSTED_FORECAST_ISSUE_COLUMNS.join(", "))
        .in("region_key", [...regionKeys])
        .in("valid_local_date", [...localDates])
        .order("issue_id", { ascending: true })
        .limit(limit);
      if (afterIssueId !== null) query = query.gt("issue_id", afterIssueId);
      const { data, error } = await query;
      return { data: (data as unknown[]) ?? null, error };
    },
    async selectDecisions({ beachId, localDates }) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trusted_forecast_decisions" as never)
        .select(TRUSTED_FORECAST_DECISION_COLUMNS.join(", "))
        .eq("beach_id", beachId)
        .in("local_date", [...localDates]);
      return { data: (data as unknown[]) ?? null, error };
    },
    async selectApplications({ beachId, forecastAts }) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("trusted_forecast_applications" as never)
        .select(TRUSTED_FORECAST_APPLICATION_COLUMNS.join(", "))
        .eq("beach_id", beachId)
        .in("forecast_at", [...forecastAts]);
      return { data: (data as unknown[]) ?? null, error };
    },
  };
}

/**
 * Resolve approved coverage beach slugs to ids.
 *
 * Returns only the slugs that exist; the coverage module decides whether a
 * missing slug is fatal, so a read failure and a missing row stay distinct.
 */
export async function loadBeachIdsBySlug(
  store: TrustedForecastReadStore,
  slugs: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (slugs.length === 0) return out;

  const { data, error } = await store.selectBeachIdsBySlug(slugs);
  if (error) {
    throw new TrustedForecastRepositoryError(
      "beach_read_failed",
      error.code ?? "unknown",
    );
  }
  if (!Array.isArray(data)) {
    throw new TrustedForecastRepositoryError(
      "beach_read_failed",
      "non-array result",
    );
  }

  for (const row of data) {
    const parsed = BEACH_SLUG_ROW.safeParse(row);
    if (!parsed.success) {
      throw new TrustedForecastRepositoryError("beach_row_invalid");
    }
    out.set(parsed.data.slug, parsed.data.id);
  }
  return out;
}

/**
 * Load every issue this coverage entry could need for the given local days.
 * Non-authority rows stay in the result because a retraction may supersede an
 * older authority row; policy applies the authority filter after that step.
 *
 * The `source_key` guard is the point of this function beyond the query:
 * `freshnessMaxAgeHoursForSource` falls back to the strictest 24-hour bound for
 * an unknown key, so a new Seaside source with a 336-hour cadence would be
 * treated as stale and vanish with no log at all. Here it is a named failure.
 */
export async function loadEligibleTrustedForecastIssues(
  store: TrustedForecastReadStore,
  args: {
    readonly entry: TrustedForecastCoverageEntry;
    readonly localDates: readonly string[];
  },
): Promise<TrustedForecastIssue[]> {
  const regionKeys = [
    ...new Set([
      ...args.entry.spotRegionKeys,
      ...args.entry.regionalRegionKeys,
    ]),
  ];
  if (regionKeys.length === 0 || args.localDates.length === 0) return [];

  const issues: TrustedForecastIssue[] = [];
  let afterIssueId: string | null = null;

  for (let page = 0; page < MAX_ISSUE_PAGES; page += 1) {
    const { data, error }: StoreResult<unknown[]> = await store.selectIssuePage({
      regionKeys,
      localDates: args.localDates,
      afterIssueId,
      limit: ISSUE_PAGE_SIZE,
    });
    if (error) {
      throw new TrustedForecastRepositoryError(
        "issue_read_failed",
        error.code ?? "unknown",
      );
    }
    if (!Array.isArray(data)) {
      throw new TrustedForecastRepositoryError(
        "issue_read_failed",
        "non-array result",
      );
    }

    for (const row of data) {
      let issue: TrustedForecastIssue;
      try {
        issue = parseTrustedForecastIssue(row);
      } catch (cause) {
        throw new TrustedForecastRepositoryError(
          "issue_row_invalid",
          cause instanceof TrustedForecastIssueContractError
            ? cause.field
            : "unparseable",
        );
      }
      if (!KNOWN_SOURCE_KEYS.has(issue.sourceKey)) {
        throw new TrustedForecastRepositoryError(
          "unknown_source_key",
          `${issue.sourceKey} is absent from the ${TRUSTED_FORECAST_SOURCE_KEYS.length}-source freshness table; ` +
            "it would silently inherit the strictest bound and be dropped as stale",
        );
      }
      issues.push(issue);
    }

    if (data.length < ISSUE_PAGE_SIZE) {
      assertIssueBeachIdsUnresolved(issues);
      return issues;
    }
    const lastId = issues[issues.length - 1]?.issueId ?? null;
    if (lastId === null) {
      throw new TrustedForecastRepositoryError("issue_row_invalid", "issue_id");
    }
    afterIssueId = lastId;
  }

  throw new TrustedForecastRepositoryError(
    "issue_page_limit_exceeded",
    `${MAX_ISSUE_PAGES * ISSUE_PAGE_SIZE}`,
  );
}

/** Exact `(beach_id, local_date)` durable decisions. D-13/D-18 reuse. */
export async function loadTrustedForecastDecisions(
  store: TrustedForecastReadStore,
  args: {
    readonly beachId: string;
    readonly localDates: readonly string[];
  },
): Promise<ExistingTrustedForecastDecision[]> {
  if (args.localDates.length === 0) return [];

  const { data, error } = await store.selectDecisions({
    beachId: args.beachId,
    localDates: args.localDates,
  });
  if (error) {
    throw new TrustedForecastRepositoryError(
      "decision_read_failed",
      error.code ?? "unknown",
    );
  }
  if (!Array.isArray(data)) {
    throw new TrustedForecastRepositoryError(
      "decision_read_failed",
      "non-array result",
    );
  }

  const requested = new Set(args.localDates);
  const decisions: ExistingTrustedForecastDecision[] = [];
  for (const row of data) {
    const parsed = DECISION_ROW.safeParse(row);
    if (!parsed.success) {
      throw new TrustedForecastRepositoryError("decision_row_invalid");
    }
    // A wider row than asked for means the filter did not hold; treating it as
    // this beach's durable decision would suppress a day it never covered.
    if (
      parsed.data.beach_id !== args.beachId ||
      !requested.has(parsed.data.local_date)
    ) {
      throw new TrustedForecastRepositoryError(
        "decision_row_invalid",
        "out of requested scope",
      );
    }
    decisions.push({
      decisionId: parsed.data.decision_id,
      beachId: parsed.data.beach_id,
      localDate: parsed.data.local_date,
      appliedDeltaFt: numericFromDatabase(parsed.data.applied_delta_ft),
      status: parsed.data.status as TrustedForecastDecisionStatus,
    });
  }
  return decisions;
}

const APPLICATION_ROW = z.object({
  beach_id: z.string().uuid(),
  forecast_at: z.string().min(1),
  applied_delta_ft: z.union([z.number(), z.string()]),
});

/**
 * The exact slots a durable decision already claimed, keyed by the slot instant
 * in ISO form.
 *
 * A reused decision must move exactly the slots the original build moved. It
 * cannot be recomputed from the decision row alone: `applied_delta_ft` says how
 * much, not which slots, and the original primary may have claimed only one day
 * part. These rows are the durable answer.
 */
export async function loadTrustedForecastApplications(
  store: TrustedForecastReadStore,
  args: {
    readonly beachId: string;
    readonly forecastAts: readonly string[];
  },
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (args.forecastAts.length === 0) return out;

  const { data, error } = await store.selectApplications({
    beachId: args.beachId,
    forecastAts: args.forecastAts,
  });
  if (error) {
    throw new TrustedForecastRepositoryError(
      "application_read_failed",
      error.code ?? "unknown",
    );
  }
  if (!Array.isArray(data)) {
    throw new TrustedForecastRepositoryError(
      "application_read_failed",
      "non-array result",
    );
  }

  for (const row of data) {
    const parsed = APPLICATION_ROW.safeParse(row);
    if (!parsed.success) {
      throw new TrustedForecastRepositoryError("application_row_invalid");
    }
    if (parsed.data.beach_id !== args.beachId) {
      throw new TrustedForecastRepositoryError(
        "application_row_invalid",
        "out of requested scope",
      );
    }
    const at = new Date(parsed.data.forecast_at);
    if (Number.isNaN(at.getTime())) {
      throw new TrustedForecastRepositoryError(
        "application_row_invalid",
        "forecast_at",
      );
    }
    const delta = Number(parsed.data.applied_delta_ft);
    if (!Number.isFinite(delta)) {
      throw new TrustedForecastRepositoryError(
        "application_row_invalid",
        "applied_delta_ft",
      );
    }
    out.set(at.toISOString(), delta);
  }
  return out;
}
