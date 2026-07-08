#!/usr/bin/env tsx
/**
 * Read-only WaveCast-vs-Quiver calibration report.
 *
 * Loads the latest local WaveCast scraper snapshot, compares WaveCast daily
 * region calls against representative Quiver beaches, and prints source /
 * transform provenance from enhanced_forecasts.raw_forecast.
 *
 * Usage:
 *   npx tsx scripts/validate-wavecast-calibration.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const WAVECAST_SNAPSHOT_PATH = join(
  homedir(),
  "Library/Application Support/Quiver/surf-forecast-ingestion/data/latest.json",
);

const TARGETS = [
  {
    region: "socal",
    exposure: "south",
    beaches: [
      { id: "9841bdd0-e70f-4c10-bc54-135575006298", name: "Malibu First Point" },
      { id: "bec2d595-ed20-4c2b-93c7-4b880406332f", name: "Rincon" },
      { id: "193a3f9a-66d0-4362-bf55-d25bb831dae4", name: "Lower Trestles" },
      { id: "a956de46-b204-448e-a541-db427be7e85f", name: "Old Man's" },
      { id: "22536002-c7d2-48ab-a676-9b489fd79874", name: "Beacons" },
    ],
  },
  {
    region: "socal",
    exposure: "west",
    beaches: [
      { id: "486dc095-4b21-4edb-838c-97f68b40d1df", name: "C Street" },
      { id: "071db1df-b5ee-4af6-a022-ea8a09667cbe", name: "Huntington Beach" },
      { id: "cceecad1-7668-4ad8-88ff-ade893c605cd", name: "Oceanside Pier" },
    ],
  },
  {
    region: "hawaii",
    exposure: "SSW",
    beaches: [
      { id: "80fc2c1b-2d3f-4a94-bcc2-c8ea0e9b8fc5", name: "Ala Moana Bowls" },
      { id: "ae2e2eee-897c-4198-80fa-04b2d47128d7", name: "Waikiki Queens" },
    ],
  },
  {
    region: "hawaii",
    exposure: "NNW",
    beaches: [
      { id: "6a0674ac-3e6d-49f3-9fd4-a4f1857c408a", name: "Pipeline" },
      { id: "43cfaf0d-0376-45cb-a8bd-78087ba4ee15", name: "Haleiwa" },
    ],
  },
  {
    region: "new_england",
    exposure: "primary",
    beaches: [
      { id: "8160745c-6322-45b0-8bad-81319574008b", name: "Hampton Beach" },
      { id: "9eeb258d-2fb7-4e72-a6a4-4451882dedb6", name: "Nauset Beach" },
    ],
  },
  {
    region: "new_york",
    exposure: "primary",
    beaches: [
      { id: "7e7b38b1-767f-4213-9314-538f51ab5084", name: "Rockaway 90th" },
      { id: "632e0e1c-a256-4d1f-8c6a-c1cbbc6ff2b6", name: "Ditch Plains" },
    ],
  },
  {
    region: "new_jersey",
    exposure: "primary",
    beaches: [
      { id: "fb4fa0e0-328c-442b-b17a-82f95fbb6af5", name: "Manasquan" },
      { id: "fb0ee60f-a269-47ed-b244-e8dc64fff891", name: "Belmar" },
    ],
  },
  {
    region: "north_carolina",
    exposure: "primary",
    beaches: [
      { id: "4b88f10a-c794-4144-b17a-133af9fee9f9", name: "Wrightsville Beach" },
      { id: "d264fbf8-0525-4d31-adb5-9a0742eaeb7e", name: "Cape Hatteras" },
    ],
  },
  {
    region: "florida_east_coast",
    exposure: "primary",
    beaches: [
      { id: "99e50d6b-a1cf-458b-8fff-c199cd55b23c", name: "Cocoa Beach Pier" },
      { id: "d0f77b47-ec94-4188-8dde-d52a10b7be49", name: "Sebastian Inlet" },
    ],
  },
  {
    region: "norcal",
    exposure: "NNW",
    beaches: [
      { id: "f2cc331f-6569-40d9-a98b-9f50fb3da67f", name: "Linda Mar" },
      { id: "033b5518-ee98-4014-9d81-114b936778af", name: "Mavericks" },
    ],
  },
  {
    region: "central_california",
    exposure: "NNW",
    beaches: [
      { id: "2609a9ff-d247-4e0b-888f-a793ff7177a5", name: "Steamer Lane" },
      { id: "ee2aad76-966d-4aa3-86a2-499fde59b271", name: "Pismo Pier" },
    ],
  },
  {
    region: "baja",
    exposure: "NNW",
    beaches: [
      { id: "f0ddfc6a-7392-40c5-9211-836c05e449f1", name: "Rosarito" },
      { id: "77d286c5-87e9-4678-82d3-81d0125285fa", name: "K-38" },
    ],
  },
] as const;

interface WaveCastSnapshot {
  ingested_at?: string;
  wavecast_regions?: Array<{
    source: string;
    region: string;
    report_timestamp?: string | null;
    daily_forecast_lines?: string[];
  }>;
  normalized_wavecast_daily_rows?: WaveCastRow[];
  summary?: {
    wavecast_regions?: number;
    normalized_rows?: number;
    failed_sources?: unknown;
    latest_updated?: string | null;
  };
}

interface WaveCastRow {
  source: string;
  region: string;
  date_text: string;
  exposure: string;
  direction_deg: string;
  surf_height_text: string;
  period_sec: string;
  narrative: string;
}

interface BeachRow {
  id: string;
  name: string;
  slug: string | null;
  cdip_station: string | null;
  terrain_enabled: boolean | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
  deepwater_decay_factor: number | null;
  shoaling_factors: unknown | null;
  height_offset_enabled: boolean | null;
  height_offset_min_sample_count: number | null;
  height_offset_max_age_days: number | null;
}

interface ForecastRow {
  beach_id: string;
  forecast_at: string;
  wave_height: string | null;
  data_source: string | null;
  raw_forecast: {
    wave_height_provenance?: {
      source?: string | null;
      station_id?: string | null;
      raw_value_ft?: number | null;
      transform_path?: string | null;
      components_used?: boolean | null;
      calibrated_shoaling_fired?: boolean | null;
      handoff_discontinuity_ft?: number | null;
      handoff_blend?: unknown;
      cdip_rejection?: unknown;
    };
  } | null;
}

interface HeightOffsetRow {
  beach_id: string;
  offset_m: number | null;
  sample_count: number | null;
  computed_at: string | null;
  mae_before_m: number | null;
  mae_after_m: number | null;
}

interface ParsedHeight {
  minFt: number;
  maxFt: number;
}

interface DayWindow {
  startIso: string;
  endIso: string;
  label: string;
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function parseWaveCastReportDate(reportTimestamp: string | null | undefined): Date | null {
  const match = reportTimestamp?.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (!match) return null;

  const monthIndex = Number(match[1]) - 1;
  const day = Number(match[2]);
  const rawYear = match[3];
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  const parsed = new Date(year, monthIndex, day);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function snapshotReferenceDate(snapshot: WaveCastSnapshot): Date {
  const parsed = new Date(snapshot.ingested_at ?? Date.now());
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function buildSocalNarrativeDateText(
  weekday: string,
  dayOfMonthText: string,
  snapshot: WaveCastSnapshot,
  reportTimestamp: string | null | undefined,
): string | null {
  const dayOfMonth = Number(dayOfMonthText);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;

  const reference = parseWaveCastReportDate(reportTimestamp) ?? snapshotReferenceDate(snapshot);
  const candidateMonths = [-1, 0, 1].map(
    (offset) => new Date(reference.getFullYear(), reference.getMonth() + offset, dayOfMonth),
  );
  const matchingWeekday = candidateMonths
    .filter((candidate) => candidate.getDate() === dayOfMonth)
    .filter(
      (candidate) =>
        candidate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() ===
        weekday.toLowerCase(),
    )
    .sort(
      (a, b) =>
        Math.abs(a.getTime() - reference.getTime()) -
        Math.abs(b.getTime() - reference.getTime()),
    );
  const selected =
    matchingWeekday[0] ??
    candidateMonths.find((candidate) => candidate.getDate() === dayOfMonth);
  if (!selected) return null;

  const monthName = MONTH_NAMES[selected.getMonth()];
  return `${weekday} ${monthName} ${dayOfMonth} ${selected.getFullYear()}`;
}

function parseWaveCastDate(dateText: string, referenceYear: number): DayWindow | null {
  const normalized = dateText.replace(/,/g, "").trim();
  const parts = normalized.split(/\s+/);
  const maybeYear = parts.at(-1);
  const hasExplicitYear = Boolean(maybeYear?.match(/^\d{4}$/));
  const month = hasExplicitYear ? parts.at(-3) : parts.at(-2);
  const day = hasExplicitYear ? parts.at(-2) : parts.at(-1);
  const year = hasExplicitYear ? Number(maybeYear) : referenceYear;
  if (!month || !day) return null;

  const parsed = new Date(`${month} ${day}, ${year} 00:00:00 GMT-0700`);
  if (!Number.isFinite(parsed.getTime())) return null;

  const start = parsed;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: `${month} ${day}`,
  };
}

function parseHeight(text: string): ParsedHeight | null {
  if (!text.trim()) return null;
  const numbers = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  if (numbers.length === 0) return null;
  const minFt = numbers[0];
  const maxFt = numbers[1] ?? minFt;
  if (!Number.isFinite(minFt) || !Number.isFinite(maxFt)) return null;
  return { minFt, maxFt };
}

function parseDisplayFt(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatFt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}ft`;
}

function formatBool(value: boolean | null | undefined): string {
  return value ? "yes" : "no";
}

function formatCount(value: unknown): string {
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "0";
}

function rowKey(row: WaveCastRow): string {
  return `${row.region}:${row.exposure}:${row.date_text}`;
}

function selectWaveCastRows(snapshot: WaveCastSnapshot): WaveCastRow[] {
  const seen = new Set<string>();
  const rows: WaveCastRow[] = [];
  for (const row of snapshot.normalized_wavecast_daily_rows ?? []) {
    if (row.source !== "wavecast") continue;
    if (!row.surf_height_text.trim()) continue;
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  for (const row of parseSocalNarrativeRows(snapshot)) {
    const key = rowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

function parseSocalNarrativeRows(snapshot: WaveCastSnapshot): WaveCastRow[] {
  const socal = snapshot.wavecast_regions?.find((region) => region.region === "socal");
  if (!socal?.daily_forecast_lines) return [];

  const rows: WaveCastRow[] = [];
  for (const line of socal.daily_forecast_lines) {
    if (!/\b(?:south|west) facing\b/i.test(line)) continue;
    const dateMatch = line.match(/\b([A-Z][a-z]+day) the (\d{1,2})(?:st|nd|rd|th)?\b/);
    if (!dateMatch) continue;
    const dateText = buildSocalNarrativeDateText(
      dateMatch[1],
      dateMatch[2],
      snapshot,
      socal.report_timestamp,
    );
    if (!dateText) continue;

    for (const exposure of ["south", "west"] as const) {
      const segment = segmentForExposure(line, exposure);
      if (!segment) continue;
      const surfHeightText = qualitativeHeightToFeet(segment);
      if (!surfHeightText) continue;
      rows.push({
        source: "wavecast",
        region: "socal",
        date_text: dateText,
        exposure,
        direction_deg: "",
        surf_height_text: surfHeightText,
        period_sec: "",
        narrative: line,
      });
    }
  }
  return rows;
}

function segmentForExposure(line: string, exposure: "south" | "west"): string | null {
  const lower = line.toLowerCase();
  const marker = `${exposure} facing`;
  const start = lower.indexOf(marker);
  if (start === -1) return null;
  const otherMarker = exposure === "south" ? "west facing" : "south facing";
  const nextOther = lower.indexOf(otherMarker, start + marker.length);
  if (exposure === "south") {
    return line.slice(0, nextOther === -1 ? undefined : nextOther);
  }
  return line.slice(start);
}

function qualitativeHeightToFeet(segment: string): string | null {
  const lower = segment.toLowerCase();
  if (/couple feet overhead|couple of feet overhead/.test(lower)) return "8 to 10 ft";
  if (/overhead/.test(lower)) return "6 to 8 ft";
  if (/head high/.test(lower) && /chest\+|chest high plus|chest\shigh plus/.test(lower)) {
    return "4 to 6 ft";
  }
  if (/head high plus|head high\+/.test(lower)) return "5 to 7 ft";
  if (/head high/.test(lower)) return "5 to 6 ft";
  if (/chest\+|chest high plus|chest\shigh plus/.test(lower)) return "4 to 5 ft";
  if (/waist to (?:at times )?chest|waist[- ]?to[- ]?chest/.test(lower)) return "2 to 4 ft";
  if (/waist max/.test(lower)) return "2 ft";
  if (/waist high/.test(lower)) return "2 to 3 ft";
  if (/chest high|chest at|chest$/.test(lower)) return "3 to 4 ft";
  return null;
}

function summarizeForecasts(rows: ForecastRow[]): {
  count: number;
  minFt: number | null;
  maxFt: number | null;
  firstFt: number | null;
  maxJumpFt: number | null;
  sources: string[];
  transformPaths: string[];
  calibratedRows: number;
  handoffRows: number;
  sampleProvenance: string;
} {
  const values = rows
    .map((row) => parseDisplayFt(row.wave_height))
    .filter((value): value is number => value != null);
  const jumps = values.slice(1).map((value, index) => Math.abs(value - values[index]));
  const provenances = rows.map((row) => row.raw_forecast?.wave_height_provenance);
  const sources = [
    ...new Set(provenances.map((provenance) => provenance?.source).filter(Boolean) as string[]),
  ];
  const transformPaths = [
    ...new Set(
      provenances.map((provenance) => provenance?.transform_path).filter(Boolean) as string[],
    ),
  ];
  const first = provenances.find(Boolean);

  return {
    count: rows.length,
    minFt: values.length > 0 ? Math.min(...values) : null,
    maxFt: values.length > 0 ? Math.max(...values) : null,
    firstFt: values[0] ?? null,
    maxJumpFt: jumps.length > 0 ? Math.max(...jumps) : null,
    sources,
    transformPaths,
    calibratedRows: provenances.filter(
      (provenance) => provenance?.calibrated_shoaling_fired === true,
    ).length,
    handoffRows: provenances.filter(
      (provenance) =>
        typeof provenance?.handoff_discontinuity_ft === "number" || provenance?.handoff_blend,
    ).length,
    sampleProvenance: first
      ? [
          first.source ?? "-",
          first.transform_path ?? "-",
          first.station_id ? `station ${first.station_id}` : null,
          typeof first.raw_value_ft === "number" ? `raw ${first.raw_value_ft.toFixed(1)}ft` : null,
        ]
          .filter(Boolean)
          .join(" / ")
      : "-",
  };
}

function classifyGap(expected: ParsedHeight, quiverMaxFt: number | null, maxJumpFt: number | null): string {
  if (quiverMaxFt == null) return "missing";
  const underGap = expected.minFt - quiverMaxFt;
  const overGap = quiverMaxFt - expected.maxFt;
  if (maxJumpFt != null && maxJumpFt >= 3) return "jumpy";
  if (underGap >= 1) return `under ${underGap.toFixed(1)}ft`;
  if (overGap >= 1.5) return `over ${overGap.toFixed(1)}ft`;
  return "aligned";
}

async function main(): Promise<void> {
  if (!existsSync(WAVECAST_SNAPSHOT_PATH)) {
    throw new Error(`WaveCast snapshot not found at ${WAVECAST_SNAPSHOT_PATH}`);
  }

  const snapshot = JSON.parse(readFileSync(WAVECAST_SNAPSHOT_PATH, "utf8")) as WaveCastSnapshot;
  const wavecastRows = selectWaveCastRows(snapshot);
  const referenceYear = new Date(snapshot.ingested_at ?? Date.now()).getFullYear();
  const beachIds = [...new Set(TARGETS.flatMap((target) => target.beaches.map((beach) => beach.id)))];

  const { data: beachRows, error: beachError } = await supabase
    .from("beaches")
    .select(
      "id,name,slug,cdip_station,terrain_enabled,swell_window_center_deg,swell_window_halfwidth_deg,deepwater_decay_factor,shoaling_factors,height_offset_enabled,height_offset_min_sample_count,height_offset_max_age_days",
    )
    .in("id", beachIds);
  if (beachError) throw beachError;

  const { data: offsetRows, error: offsetError } = await supabase
    .from("beach_height_offsets")
    .select("beach_id,offset_m,sample_count,computed_at,mae_before_m,mae_after_m")
    .in("beach_id", beachIds);
  if (offsetError && offsetError.code !== "42P01") throw offsetError;

  const beaches = new Map((beachRows as BeachRow[] | null)?.map((row) => [row.id, row]) ?? []);
  const offsets = new Map(
    ((offsetRows as HeightOffsetRow[] | null) ?? []).map((row) => [row.beach_id, row]),
  );

  console.log("# WaveCast Calibration Report");
  console.log(`snapshot: ${WAVECAST_SNAPSHOT_PATH}`);
  console.log(`ingested_at: ${snapshot.ingested_at ?? "-"}`);
  console.log(
    `summary: ${snapshot.summary?.wavecast_regions ?? "-"} WaveCast regions, ${snapshot.summary?.normalized_rows ?? wavecastRows.length} normalized rows, ${formatCount(snapshot.summary?.failed_sources)} failed sources`,
  );
  console.log("");

  for (const target of TARGETS) {
    const matchingRows = wavecastRows.filter(
      (row) => row.region === target.region && row.exposure === target.exposure,
    );
    if (matchingRows.length === 0) continue;

    console.log(`## ${target.region} ${target.exposure}`);
    for (const wavecastRow of matchingRows.slice(0, 5)) {
      const expected = parseHeight(wavecastRow.surf_height_text);
      const dayWindow = parseWaveCastDate(wavecastRow.date_text, referenceYear);
      if (!expected || !dayWindow) continue;

      console.log(
        `\n${dayWindow.label}: WaveCast ${wavecastRow.surf_height_text} @ ${wavecastRow.period_sec || "-"}s from ${wavecastRow.direction_deg || "-"}deg`,
      );

      const { data: forecastRows, error: forecastError } = await supabase
        .from("enhanced_forecasts")
        .select("beach_id,forecast_at,wave_height,data_source,raw_forecast")
        .in(
          "beach_id",
          target.beaches.map((beach) => beach.id),
        )
        .gte("forecast_at", dayWindow.startIso)
        .lt("forecast_at", dayWindow.endIso)
        .order("forecast_at", { ascending: true });
      if (forecastError) throw forecastError;

      for (const targetBeach of target.beaches) {
        const beach = beaches.get(targetBeach.id);
        const offset = offsets.get(targetBeach.id);
        const rows = ((forecastRows as ForecastRow[] | null) ?? []).filter(
          (row) => row.beach_id === targetBeach.id,
        );
        const summary = summarizeForecasts(rows);
        const status = classifyGap(expected, summary.maxFt, summary.maxJumpFt);

        console.log(
          [
            `- ${targetBeach.name}`,
            `q=${formatFt(summary.minFt)}-${formatFt(summary.maxFt)}`,
            `n=${summary.count}`,
            `status=${status}`,
            `jump=${formatFt(summary.maxJumpFt)}`,
            `source=${summary.sources.join("+") || "-"}`,
            `path=${summary.transformPaths.join("+") || "-"}`,
            `cal=${summary.calibratedRows}/${summary.count}`,
            `handoff=${summary.handoffRows}`,
            `terrain=${formatBool(beach?.terrain_enabled)}`,
            `decay=${beach?.deepwater_decay_factor ?? "-"}`,
            `shoal=${beach?.shoaling_factors ? "yes" : "no"}`,
            `offset=${beach?.height_offset_enabled ? `${offset?.offset_m ?? "none"}m` : "off"}`,
          ].join(" | "),
        );
        console.log(`  provenance: ${summary.sampleProvenance}`);
      }
    }
    console.log("");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
