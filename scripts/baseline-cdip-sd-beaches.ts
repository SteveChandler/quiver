#!/usr/bin/env tsx
/**
 * Read-only baseline snapshot of CDIP-backed San Diego beaches.
 *
 * For each beach in the target set, captures:
 *   - beaches.cdip_station, features (incl. observation_anchor flag)
 *   - resolver-selected nowcast station (get_beach_observation_station)
 *   - latest CDIP observation: Hs, period, direction, station, observed_at
 *     (via unified_wave_observations for the beach's resolved station)
 *   - latest nowcast anchor (get_nowcast_anchors)
 *   - latest enhanced_forecasts row near now(): wave_height, data_source,
 *     forecast_at, swell_1/swell_2/wind_wave components
 *
 * Writes Markdown to scripts/output/baseline-<YYYY-MM-DD-HHmm>.md.
 * Writes nothing to the database. Safe to run repeatedly.
 *
 * Usage:
 *   npx tsx scripts/baseline-cdip-sd-beaches.ts
 *
 * Env: requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (Quiver's .env points at local Supabase).
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const TARGET_BEACHES: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "ocean-beach-pier", label: "Ocean Beach Pier" },
  { slug: "pacific-beach", label: "Pacific Beach" },
  { slug: "mission-beach", label: "Mission Beach" },
  { slug: "crystal-pier", label: "Crystal Pier" },
  { slug: "tourmaline-surf-park", label: "Tourmaline Surf Park" },
  { slug: "big-jetty", label: "Big Jetty" },
];

interface BeachRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  cdip_station: string | null;
  features: string[] | null;
  shoaling_factors: unknown | null;
  swell_window_min_deg: number | null;
  swell_window_max_deg: number | null;
}

interface NowcastAnchorRow {
  beach_id: string;
  station_id: string;
  observed_at: string;
  wave_height_m: number | string;
  wave_period_s: number | string | null;
  wave_direction_deg: number | string | null;
}

interface ForecastRow {
  forecast_at: string;
  data_source: string | null;
  wave_height: string | null;
  wave_period: string | null;
  wave_direction: string | null;
  swell_1_height: number | null;
  swell_1_period: number | null;
  swell_1_direction: string | null;
  swell_2_height: number | null;
  swell_2_period: number | null;
  swell_2_direction: string | null;
  wind_wave_height: number | null;
  wind_wave_period: number | null;
  wind_wave_direction: string | null;
}

interface ObservationRow {
  station_id: string;
  observed_at: string;
  wave_height_m: number | string | null;
  wave_period_s: number | string | null;
  wave_direction_deg: number | string | null;
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function fmtNum(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function ageMinutes(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return `${Math.round((now - t) / 60000)} min`;
}

async function snapshotBeach(beach: BeachRow): Promise<string[]> {
  const lines: string[] = [];
  lines.push(`### ${beach.name} (\`${beach.slug}\`)`);
  lines.push("");
  lines.push(`- **id**: \`${beach.id}\``);
  lines.push(`- **city/state**: ${beach.city ?? "—"}, ${beach.state ?? "—"}`);
  lines.push(`- **cdip_station**: \`${beach.cdip_station ?? "null"}\``);
  lines.push(`- **features**: \`${JSON.stringify(beach.features ?? [])}\``);
  lines.push(`- **observation_anchor enabled**: ${(beach.features ?? []).includes("observation_anchor") ? "**YES**" : "no"}`);
  lines.push(`- **swell_window**: ${beach.swell_window_min_deg ?? "—"}° → ${beach.swell_window_max_deg ?? "—"}°`);
  lines.push(`- **shoaling_factors set**: ${beach.shoaling_factors ? "**yes**" : "no"}`);
  lines.push("");

  const { data: stationRow, error: stationErr } = await supabase.rpc(
    "get_beach_observation_station",
    { p_beach_id: beach.id },
  );
  const resolverStation =
    stationErr ? `error: ${stationErr.message}` : (stationRow as string | null) ?? "null (no match)";
  lines.push(`- **resolver-selected nowcast station**: \`${resolverStation}\``);
  lines.push("");

  const { data: anchorRows, error: anchorErr } = await supabase.rpc("get_nowcast_anchors", {
    max_age_hours: 12.0,
  });
  if (anchorErr) {
    lines.push(`- **nowcast anchor RPC error**: ${anchorErr.message}`);
  } else {
    const anchor = (anchorRows as NowcastAnchorRow[] | null)?.find((r) => r.beach_id === beach.id);
    if (!anchor) {
      lines.push(`- **nowcast anchor**: none (no recent observation within 12h)`);
    } else {
      lines.push(`- **nowcast anchor**: station \`${anchor.station_id}\``);
      lines.push(`  - observed_at: ${anchor.observed_at} (${ageMinutes(anchor.observed_at)} ago)`);
      lines.push(
        `  - Hs: ${fmtNum(anchor.wave_height_m)} m | period: ${fmtNum(anchor.wave_period_s, 1)} s | dir: ${fmtNum(anchor.wave_direction_deg, 0)}°`,
      );
    }
  }
  lines.push("");

  if (typeof resolverStation === "string" && resolverStation.length > 0 && !resolverStation.startsWith("error")) {
    const { data: obsRows, error: obsErr } = await supabase
      .from("unified_wave_observations")
      .select("station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg")
      .eq("station_id", resolverStation)
      .order("observed_at", { ascending: false })
      .limit(1);
    if (obsErr) {
      lines.push(`- **latest observation (resolver station)**: error ${obsErr.message}`);
    } else {
      const o = (obsRows as ObservationRow[] | null)?.[0];
      if (!o) {
        lines.push(`- **latest observation (resolver station \`${resolverStation}\`)**: none`);
      } else {
        lines.push(
          `- **latest observation (resolver station \`${resolverStation}\`)**: ${o.observed_at} (${ageMinutes(o.observed_at)} ago) — Hs ${fmtNum(o.wave_height_m)} m, T ${fmtNum(o.wave_period_s, 1)} s, dir ${fmtNum(o.wave_direction_deg, 0)}°`,
        );
      }
    }
  }
  lines.push("");

  if (beach.cdip_station) {
    const cdipIoosId = `edu_ucsd_cdip_${beach.cdip_station}`;
    const { data: cdipRows } = await supabase
      .from("unified_wave_observations")
      .select("station_id, observed_at, wave_height_m, wave_period_s, wave_direction_deg")
      .eq("station_id", cdipIoosId)
      .order("observed_at", { ascending: false })
      .limit(1);
    const c = (cdipRows as ObservationRow[] | null)?.[0];
    if (!c) {
      lines.push(`- **latest CDIP obs (\`${cdipIoosId}\`, beach.cdip_station)**: none in unified_wave_observations`);
    } else {
      lines.push(
        `- **latest CDIP obs (\`${cdipIoosId}\`, beach.cdip_station)**: ${c.observed_at} (${ageMinutes(c.observed_at)} ago) — Hs ${fmtNum(c.wave_height_m)} m, T ${fmtNum(c.wave_period_s, 1)} s, dir ${fmtNum(c.wave_direction_deg, 0)}°`,
      );
    }
  }
  lines.push("");

  const windowStart = new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString();
  const { data: forecastRows } = await supabase
    .from("enhanced_forecasts")
    .select(
      "forecast_at, data_source, wave_height, wave_period, wave_direction, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction",
    )
    .eq("beach_id", beach.id)
    .gte("forecast_at", windowStart)
    .lte("forecast_at", windowEnd)
    .order("forecast_at", { ascending: true });

  const nearest = (forecastRows as ForecastRow[] | null)?.reduce<ForecastRow | null>(
    (best, row) => {
      const diff = Math.abs(Date.parse(row.forecast_at) - Date.now());
      const bestDiff = best ? Math.abs(Date.parse(best.forecast_at) - Date.now()) : Infinity;
      return diff < bestDiff ? row : best;
    },
    null,
  );

  if (!nearest) {
    lines.push(`- **enhanced_forecasts (±1.5h of now)**: no row`);
  } else {
    lines.push(`- **enhanced_forecasts row at ${nearest.forecast_at}**:`);
    lines.push(`  - data_source: \`${nearest.data_source ?? "null"}\``);
    lines.push(`  - **wave_height**: \`${nearest.wave_height ?? "null"}\` (period \`${nearest.wave_period ?? "null"}\`, dir \`${nearest.wave_direction ?? "null"}\`)`);
    lines.push(
      `  - swell_1: ${fmtNum(nearest.swell_1_height)} m @ ${fmtNum(nearest.swell_1_period, 1)} s, ${nearest.swell_1_direction ?? "—"}`,
    );
    lines.push(
      `  - swell_2: ${fmtNum(nearest.swell_2_height)} m @ ${fmtNum(nearest.swell_2_period, 1)} s, ${nearest.swell_2_direction ?? "—"}`,
    );
    lines.push(
      `  - wind_wave: ${fmtNum(nearest.wind_wave_height)} m @ ${fmtNum(nearest.wind_wave_period, 1)} s, ${nearest.wind_wave_direction ?? "—"}`,
    );
  }
  lines.push("");

  return lines;
}

async function main() {
  const slugs = TARGET_BEACHES.map((b) => b.slug);
  const { data: beaches, error } = await supabase
    .from("beaches")
    .select("id, name, slug, city, state, cdip_station, features, shoaling_factors, swell_window_min_deg, swell_window_max_deg")
    .in("slug", slugs);
  if (error) throw new Error(`beaches lookup failed: ${error.message}`);
  if (!beaches?.length) throw new Error("No target beaches matched");

  const bySlug = new Map<string, BeachRow>();
  for (const b of beaches as BeachRow[]) bySlug.set(b.slug, b);

  const out: string[] = [];
  const now = new Date();
  out.push(`# CDIP SD Beach Baseline — ${now.toISOString()}`);
  out.push("");
  out.push(`Captured pre-fix state. Read-only.`);
  out.push("");

  for (const target of TARGET_BEACHES) {
    const beach = bySlug.get(target.slug);
    if (!beach) {
      out.push(`### ${target.label} (\`${target.slug}\`)`);
      out.push("");
      out.push(`- **NOT FOUND in beaches table**`);
      out.push("");
      continue;
    }
    const lines = await snapshotBeach(beach);
    out.push(...lines);
  }

  const outDir = join(process.cwd(), "scripts", "output");
  mkdirSync(outDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const file = join(outDir, `baseline-${stamp}.md`);
  writeFileSync(file, out.join("\n"));
  console.log(`Wrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
