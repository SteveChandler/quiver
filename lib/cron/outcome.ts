import * as Sentry from "@sentry/nextjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export interface CronOutcome {
  /** Stable id, matching the scheduled route (and phase, when applicable). */
  job: string;
  /** The thing this job exists to produce. */
  unit: string;
  produced: number;
  /** A run below this number is a failure unless it is explicitly legitimate. */
  expectedMin: number;
  expectedMax?: number;
  legitimatelyZero?: { reason: string };
}

export interface CronOutcomeOptions<T> {
  job: string;
  unit: string;
  expectedMin: number;
  expectedMax?: number;
  getProduced: (result: T) => number;
  legitimatelyZero?: (
    result: T,
  ) => CronOutcome["legitimatelyZero"] | undefined;
  failureReason?: (result: T) => string | null;
}

type CronOutcomeStatus = "ok" | "failed" | "error";

type CronRunsClient = {
  from: (table: "cron_runs") => {
    insert: (
      row: Record<string, unknown>,
    ) => PromiseLike<{ error?: { message?: string } | null }>;
  };
};

interface PersistedOutcome extends CronOutcome {
  status: CronOutcomeStatus;
  ranAt: string;
  durationMs: number;
  summary?: unknown;
  errorMessage?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asProduced(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function outcomeSummary(
  result: unknown,
  outcome: PersistedOutcome,
): Record<string, unknown> {
  return {
    result,
    cron_outcome: {
      job: outcome.job,
      unit: outcome.unit,
      produced: outcome.produced,
      expected_min: outcome.expectedMin,
      ...(outcome.expectedMax === undefined
        ? {}
        : { expected_max: outcome.expectedMax }),
      status: outcome.status,
      ...(outcome.legitimatelyZero
        ? { legitimately_zero_reason: outcome.legitimatelyZero.reason }
        : {}),
    },
  };
}

async function persistOutcome(outcome: PersistedOutcome): Promise<void> {
  try {
    const supabase = (await createSupabaseServiceRoleClient()) as unknown as CronRunsClient;
    const { error } = await supabase.from("cron_runs").insert({
      route: outcome.job,
      job: outcome.job,
      unit: outcome.unit,
      produced: outcome.produced,
      expected_min: outcome.expectedMin,
      expected_max: outcome.expectedMax ?? null,
      status: outcome.status,
      ran_at: outcome.ranAt,
      finished_at: outcome.ranAt,
      duration_ms: outcome.durationMs,
      legitimately_zero_reason: outcome.legitimatelyZero?.reason ?? null,
      summary: outcome.summary === undefined
        ? null
        : outcomeSummary(outcome.summary, outcome),
      error_message: outcome.errorMessage ?? null,
    });

    if (error) {
      throw new Error(error.message ?? "unknown cron outcome insert error");
    }
  } catch (error) {
    // The outcome columns arrive in an unapplied migration. A cron must remain
    // runnable during that deployment gap, with the missing durable row visible
    // in function logs instead of turning a healthy handler into a 500.
    console.warn("[cron-outcome] could not persist outcome", {
      job: outcome.job,
      unit: outcome.unit,
      error: errorMessage(error),
    });
  }
}

function alertFailedOutcome(outcome: PersistedOutcome, reason: string): void {
  try {
    Sentry.captureMessage(
      `[cron-outcome] ${outcome.job} produced ${outcome.produced} ${outcome.unit}; expected ${outcome.expectedMin}-${outcome.expectedMax ?? "∞"}`,
      {
        level: "error",
        tags: {
          cron_job: outcome.job,
          cron_unit: outcome.unit,
          cron_outcome_status: outcome.status,
        },
        extra: {
          reason,
          produced: outcome.produced,
          expected_min: outcome.expectedMin,
          expected_max: outcome.expectedMax ?? null,
        },
      },
    );
  } catch {
    // Alerting is best effort; it must not change the handler's result.
  }
}

/**
 * Run a cron handler, assert its produced outcome, and persist one outcome row.
 * The handler's value and thrown errors are always returned/rethrown unchanged.
 */
export async function withCronOutcome<T>(
  options: CronOutcomeOptions<T>,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await handler();
    let produced = 0;
    let extractionError: string | null = null;

    try {
      produced = asProduced(options.getProduced(result));
    } catch (error) {
      extractionError = errorMessage(error);
    }

    const legitimateZero =
      produced === 0 ? options.legitimatelyZero?.(result) : undefined;
    const failureReason = options.failureReason?.(result) ?? null;
    const belowMinimum = produced < options.expectedMin;
    const aboveMaximum =
      options.expectedMax !== undefined && produced > options.expectedMax;
    const naturallyFailed =
      extractionError !== null || (belowMinimum && !legitimateZero) || aboveMaximum;
    const failed = failureReason !== null || naturallyFailed;
    const status: CronOutcomeStatus = failed ? "failed" : "ok";
    const reason =
      failureReason ??
      extractionError ??
      (belowMinimum
        ? `produced ${produced}, expected at least ${options.expectedMin}`
        : aboveMaximum
          ? `produced ${produced}, expected at most ${options.expectedMax}`
          : "");
    const outcome: PersistedOutcome = {
      job: options.job,
      unit: options.unit,
      produced,
      expectedMin: options.expectedMin,
      expectedMax: options.expectedMax,
      legitimatelyZero: failed ? undefined : legitimateZero,
      status,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      summary: result,
      ...(reason ? { errorMessage: reason } : {}),
    };

    await persistOutcome(outcome);
    if (status === "failed") alertFailedOutcome(outcome, reason);
    return result;
  } catch (error) {
    const message = errorMessage(error);
    await persistOutcome({
      job: options.job,
      unit: options.unit,
      produced: 0,
      expectedMin: options.expectedMin,
      expectedMax: options.expectedMax,
      status: "error",
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      errorMessage: message,
    });
    try {
      Sentry.captureException(error instanceof Error ? error : new Error(message), {
        level: "error",
        tags: {
          cron_job: options.job,
          cron_unit: options.unit,
          cron_outcome_status: "error",
        },
      });
    } catch {
      // Error capture is best effort; the original handler error must survive.
    }
    throw error;
  }
}
