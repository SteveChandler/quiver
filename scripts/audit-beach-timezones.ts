/**
 * Beach timezone audit (read-only).
 *
 * Re-derives every beach's timezone from its stored lat/lon and reports rows
 * where the persisted `beaches.timezone` disagrees.
 *
 * WHY NOT `getTimezoneFromCoords`
 *
 * `lib/utils/timezone-utils.server.ts` imports `geo-tz/now`, a dataset variant
 * that merges IANA zones which currently share an offset. That is fine for
 * runtime local-time math but wrong for persisted identity: on 2026-08-20 it
 * returned 'America/Caracas' for all 19 Puerto Rico beaches and
 * 'America/Los_Angeles' for all 8 Baja California beaches. This audit uses the
 * full `geo-tz` dataset so it compares canonical zone names.
 *
 * Two severities, because not every disagreement is a user-visible bug:
 *   MISMATCH  the two zones report different local times within the sample
 *             window -- a real defect (e.g. a Texas beach on Pacific time).
 *   ALIAS     the names differ but local time is identical across the window
 *             (e.g. America/Los_Angeles vs America/Tijuana). Cosmetic today,
 *             but it silently becomes a MISMATCH if either zone's rules change.
 *
 * Usage:
 *   yarn tsx scripts/audit-beach-timezones.ts
 *   yarn tsx scripts/audit-beach-timezones.ts --fail-on-mismatch   # for CI
 *
 * Read-only. Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { find } from "geo-tz";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env") });
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
loadEnv({
  path: path.resolve(process.cwd(), ".env.production.local"),
  override: true,
});

/** Days of local-time samples used to separate a real mismatch from an alias. */
const SAMPLE_DAYS = 400;
const SAMPLE_STEP_MS = 60 * 60 * 1000;
const PAGE_SIZE = 500;

type BeachRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number;
  lon: number;
  timezone: string;
};

type Severity = "MISMATCH" | "ALIAS";

type Finding = {
  severity: Severity;
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  stored: string;
  derived: string;
  maxDeltaMinutes: number;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running this audit`);
  return value;
}

function createSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchBeaches(supabase: SupabaseClient): Promise<BeachRow[]> {
  const rows: BeachRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("beaches")
      .select("id,name,slug,city,state,country,lat,lon,timezone")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to read beaches: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as BeachRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetMinutesAt(timezone: string, instant: Date): number {
  let formatter = offsetFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    });
    offsetFormatters.set(timezone, formatter);
  }

  const part = formatter
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  if (!part) throw new Error(`Cannot read offset for ${timezone}`);

  // "GMT-08:00", "GMT+05:30", or plain "GMT" at exactly UTC.
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Largest local-time difference between two zones over the sample window, in
 * minutes. Zero means the two names are interchangeable for every computation
 * Quiver performs today.
 *
 * Sampled hourly rather than daily: two zones can share a DST transition date
 * but shift at different local times, so the divergence window can be only a
 * couple of hours wide. A coarse step would score that pair as an ALIAS.
 */
function maxOffsetDeltaMinutes(a: string, b: string): number {
  const start = Date.now();
  const end = start + SAMPLE_DAYS * 24 * 60 * 60 * 1000;
  let max = 0;

  for (let t = start; t <= end; t += SAMPLE_STEP_MS) {
    const instant = new Date(t);
    const delta = Math.abs(
      offsetMinutesAt(a, instant) - offsetMinutesAt(b, instant)
    );
    if (delta > max) max = delta;
  }
  return max;
}

function describeLocation(beach: BeachRow): string {
  return [beach.city, beach.state, beach.country].filter(Boolean).join(", ");
}

function auditBeaches(beaches: BeachRow[]): Finding[] {
  const findings: Finding[] = [];

  for (const beach of beaches) {
    // geo-tz covers open ocean with Etc/GMT zones, so this always resolves.
    const derived = find(beach.lat, beach.lon)[0];
    if (!derived || derived === beach.timezone) continue;

    const maxDeltaMinutes = maxOffsetDeltaMinutes(beach.timezone, derived);

    findings.push({
      severity: maxDeltaMinutes === 0 ? "ALIAS" : "MISMATCH",
      id: beach.id,
      name: beach.name,
      location: describeLocation(beach),
      lat: beach.lat,
      lon: beach.lon,
      stored: beach.timezone,
      derived,
      maxDeltaMinutes,
    });
  }

  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "MISMATCH" ? -1 : 1;
    return b.maxDeltaMinutes - a.maxDeltaMinutes;
  });

  return findings;
}

function formatReport(findings: Finding[], total: number): string {
  const mismatches = findings.filter((f) => f.severity === "MISMATCH");
  const aliases = findings.filter((f) => f.severity === "ALIAS");

  const lines: string[] = [];
  lines.push(`Beach timezone audit -- ${total} beaches read`);
  lines.push(
    `  MISMATCH: ${mismatches.length}   ALIAS: ${aliases.length}`
  );

  if (mismatches.length > 0) {
    lines.push("");
    lines.push("MISMATCH -- stored zone reports a different local time:");
    for (const f of mismatches) {
      lines.push(
        `  ${f.id}  ${f.stored} -> ${f.derived}  (max ${f.maxDeltaMinutes}min)`
      );
      lines.push(
        `    ${f.name} -- ${f.location} -- ${f.lat.toFixed(5)},${f.lon.toFixed(5)}`
      );
    }
  }

  if (aliases.length > 0) {
    lines.push("");
    lines.push(
      "ALIAS -- different zone name, identical local time across the sample window:"
    );
    for (const f of aliases) {
      lines.push(
        `  ${f.id}  ${f.stored} ~ ${f.derived}  -- ${f.name} (${f.location})`
      );
    }
  }

  if (findings.length === 0) {
    lines.push("");
    lines.push("Every beach timezone matches its coordinates.");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const beaches = await fetchBeaches(createSupabase());
  const findings = auditBeaches(beaches);

  console.log(formatReport(findings, beaches.length));

  if (
    process.argv.includes("--fail-on-mismatch") &&
    findings.some((f) => f.severity === "MISMATCH")
  ) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
