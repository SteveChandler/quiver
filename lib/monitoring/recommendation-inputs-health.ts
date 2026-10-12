import { isSessionConditionsEnrichEnabled } from "@/lib/flags/session-conditions-enrich";
import {
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_MAX_STALENESS_MS,
} from "@/lib/services/county-beach-advisories/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { HealthStatus } from "./forecast-monitoring-config";

/**
 * Inputs a surfer's picks depend on, judged from the data rather than from any
 * one cron's run status. On 2026-10-02 the County feed went stale and every
 * pick was withheld for hours while each cron reported itself healthy.
 */
export interface RecommendationInputsReads {
  /** fetched_at of the latest completed County advisory run, or null. */
  latestCountyRunAt(): Promise<string | null>;
  /** The latest finished Week Scout canary run, or null. */
  latestCanaryRun(): Promise<{ startedAt: string; status: string } | null>;
  /** Logged sessions still without conditions 3–48 h after paddle-out. */
  sessionsAwaitingConditions(now: Date): Promise<number>;
}

interface RecommendationInputsHealth {
  status: HealthStatus;
  issues: string[];
  countyAgeMinutes: number | null;
  canary: { ageMinutes: number; status: string } | null;
  sessionsAwaitingConditions: number | null;
}

/** The County feed polls every 30 minutes; past an hour it has missed runs. */
const COUNTY_DEGRADED_MINUTES = 60;
const COUNTY_CRITICAL_MINUTES = COUNTY_MAX_STALENESS_MS / 60_000;
/** The canary runs every 30 minutes. */
const CANARY_MAX_SILENCE_MINUTES = 70;

const RANK: Record<HealthStatus, number> = { healthy: 0, degraded: 1, critical: 2 };

function worse(current: HealthStatus, next: HealthStatus): HealthStatus {
  return RANK[next] > RANK[current] ? next : current;
}

function ageMinutes(iso: string, now: Date): number {
  return Math.round((now.getTime() - Date.parse(iso)) / 60_000);
}

export async function checkRecommendationInputsHealth(
  reads: RecommendationInputsReads = supabaseRecommendationInputsReads(),
  now: Date = new Date(),
): Promise<RecommendationInputsHealth> {
  let status: HealthStatus = "healthy";
  const issues: string[] = [];
  const result: RecommendationInputsHealth = {
    status,
    issues,
    countyAgeMinutes: null,
    canary: null,
    sessionsAwaitingConditions: null,
  };

  try {
    const fetchedAt = await reads.latestCountyRunAt();
    const age = fetchedAt ? ageMinutes(fetchedAt, now) : null;
    result.countyAgeMinutes = age;
    if (age === null || age > COUNTY_CRITICAL_MINUTES) {
      status = worse(status, "critical");
      issues.push(age === null
        ? "No completed County water-quality run; San Diego County picks are withheld"
        : `County water-quality data is ${age} min old; San Diego County picks are withheld past ${COUNTY_CRITICAL_MINUTES} min`);
    } else if (age > COUNTY_DEGRADED_MINUTES) {
      status = worse(status, "degraded");
      issues.push(`County water-quality data is ${age} min old`);
    }
  } catch {
    status = worse(status, "degraded");
    issues.push("County water-quality freshness could not be read");
  }

  try {
    const canary = await reads.latestCanaryRun();
    if (!canary) {
      status = worse(status, "degraded");
      issues.push("The Week Scout canary has no finished run");
    } else {
      const age = ageMinutes(canary.startedAt, now);
      result.canary = { ageMinutes: age, status: canary.status };
      if (canary.status !== "ok") {
        status = worse(status, "critical");
        issues.push("The Week Scout canary failed its latest run");
      } else if (age > CANARY_MAX_SILENCE_MINUTES) {
        status = worse(status, "degraded");
        issues.push(`The Week Scout canary has not run for ${age} min`);
      }
    }
  } catch {
    status = worse(status, "degraded");
    issues.push("The Week Scout canary status could not be read");
  }

  try {
    const waiting = await reads.sessionsAwaitingConditions(now);
    result.sessionsAwaitingConditions = waiting;
    if (waiting > 0) {
      status = worse(status, "degraded");
      issues.push(`${waiting} logged session${waiting === 1 ? " is" : "s are"} still waiting for conditions 3 h after paddle-out`);
    }
  } catch {
    status = worse(status, "degraded");
    issues.push("Session conditions backlog could not be read");
  }

  result.status = status;
  return result;
}

function supabaseRecommendationInputsReads(): RecommendationInputsReads {
  const db = createSupabaseServiceRoleClient();
  return {
    async latestCountyRunAt() {
      const { data, error } = await db
        .from("county_beach_advisory_runs")
        .select("fetched_at")
        .eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .eq("status", "completed")
        .order("fetched_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as { fetched_at?: string } | undefined)?.fetched_at ?? null;
    },
    async latestCanaryRun() {
      const { data, error } = await db
        .from("cron_runs")
        .select("started_at, status")
        .eq("route", "/api/cron/week-scout-canary")
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0] as { started_at: string; status: string } | undefined;
      return row ? { startedAt: row.started_at, status: row.status } : null;
    },
    async sessionsAwaitingConditions(now: Date) {
      if (!isSessionConditionsEnrichEnabled()) return 0;
      const { count, error } = await db
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .is("conditions_source", null)
        .gte("arrival_time", new Date(now.getTime() - 48 * 3_600_000).toISOString())
        .lte("arrival_time", new Date(now.getTime() - 3 * 3_600_000).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  };
}
