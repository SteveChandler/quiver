import { readFile, writeFile } from "node:fs/promises";
import { computeMllwOffsetM, predictModelTideExtremes, type BeachModelTides } from "../../lib/services/tides/model-tides";
import type { RawExtraction } from "./build-fes2022-constants";
import surfline from "./surfline-reference-20260929.json";

type Turn = { ts: string; type: "high" | "low"; tide_height_m: number };
type Match = { model: Turn; reference: Turn; dtMinutes: number; dhCm: number };
type SurflineSpot = { slug: string; lat?: number; lon?: number; turns: ["L" | "H", string, number][] };

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function modelFor(id: string, point: RawExtraction["points"][string]): BeachModelTides {
  return { beachId: id, model: "FES2022", constituents: point.constituents, mllwOffsetM: computeMllwOffsetM(point.constituents) };
}

export function matchTurns(model: Turn[], reference: Turn[]): Match[] {
  const available = new Set(model.map((_, index) => index));
  const matches: Match[] = [];
  for (const turn of reference) {
    let best: number | undefined;
    let bestMinutes = Infinity;
    for (const index of available) {
      if (model[index].type !== turn.type) continue;
      const minutes = Math.abs(Date.parse(model[index].ts) - Date.parse(turn.ts)) / 60_000;
      if (minutes <= 180 && minutes < bestMinutes) { best = index; bestMinutes = minutes; }
    }
    if (best === undefined) continue;
    available.delete(best);
    matches.push({ model: model[best], reference: turn,
      dtMinutes: (Date.parse(model[best].ts) - Date.parse(turn.ts)) / 60_000,
      dhCm: (model[best].tide_height_m - turn.tide_height_m) * 100 });
  }
  return matches;
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function swing(turns: Turn[]): number {
  const highs = turns.filter((turn) => turn.type === "high").map((turn) => turn.tide_height_m);
  const lows = turns.filter((turn) => turn.type === "low").map((turn) => turn.tide_height_m);
  return highs.length && lows.length ? mean(highs) - mean(lows) : NaN;
}

export function metrics(matches: Match[], total: number): {
  matched: string; medianAbsDt: number; maxAbsDt: number; meanDt: number; rangeRatio: number; medianAbsDh: number; pass: boolean;
} {
  const delta = matches.map((match) => match.dtMinutes);
  const ratio = swing(matches.map((match) => match.model)) / swing(matches.map((match) => match.reference));
  const medianAbsDt = median(delta.map(Math.abs));
  return { matched: `${matches.length}/${total}`, medianAbsDt,
    maxAbsDt: delta.length ? Math.max(...delta.map(Math.abs)) : NaN,
    meanDt: mean(delta), rangeRatio: ratio,
    medianAbsDh: median(matches.map((match) => Math.abs(match.dhCm))),
    pass: matches.length > 0 && medianAbsDt <= 20 && ratio >= 0.85 && ratio <= 1.15 };
}

async function fetchNoaa(stationId: string, start: string, end: string): Promise<Turn[]> {
  const params = new URLSearchParams({ station: stationId, product: "predictions", interval: "hilo", datum: "MLLW",
    time_zone: "gmt", units: "metric", format: "json", begin_date: start.replaceAll("-", ""), end_date: end.replaceAll("-", "") });
  const response = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`);
  if (!response.ok) throw new Error(`NOAA ${stationId}: HTTP ${response.status}`);
  const body = await response.json() as { predictions?: { t: string; v: string; type: "H" | "L" }[]; error?: { message: string } };
  if (body.error || !body.predictions) throw new Error(`NOAA ${stationId}: ${body.error?.message ?? "no predictions"}`);
  if (!body.predictions.every((turn) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(turn.t) &&
    (turn.type === "H" || turn.type === "L") && Number.isFinite(Number(turn.v)))) {
    throw new Error(`NOAA ${stationId}: invalid prediction data`);
  }
  return body.predictions.map((turn) => ({ ts: `${turn.t.replace(" ", "T")}:00Z`,
    type: turn.type === "H" ? "high" : "low", tide_height_m: Number(turn.v) }));
}

function format(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "N/A";
}

async function validate(raw: RawExtraction, start: string, days: number): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(days) || days <= 0) throw new Error("--start must be YYYY-MM-DD and --days a positive integer");
  const startMs = Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(startMs)) throw new Error("Invalid --start date");
  const endMs = startMs + days * 86_400_000;
  const endDate = new Date(endMs - 86_400_000).toISOString().slice(0, 10);
  const lines = [`# FES2022 validation: ${start} (${days} days)`, "", "| NOAA station | Matched | Median abs dt min | Max abs dt min | Mean dt min | Range ratio | Median abs dh cm |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
  let passed = true;
  let references = 0;
  for (const [id, point] of Object.entries(raw.points)) {
    if (point.kind !== "reference") continue;
    references++;
    const stationId = point.stationId ?? id;
    const model = predictModelTideExtremes(modelFor(id, point), new Date(startMs).toISOString(), new Date(endMs).toISOString());
    const noaa = await fetchNoaa(stationId, start, endDate);
    const result = metrics(matchTurns(model, noaa), noaa.length);
    passed &&= result.pass;
    lines.push(`| ${stationId} | ${result.matched} | ${format(result.medianAbsDt)} | ${format(result.maxAbsDt)} | ${format(result.meanDt)} | ${format(result.rangeRatio, 3)} | ${format(result.medianAbsDh)} |`);
  }
  if (!references) passed = false;
  lines.push("", `**${passed ? "PASS" : "FAIL"}** — every NOAA station requires median |dt| ≤ 20 min and range ratio 0.85–1.15.`, "");
  if (start === "2026-09-29") {
    lines.push("## Surfline local turns (UTC−7, 2026-09-29)", "", "| Spot | Coordinates | Surfline turns (L/H time height ft) | Model minus Surfline dt (min, matched turns) |", "| --- | --- | --- | --- |");
    for (const spot of surfline.spots as SurflineSpot[]) {
      const entry = Object.entries(raw.points).find(([, point]) => point.slug === spot.slug);
      const turns: Turn[] = spot.turns.map(([kind, time, feet]) => ({
        ts: `2026-09-29T${time}:00-07:00`, type: kind === "H" ? "high" : "low", tide_height_m: feet * 0.3048,
      }));
      const label = spot.turns.map(([kind, time, feet]) => `${kind} ${time} ${feet.toFixed(1)}`).join("; ");
      const coordinates = entry?.[1].lat !== undefined && entry[1].lon !== undefined
        ? `${entry[1].lat}, ${entry[1].lon}` : spot.lat !== undefined && spot.lon !== undefined
          ? `${spot.lat}, ${spot.lon}` : "N/A";
      if (!entry) { lines.push(`| ${spot.slug} | ${coordinates} | ${label} | No extracted point |`); continue; }
      const [id, point] = entry;
      const windowStart = "2026-09-29T07:00:00Z";
      const windowEnd = "2026-09-30T07:00:00Z";
      const model = predictModelTideExtremes(modelFor(id, point), windowStart, windowEnd);
      const matches = matchTurns(model, turns);
      lines.push(`| ${spot.slug} | ${coordinates} | ${label} | ${matches.map((match) => `${match.reference.type[0].toUpperCase()} ${format(match.dtMinutes, 0)}`).join("; ") || "No matches"} (${matches.length}/4) |`);
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log("npx tsx --conditions=import scripts/tides/validate-fes2022.ts --raw extracted.json --report report.md [--start YYYY-MM-DD] [--days 7]");
    return;
  }
  const rawPath = option("--raw");
  const report = option("--report");
  if (!rawPath || !report) throw new Error("--raw and --report are required");
  const raw = JSON.parse(await readFile(rawPath, "utf8")) as RawExtraction;
  const start = option("--start") ?? new Date().toISOString().slice(0, 10);
  const days = Number(option("--days") ?? "7");
  const markdown = await validate(raw, start, days);
  await writeFile(report, markdown);
  console.log(markdown);
}

if (require.main === module) main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
