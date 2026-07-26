import { syncCanonicalAndroidTesterRoster } from "@/lib/android-tester-roster/canonical-sync";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RosterMaintenanceClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{
    data: any;
    error: { message?: string } | null;
  }>;
}

interface MaintenanceOutcome {
  outcome: string;
  [key: string]: number | string;
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
    },
  });
}

function isEnabled(name: string): boolean {
  return process.env[name] === "true";
}

function safeCount(value: unknown): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : 0;
}

function summarizeSync(result: Record<string, unknown>): MaintenanceOutcome {
  if (result.busy === true) {
    return { outcome: "busy" };
  }
  if (result.complete !== true) {
    return { outcome: "incomplete" };
  }
  return {
    outcome: "complete",
    addedCount: safeCount(result.addedCount),
    rejoinedCount: safeCount(result.rejoinedCount),
    refreshedCount: safeCount(result.refreshedCount),
    leftCount: safeCount(result.leftCount),
    purgedCount: safeCount(result.purgedCount),
    canonicalSourceCount: safeCount(result.canonicalSourceCount),
  };
}

export async function GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return json({ ok: false, outcome: "unauthorized" }, 401);
  }
  if (!isEnabled("ANDROID_TESTER_ROSTER_CRON_ENABLED")) {
    return json({ ok: true, outcome: "disabled" });
  }

  const client =
    createSupabaseServiceRoleClient() as unknown as RosterMaintenanceClient;
  const now = new Date().toISOString();
  let purge: MaintenanceOutcome;
  let sync: MaintenanceOutcome;

  try {
    const result = await client.rpc(
      "purge_android_tester_roster_identities",
      {
        p_actor_user_id: null,
        p_now: now,
      },
    );
    purge =
      result.error === null && typeof result.data === "number"
        ? {
            outcome: "completed",
            purgedCount: safeCount(result.data),
          }
        : { outcome: "failed" };
  } catch {
    purge = { outcome: "failed" };
  }

  if (!isEnabled("ANDROID_TESTER_ROSTER_GOOGLE_SYNC_ENABLED")) {
    sync = { outcome: "disabled" };
  } else {
    try {
      const result = await syncCanonicalAndroidTesterRoster({
        actorUserId: null,
        supabase: client,
      });
      sync = summarizeSync(result);
    } catch {
      sync = { outcome: "failed" };
    }
  }

  const failed =
    purge.outcome === "failed" || sync.outcome === "failed";
  return json(
    {
      ok: !failed,
      outcome: failed ? "partial_failure" : "completed",
      purge,
      sync,
    },
    failed ? 503 : 200,
  );
}
