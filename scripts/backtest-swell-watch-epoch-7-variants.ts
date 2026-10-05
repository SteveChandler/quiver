import { OLD_POLICY, RAMP_TIMING, loadBacktest, replay, type BacktestFixture } from "@/__tests__/helpers/swell-watch-epoch-7-backtest";
import { measureSwellWatchImpact } from "@/lib/alerts/swell-watch/impact-evaluator";
import { calculateSwellWatchPolicyHash, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

type Beach = ReturnType<typeof loadBacktest>["beaches"][string];
type Row = { arrivalAt: string; peakAt: string; ratio: number; face: number; rise: number; baselineH: number };
const HOUR = 3_600_000;
const FEET = 3.28084;
const hh = (iso: string): string => iso.slice(5, 16).replace("T", " ");
const median = (values: number[]): number => { const s = [...values].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function policy(input: { hours: number; frames: number; basis: "ramp_arrival" | "gated_arrival"; permissive: boolean }): SwellWatchPolicy {
  const base = structuredClone(OLD_POLICY);
  const policy_values = { ...base.policy_values,
    detection: { baseline: { source: "trailing_persisted_frames.v1" as const, trailing_hours: input.hours, maximum_lead_hours: 12, minimum_trailing_frames: input.frames },
      timing: { ...RAMP_TIMING, actionability_basis: input.basis } },
    local_significance: { minimum_height_rise_ft: input.permissive ? 0.0001 : 1, minimum_energy_ratio: input.permissive ? 0.0001 : 2 },
    local_impact: { minimum_impact_score: input.permissive ? 0.0001 : 1 } };
  const unsigned = { ...base, profile_id: "swell-watch-backtest-variant", policy_values };
  return { ...unsigned, value_hash: calculateSwellWatchPolicyHash(unsigned) };
}

type Part = { h: number; p: number; d: number };
const partsOf = (row: number[]): Part[] => [0, 3].map((o) => ({ h: row[o], p: row[o + 1], d: row[o + 2] })).filter((part) => part.p > 0);
function inWindow(part: Part, beach: Beach): boolean {
  const delta = Math.abs(part.d - beach.swell_window_center_deg) % 360;
  return Math.min(delta, 360 - delta) <= beach.swell_window_halfwidth_deg;
}
function faceOf(part: Part, beach: Beach, issuedAt: string): number {
  return measureSwellWatchImpact({ partition: { provider: "open_meteo", evaluationId: "x", forecastAt: issuedAt, sourceSlot: "s1", heightM: part.h, periodS: part.p, directionDeg: part.d, completeness: "complete" },
    baselineHeightFt: 0, baselineEnergy: 1, beach: beach as never })?.projectedFaceHeightFt ?? 0;
}

interface Variant { id: string; label: string; hours: number; agg: "max" | "median" | "freshest" }
const VARIANTS: Variant[] = [
  { id: "A", label: "trailing 48h, max (current proposal)", hours: 48, agg: "max" },
  { id: "B", label: "trailing 12h, max", hours: 12, agg: "max" },
  { id: "C", label: "trailing 48h, median", hours: 48, agg: "median" },
  { id: "D", label: "trailing 12h, median", hours: 12, agg: "median" },
  { id: "E", label: "freshest frame at issuance", hours: 1, agg: "freshest" },
];

/** Backtest-only: median/freshest baselines are injected as constant synthetic frames whose max equals the aggregate. */
function shaped(fixture: BacktestFixture, beach: Beach, variant: Variant): { fixture: BacktestFixture; frames: number; baselineFace: number | null } {
  const rows = fixture.trailing.filter(([hoursBefore]) => hoursBefore <= (variant.agg === "freshest" ? 1 : variant.hours));
  const perFrame = rows.map(([, , ...row]) => {
    const inside = partsOf(row).filter((part) => inWindow(part, beach));
    return inside.length ? { h: Math.max(...inside.map((part) => part.h)), e: Math.max(...inside.map((part) => (part.h * FEET) ** 2 * part.p)),
      f: Math.max(...inside.map((part) => faceOf(part, beach, fixture.issuedAt))), d: inside[0].d } : null;
  });
  const valid = perFrame.filter((value): value is NonNullable<typeof value> => value !== null);
  const frames = variant.agg === "freshest" ? 1 : Math.max(1, Math.floor(variant.hours * 0.75));
  if (variant.agg === "max" || !valid.length) {
    return { fixture: { ...fixture, trailing: fixture.trailing.filter(([hoursBefore]) => hoursBefore <= variant.hours) }, frames, baselineFace: valid.length ? Math.max(...valid.map((v) => v.f)) : null };
  }
  const agg = variant.agg === "median" ? median : (values: number[]) => values[0];
  const height = agg(valid.map((v) => v.h));
  const energy = agg(valid.map((v) => v.e));
  const period = energy / (height * FEET) ** 2;
  const synthetic = rows.map(([hoursBefore, runHoursBefore]) => [hoursBefore, runHoursBefore, height, period, beach.swell_window_center_deg, 0, 0, 0]);
  return { fixture: { ...fixture, trailing: synthetic }, frames, baselineFace: agg(valid.map((v) => v.f)) };
}

async function events(fixture: BacktestFixture, beach: Beach, variant: Variant, basis: "ramp_arrival" | "gated_arrival", permissive: boolean): Promise<{ rows: Row[]; baselineFace: number | null } | string> {
  const prepared = shaped(fixture, beach, variant);
  const result = await replay(prepared.fixture, beach, policy({ hours: variant.agg === "freshest" ? 48 : variant.hours, frames: prepared.frames, basis, permissive }), 48);
  if (result.kind === "suppressed") return result.reason;
  const baselineFace = prepared.baselineFace;
  return { baselineFace, rows: result.events.map((event) => ({ arrivalAt: event.arrivalAt, peakAt: event.peakAt, ratio: event.impact.energyRatio, face: event.impact.projectedFaceHeightFt,
    rise: baselineFace === null ? NaN : event.impact.projectedFaceHeightFt - baselineFace, baselineH: result.baseline.heightFt })) };
}
function pick(fixture: BacktestFixture, value: Awaited<ReturnType<typeof events>>): { row: Row; baselineFace: number | null } | string | null {
  if (typeof value === "string") return value;
  const near = value.rows.filter((row) => Math.abs(Date.parse(row.peakAt) - Date.parse(fixture.oldPeakAt)) <= 96 * HOUR || Math.abs(Date.parse(row.arrivalAt) - Date.parse(fixture.oldArrivalAt)) <= 96 * HOUR)
    .sort((a, b) => Math.abs(Date.parse(a.peakAt) - Date.parse(fixture.oldPeakAt)) - Math.abs(Date.parse(b.peakAt) - Date.parse(fixture.oldPeakAt)));
  return near[0] ? { row: near[0], baselineFace: value.baselineFace } : null;
}

async function main(): Promise<void> {
  const { fixtures, beaches } = loadBacktest();
  const floors: string[] = ["", "Floors and ratios per swell (permissive ramp event, variant baseline; face rise = peak face - baseline face)", "",
    "| Variant | Swell | peak face | baseline face | rise | ratio | rise>=1.0 | 1.5 | 2.0 | 3.0 | ratio>=1.5 | ratio>=2.0 |", "|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const variant of VARIANTS) {
    console.log(`\n### Variant ${variant.id}: ${variant.label}\n`);
    console.log("| Swell | basis | qualifies | arrival | peak | peak err h (pred-buoy) | energy ratio | baseline face ft | peak face ft | face rise ft | face ratio |", "\n|---|---|---|---|---|---|---|---|---|---|---|");
    const lines: string[] = [];
    for (const fixture of fixtures) {
      const beach = beaches[fixture.sourcePointId];
      const cells: Record<string, string> = {};
      const candidates: Array<NonNullable<ReturnType<typeof pick>> | string | null> = [];
      for (const basis of ["ramp_arrival", "gated_arrival"] as const) {
        const real = pick(fixture, await events(fixture, beach, variant, basis, false));
        const loose = pick(fixture, await events(fixture, beach, variant, basis, true));
        candidates.push(real, loose);
        const shown = typeof real === "object" && real ? real : typeof loose === "object" && loose ? loose : null;
        const mark = typeof real === "object" && real ? "" : "*";
        const status = typeof real === "string" ? `no (${real})` : real ? "yes" : "no";
        cells[basis] = shown ? `${status} | ${hh(shown.row.arrivalAt)}${mark} | ${hh(shown.row.peakAt)}${mark} | ${Math.round((Date.parse(shown.row.peakAt) - Date.parse(fixture.buoy.peakAt)) / HOUR)} | ${shown.row.ratio.toFixed(2)} | ${shown.baselineFace?.toFixed(1) ?? "-"} | ${shown.row.face.toFixed(1)} | ${shown.row.rise.toFixed(1)} | ${shown.baselineFace ? (shown.row.face / shown.baselineFace).toFixed(2) : "-"}`
          : `${status} | - | - | - | - | - | - | - | -`;
      }
      const best = candidates.find((value): value is { row: Row; baselineFace: number | null } => typeof value === "object" && value !== null);
      if (best) {
        const f = best.row; const b = best.baselineFace; const rise = f.face - (b ?? 0);
        const ok = (x: boolean): string => (x ? "Y" : "n");
        floors.push(`| ${variant.id} | ${fixture.name} | ${f.face.toFixed(1)} | ${b?.toFixed(1) ?? "-"} | ${rise.toFixed(1)} | ${b ? (f.face / b).toFixed(2) : "-"} | ${[1, 1.5, 2, 3].map((x) => ok(rise >= x)).join(" | ")} | ${ok(!!b && f.face / b >= 1.5)} | ${ok(!!b && f.face / b >= 2)} |`);
      } else floors.push(`| ${variant.id} | ${fixture.name} | no ramp event | | | | | | | | | |`);
      if (cells.ramp_arrival === cells.gated_arrival) lines.push(`| ${fixture.name} | both | ${cells.ramp_arrival} |`);
      else for (const basis of ["ramp_arrival", "gated_arrival"] as const) lines.push(`| ${fixture.name} | ${basis} | ${cells[basis]} |`);
    }
    console.log(lines.join("\n"));
  }
  console.log("\n(* = value from a gate-free replay of the same ramp, shown because the gated run produced no event)");
  console.log(floors.join("\n"));

  const scripps = fixtures.find((fixture) => fixture.name === "scripps-0925")!;
  const beach = beaches[scripps.sourcePointId];
  const stats = (rows: number[][]): { inside: Part | null; outside: Part | null; insideFace: number } => {
    const all = rows.flatMap(partsOf);
    const inside = all.filter((part) => inWindow(part, beach)).sort((a, b) => b.h - a.h)[0] ?? null;
    const outside = all.filter((part) => !inWindow(part, beach)).sort((a, b) => b.h - a.h)[0] ?? null;
    return { inside, outside, insideFace: inside ? faceOf(inside, beach, scripps.issuedAt) : 0 };
  };
  const fmt = (part: Part | null): string => part ? `${part.h}m ${part.p}s ${part.d}deg (${(part.h * FEET).toFixed(2)}ft)` : "none";
  const t48 = stats(scripps.trailing.map(([, , ...row]) => row));
  console.log(`\nScripps window ${beach.swell_window_center_deg - beach.swell_window_halfwidth_deg}-${beach.swell_window_center_deg + beach.swell_window_halfwidth_deg}`);
  console.log(`trailing 48h tallest in-window partition: ${fmt(t48.inside)} face ${t48.insideFace.toFixed(1)}ft; tallest OUT-of-window: ${fmt(t48.outside)}`);
  const front = stats(scripps.frames.slice(0, 48));
  console.log(`forecast-front 48h tallest in-window: ${fmt(front.inside)} face ${front.insideFace.toFixed(1)}ft; tallest out-of-window: ${fmt(front.outside)}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
