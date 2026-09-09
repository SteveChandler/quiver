import * as Sentry from "@sentry/nextjs";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import {
  completeCronCheckIn,
  startCronCheckIn,
  type CronMonitorConfig,
} from "@/lib/monitoring/sentry-cron";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Supabase query builders are thenables, not full Promises — they expose
// .then() but not .catch(). PromiseLike accurately reflects that shape;
// using Promise<...> would falsely advertise .catch() on the raw chain.
type CronRunUpdateChain = PromiseLike<{ error?: unknown }> & {
  lt: (col: string, val: string) => PromiseLike<{ error?: unknown }>;
};

type CronRunsTable = {
  from: (table: "cron_runs") => {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => { single: () => PromiseLike<{ data: { id: string } | null; error?: unknown }> };
    };
    update: (row: Record<string, unknown>) => { eq: (col: string, val: string) => CronRunUpdateChain };
  };
};

interface CronObservabilityOptions<T> {
  statusForResult: (result: T) => "ok" | "error";
  errorMessageForResult?: (result: T) => string | null;
}

function extractErrorMessage(summary: unknown, statusCode: number): string {
  const fallback = `HTTP ${statusCode}`;
  if (!summary || typeof summary !== "object") return fallback;

  const obj = summary as { error?: unknown; details?: unknown };
  const top = typeof obj.error === "string" && obj.error.length > 0 ? obj.error : null;
  const details = obj.details;
  let detail: string | null = null;

  if (typeof details === "string" && details.length > 0) {
    detail = details;
  } else if (details && typeof details === "object") {
    for (const key of ["error", "message", "originalError"]) {
      const value = (details as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 0) {
        detail = value;
        break;
      }
    }
  }

  if (top && detail) return `${top}: ${detail}`;
  if (top) return top;
  if (detail) return detail;
  return fallback;
}

function captureCronFailure(
  route: string,
  error: unknown,
  context: { statusCode?: number; source: "response" | "throw" | "result" },
): void {
  try {
    const captured = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(captured, {
      level: "error",
      tags: {
        cron_route: route,
        cron_failure_source: context.source,
      },
      extra: {
        status_code: context.statusCode ?? null,
      },
    });
  } catch {
    // Error capture is best effort and must never change cron behavior.
  }
}

async function recordCronWrite<T extends { error?: unknown }>(
  route: string,
  operation: "insert" | "update" | "sweep",
  runId: string | null,
  write: () => PromiseLike<T>,
): Promise<T | null> {
  try {
    const result = await write();
    if (result.error) throw result.error;
    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      console.warn("[cron-observability] ledger write failed", {
        job: route, runId, operation, attempt: 1, timestamp: new Date().toISOString(),
        code: typeof code === "string" && /^(?:[0-9A-Z]{5}|PGRST[0-9]{3})$/.test(code) ? code : "unknown",
      });
    }
    return null;
  }
}

async function sweepStaleStartedRows(db: CronRunsTable, route: string): Promise<void> {
  await recordCronWrite(route, "sweep", null, () => {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    return db
      .from("cron_runs")
      .update({
        status: "timeout",
        finished_at: new Date().toISOString(),
        error_message: "No completion recorded within 15 minutes; process termination or timeout is unverified",
      })
      .eq("status", "started")
      .lt("started_at", cutoff);
  });
}

function shouldStartSentryCronMonitor(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.VERCEL_ENV || env.NODE_ENV) === "production";
}

async function finishSentryCronCheckIn(
  checkInId: string,
  monitorSlug: string,
  status: "ok" | "error",
  durationMs: number,
): Promise<void> {
  try {
    await completeCronCheckIn(checkInId, monitorSlug, status, durationMs);
  } catch (err) {
    // Telemetry must never alter the route's response or thrown error.
    if (process.env.NODE_ENV !== "test") {
      console.warn("[cron-observability] Sentry completion failed", monitorSlug, status, err);
    }
  }
}

/**
 * Response-level wrapper: takes an existing route handler and returns one that
 * logs every invocation to `cron_runs`. Works on routes that already do their
 * own auth + JSON shaping — wrap the export, don't touch the body.
 *
 * Usage:
 *   async function _GET(request: Request) { ... existing body ... }
 *   export const GET = withObservedCron("/api/cron/foo", _GET);
 *
 * On success: stores `status='ok'` (if Response.ok) or `status='error'`,
 * `duration_ms`, and the parsed JSON body as `summary` (best-effort, capped
 * at 8 KB to avoid pathological payloads). On thrown error: stores
 * `status='error'` and `error_message`. Observability never blocks the
 * handler — ledger failures are reported with safe codes.
 */
export function withObservedCron<H extends (request: Request) => Promise<Response>>(
  route: string,
  handler: H,
  monitor?: CronMonitorConfig
): H {
  const wrapped = (async (request: Request) => {
    const start = Date.now();
    let runId: string | null = null;
    let checkInId: string | null = null;

    // Skip observability for unauthorized requests so the wrapper doesn't
    // touch the DB before the handler returns 401. Each handler still calls
    // validateCronRequest itself; this is the gate, not the auth.
    const authorized = validateCronRequest(request);

    if (authorized) {
      if (monitor && shouldStartSentryCronMonitor()) {
        checkInId = startCronCheckIn(monitor) || null;
      }
      const insertResult = await recordCronWrite(route, "insert", null, async () => {
        const supabase = await createSupabaseServiceRoleClient();
        const db = supabase as unknown as CronRunsTable;
        const [, result] = await Promise.all([
          sweepStaleStartedRows(db, route),
          db.from("cron_runs").insert({ route, job: route, status: "started" }).select("id").single(),
        ]);
        return result;
      });
      runId = insertResult?.data?.id ?? null;
    }

    try {
      const response = await handler(request);

      let summary: unknown = null;
      if (authorized || runId) {
        try {
          const cloned = response.clone();
          const text = await cloned.text();
          if (text && text.length <= 8192) summary = JSON.parse(text);
        } catch {
          summary = null;
        }
      }
      if (authorized && !response.ok) {
        captureCronFailure(
          route,
          new Error(extractErrorMessage(summary, response.status)),
          { source: "response", statusCode: response.status },
        );
      }

      if (checkInId && monitor) {
        await finishSentryCronCheckIn(
          checkInId,
          monitor.slug,
          response.ok ? "ok" : "error",
          Date.now() - start,
        );
      }

      if (runId) {
        await recordCronWrite(route, "update", runId, async () => {
          const supabase = await createSupabaseServiceRoleClient();
          const db = supabase as unknown as CronRunsTable;
          return db
            .from("cron_runs")
            .update({
              status: response.ok ? "ok" : "error",
              finished_at: new Date().toISOString(),
              duration_ms: Date.now() - start,
              summary: summary as object | null,
              error_message: response.ok ? null : extractErrorMessage(summary, response.status),
            })
            .eq("id", runId);
        });
      }
      return response;
    } catch (err) {
      if (authorized) captureCronFailure(route, err, { source: "throw" });
      if (checkInId && monitor) {
        await finishSentryCronCheckIn(checkInId, monitor.slug, "error", Date.now() - start);
      }

      if (runId) {
        await recordCronWrite(route, "update", runId, async () => {
          const supabase = await createSupabaseServiceRoleClient();
          const db = supabase as unknown as CronRunsTable;
          return db
            .from("cron_runs")
            .update({
              status: "error",
              finished_at: new Date().toISOString(),
              duration_ms: Date.now() - start,
              error_message: err instanceof Error ? err.message : String(err),
            })
            .eq("id", runId);
        });
      }
      throw err;
    }
  }) as H;
  return wrapped;
}

export async function withCronObservability<T>(
  route: string,
  handler: () => Promise<T>,
  options?: CronObservabilityOptions<T>,
): Promise<T> {
  const start = Date.now();
  let db: CronRunsTable | null = null;

  const insertResult = await recordCronWrite(route, "insert", null, async () => {
    db = await createSupabaseServiceRoleClient() as unknown as CronRunsTable;
    const [, result] = await Promise.all([
      sweepStaleStartedRows(db, route),
      db
        .from("cron_runs")
        .insert({ route, job: route, status: "started" })
        .select("id")
        .single(),
    ]);
    return result;
  });
  const runId = insertResult?.data?.id ?? null;

  try {
    const result = await handler();
    const status = options?.statusForResult(result) ?? "ok";
    if (status === "error") {
      captureCronFailure(
        route,
        options?.errorMessageForResult?.(result) ?? "Cron reported a degraded result",
        { source: "result" },
      );
    }
    if (runId) {
      await recordCronWrite(route, "update", runId, () => db!
        .from("cron_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          summary: result as object,
          error_message:
            status === "error"
              ? options?.errorMessageForResult?.(result) ?? "Cron reported a degraded result"
              : null,
        })
        .eq("id", runId));
    }
    return result;
  } catch (err) {
    captureCronFailure(route, err, { source: "throw" });
    if (runId) {
      await recordCronWrite(route, "update", runId, () => db!
        .from("cron_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - start,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", runId));
    }
    throw err;
  }
}
