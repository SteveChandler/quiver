import { OLD_POLICY, RAMP_TIMING, TRAILING_BASELINE, baselineFaceHeightFt, loadBacktest, policyVariant, replay, type BacktestFixture } from "@/__tests__/helpers/swell-watch-epoch-7-backtest";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

type Row = { arrivalAt: string; peakAt: string; face: number; rise: number; ratio: number; baselineHeightFt: number };
const HOUR = 3_600_000;
const hh = (iso: string): string => iso.slice(5, 16).replace("T", " ") + "Z";
const hours = (left: string, right: string): number => (Date.parse(left) - Date.parse(right)) / HOUR;
const signed = (value: number): string => `${value >= 0 ? "+" : ""}${Math.round(value)}`;

async function events(fixture: BacktestFixture, beach: Parameters<typeof replay>[1], policy: SwellWatchPolicy, trailingHours = 48): Promise<Row[] | string> {
  const result = await replay(fixture, beach, policy, trailingHours);
  if (result.kind === "suppressed") return result.reason;
  return result.events.map((event) => ({ arrivalAt: event.arrivalAt, peakAt: event.peakAt, face: event.impact.projectedFaceHeightFt,
    rise: event.impact.heightRiseFt, ratio: event.impact.energyRatio, baselineHeightFt: result.baseline.heightFt }));
}
function scored(fixture: BacktestFixture, rows: Row[] | string): Row | string | null {
  if (typeof rows === "string") return rows;
  const near = rows.filter((row) => Math.abs(hours(row.peakAt, fixture.oldPeakAt)) <= 96 || Math.abs(hours(row.arrivalAt, fixture.oldArrivalAt)) <= 48)
    .sort((a, b) => Math.abs(hours(a.peakAt, fixture.oldPeakAt)) - Math.abs(hours(b.peakAt, fixture.oldPeakAt)));
  return near[0] ?? null;
}
const cell = (value: Row | string | null): string => value === null ? "does not qualify" : typeof value === "string" ? `suppressed: ${value}` : `${hh(value.arrivalAt)} / ${hh(value.peakAt)}`;

async function main(): Promise<void> {
  const { fixtures, beaches } = loadBacktest();
  const newPolicy = policyVariant({ energy: 2, detection: { baseline: TRAILING_BASELINE, timing: RAMP_TIMING } });
  const gatedBasis = policyVariant({ energy: 2, detection: { baseline: TRAILING_BASELINE, timing: { ...RAMP_TIMING, actionability_basis: "gated_arrival" } } });
  const lines: string[] = [];
  lines.push("| Swell (feed) | Buoy peak | Old arrival / peak | Old peak err (h) | New arrival / peak | New peak err (h) | (i) energy 2.0 | (ii) face 2.0x | Other new events |", "|---|---|---|---|---|---|---|---|---|");
  const detail: string[] = ["", "Isolated and sensitivity runs (arrival / peak of the scored event):", "",
    "| Swell | old | 2.0 gate only | trailing baseline only | ramp timing only | ramp timing only, gated actionability | all (ramp_arrival) | all (gated_arrival) | trailing 24h | trailing 12h | ramp, 1.25 gate, trailing baseline |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const fixture of fixtures) {
    const beach = beaches[fixture.sourcePointId];
    const oldRows = await events(fixture, beach, OLD_POLICY);
    const oldScored = scored(fixture, oldRows);
    const newRows = await events(fixture, beach, newPolicy);
    const newScored = scored(fixture, newRows);
    const gate2Old = scored(fixture, await events(fixture, beach, policyVariant({ energy: 2 })));
    const faceOnly = policyVariant({ energy: 0.0001, detection: { baseline: TRAILING_BASELINE, timing: RAMP_TIMING } });
    const faceRows = await events(fixture, beach, faceOnly);
    const faceScored = scored(fixture, faceRows);
    const baselineFace = baselineFaceHeightFt(fixture, beach, "trailing");
    const faceRatio = typeof faceScored === "object" && faceScored && baselineFace ? faceScored.face / baselineFace : null;
    const faceCell = faceRatio === null ? (typeof faceScored === "string" ? `suppressed: ${faceScored}` : "no event") : `${faceRatio >= 2 ? "qualifies" : "fails"} (${faceRatio.toFixed(2)}x)`;
    const oldFaceBase = baselineFaceHeightFt(fixture, beach, "forecast_front");
    const oldFaceRatio = typeof oldScored === "object" && oldScored && oldFaceBase ? oldScored.face / oldFaceBase : null;
    const extra = Array.isArray(newRows) ? newRows.filter((row) => row !== newScored).map((row) => `${hh(row.arrivalAt)} / ${hh(row.peakAt)}`).join("; ") || "-" : "-";
    const peakErr = (value: Row | string | null): string => typeof value === "object" && value ? signed(hours(value.peakAt, fixture.buoy.peakAt)) : "-";
    lines.push(`| ${fixture.name} (${fixture.sourcePointId.slice(0, 8)}) | ${hh(fixture.buoy.peakAt)} | ${cell(oldScored)} | ${peakErr(oldScored)} | ${cell(newScored)} | ${peakErr(newScored)} | `
      + `${typeof newScored === "object" && newScored ? `qualifies (ratio ${newScored.ratio.toFixed(2)})` : cell(newScored)}; old baseline: ${typeof gate2Old === "object" && gate2Old ? `qualifies (ratio ${(Array.isArray(oldRows) && oldRows.find((r) => r.peakAt === gate2Old.peakAt)?.ratio.toFixed(2)) ?? "?"})` : cell(gate2Old)} | `
      + `${faceCell}; old baseline: ${oldFaceRatio === null ? "-" : `${oldFaceRatio >= 2 ? "qualifies" : "fails"} (${oldFaceRatio.toFixed(2)}x)`} | ${extra} |`);
    const variants = await Promise.all([
      events(fixture, beach, policyVariant({ energy: 2 })), events(fixture, beach, policyVariant({ detection: { baseline: TRAILING_BASELINE } })),
      events(fixture, beach, policyVariant({ detection: { timing: RAMP_TIMING } })), events(fixture, beach, policyVariant({ detection: { timing: { ...RAMP_TIMING, actionability_basis: "gated_arrival" } } })), Promise.resolve(newRows), events(fixture, beach, gatedBasis),
      events(fixture, beach, policyVariant({ energy: 2, detection: { baseline: { ...TRAILING_BASELINE, trailing_hours: 24, minimum_trailing_frames: 18 }, timing: RAMP_TIMING } }), 24),
      events(fixture, beach, policyVariant({ energy: 2, detection: { baseline: { ...TRAILING_BASELINE, trailing_hours: 12, minimum_trailing_frames: 9 }, timing: RAMP_TIMING } }), 12),
      events(fixture, beach, policyVariant({ detection: { baseline: TRAILING_BASELINE, timing: RAMP_TIMING } })),
    ]);
    detail.push(`| ${fixture.name} | ${cell(oldScored)} | ${variants.map((rows) => cell(scored(fixture, rows))).join(" | ")} |`);
  }
  console.log([...lines, ...detail].join("\n"));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
