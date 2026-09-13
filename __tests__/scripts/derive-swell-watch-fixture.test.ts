/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { deriveSwellWatchFixture } from "@/scripts/derive-swell-watch-fixture";

const HOUR = 3_600_000;
const start = Date.parse("2026-09-05T00:00:00.000Z");
const at = (hour: number): string => new Date(start + hour * HOUR).toISOString();

function run(issuedHour: number) {
  const source = { provider: "open_meteo", model: "fixture-model", sourcePointId: "fixture-beach", issuedAt: at(issuedHour) };
  return {
    source,
    forecastDays: 7,
    samples: Array.from({ length: 168 }, (_, index) => {
      const hour = issuedHour + index;
      return {
        forecastAt: at(hour),
        components: [
          { sourceSlot: "s1", heightM: 0.3, periodS: 9, directionDeg: 260,
            fieldSources: { height: { ...source }, period: { ...source }, direction: { ...source } } },
          { sourceSlot: "s2", heightM: hour >= 78 && hour <= 84 ? (hour === 81 ? 1.5 : 1) : 0.25,
            periodS: 13, directionDeg: 170,
            fieldSources: { height: { ...source }, period: { ...source }, direction: { ...source } } },
        ],
      };
    }),
  };
}

function input() {
  return { provenance: "synthetic_fixture", now: at(6), policy: fixturePolicy,
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 }, runs: [run(0), run(6)] };
}

describe("fixture-only swell derivation", () => {
  it("derives the exposed 48-hour baseline, actual S2 arrival/peak, and consistency without release authority", () => {
    const result = deriveSwellWatchFixture(input());
    expect(result).toMatchObject({ kind: "derived", provenance: "synthetic_fixture", productionApproved: false,
      qualifyingEvaluationCount: 0, derivationVersion: "swell-watch-derivation-fixture.v1",
      baseline: { heightFt: 0.8202, energy: 0.8202 ** 2 * 13 },
      events: [{ arrivalAt: at(78), peakAt: at(81), confidence: 1,
        impact: { kind: "candidate", partition: { sourceSlot: "s2", periodS: 13, directionDeg: 170, forecastAt: at(81) } } }] });
    expect(result).toEqual(deriveSwellWatchFixture(input()));
    expect(fixturePolicy.value_hash).toBe("9a278ceca6c2fde80358e19258e2f6118e564735b8eb762266bd682c494df2ad");
  });

  it("excludes hour 48 from the baseline and takes maxima instead of the first or last value", () => {
    const changed = input();
    changed.runs[1].samples[47].components[1].heightM = 0.4;
    changed.runs[1].samples[48].components[1].heightM = 0.5;
    const result = deriveSwellWatchFixture(changed);
    expect(result).toMatchObject({ kind: "derived", baseline: { heightFt: 1.3123 } });
  });

  it.each(["missing", "duplicate", "mixed-field", "missing-source", "null", "invalid-time"])("suppresses %s input", (failure) => {
    const changed = input();
    const sample = changed.runs[1].samples[80];
    if (failure === "missing") changed.runs[1].samples.splice(80, 1);
    if (failure === "duplicate") sample.forecastAt = changed.runs[1].samples[79].forecastAt;
    if (failure === "mixed-field") sample.components[1].fieldSources.period.provider = "noaa";
    if (failure === "missing-source") Reflect.deleteProperty(sample.components[1], "fieldSources");
    if (failure === "null") Reflect.set(sample.components[1], "heightM", null);
    if (failure === "invalid-time") sample.forecastAt = "2026-09-08 08:00:00";
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "suppressed" });
  });

  it("follows an unambiguous S1/S2 rerank without changing physical event identity", () => {
    const changed = input();
    for (const sample of changed.runs[1].samples.slice(74)) {
      const [first, second] = sample.components;
      sample.components = [{ ...second, sourceSlot: "s1" }, { ...first, sourceSlot: "s2" }];
    }
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "derived", events: [
      { arrivalAt: at(78), peakAt: at(81), confidence: 1, impact: { partition: { sourceSlot: "s1", periodS: 13 } } },
    ] });
  });

  it("rejects ambiguous tracks and truncated episodes instead of inventing a peak", () => {
    const ambiguous = input();
    Object.assign(ambiguous.runs[1].samples[80].components[0], { directionDeg: 170, periodS: 13 });
    expect(deriveSwellWatchFixture(ambiguous)).toMatchObject({ kind: "suppressed", reason: "ambiguous_partition_path" });
    const truncated = input();
    for (const sample of truncated.runs[1].samples.slice(72)) sample.components[1].heightM = 1;
    expect(deriveSwellWatchFixture(truncated)).toMatchObject({ kind: "suppressed", reason: "unclosed_episode" });
  });

  it("does not count retries, corrections, reversed runs, or mixed models as consistency evidence", () => {
    const duplicate = input();
    duplicate.runs[0] = duplicate.runs[1];
    expect(deriveSwellWatchFixture(duplicate)).toMatchObject({ kind: "suppressed", reason: "invalid_run_sequence" });
    const reversed = input();
    reversed.runs.reverse();
    expect(deriveSwellWatchFixture(reversed)).toMatchObject({ kind: "suppressed", reason: "invalid_run_sequence" });
    const mixed = input();
    mixed.runs[0].source.model = "different-model";
    expect(deriveSwellWatchFixture(mixed)).toMatchObject({ kind: "suppressed" });
  });

  it("reduces consistency for a real timing change and leaves unmatched episodes unscored", () => {
    const changed = input();
    for (const sample of changed.runs[0].samples) {
      const hour = (Date.parse(sample.forecastAt) - start) / HOUR;
      sample.components[1].heightM = hour >= 75 && hour <= 81 ? (hour === 78 ? 1.5 : 1) : 0.25;
    }
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "derived", events: [{ confidence: 0.5 }] });
    for (const sample of changed.runs[0].samples) sample.components[1].heightM = 0.25;
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "derived", events: [{ confidence: null }] });
  });

  it("requires fixture provenance and rejects stale/current-future clocks", () => {
    expect(deriveSwellWatchFixture({ ...input(), provenance: "genuine_completed" })).toMatchObject({ kind: "suppressed" });
    expect(deriveSwellWatchFixture({ ...input(), now: at(13) })).toMatchObject({ kind: "suppressed", reason: "stale_run" });
    expect(deriveSwellWatchFixture({ ...input(), now: at(5) })).toMatchObject({ kind: "suppressed", reason: "invalid_run_sequence" });
  });

  it("uses the highest energy independently of height and excludes unexposed baseline waves", () => {
    const changed = input();
    changed.runs[1].samples[20].components[1].heightM = 0.4;
    changed.runs[1].samples[21].components[1].heightM = 0.39;
    changed.runs[1].samples[21].components[1].periodS = 15;
    changed.runs[1].samples[22].components[0].heightM = 20;
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "derived",
      baseline: { heightFt: 1.3123, energy: 1.2795 ** 2 * 15 } });
  });

  it("keeps the earliest equal-height peak and separates multiple episodes", () => {
    const changed = input();
    for (const item of changed.runs) {
      for (const sample of item.samples) {
        if (sample.forecastAt === at(82)) sample.components[1].heightM = 1.5;
        if (sample.forecastAt === at(100)) sample.components[1].heightM = 1;
      }
    }
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "derived", events: [
      { arrivalAt: at(78), peakAt: at(81), confidence: 1 },
      { arrivalAt: at(100), peakAt: at(100), confidence: 1 },
    ] });
  });

  it("uses circular direction distance for consistency", () => {
    const changed = input();
    changed.beach.swell_window_center_deg = 0;
    changed.runs.forEach((item, index) => {
      for (const sample of item.samples) sample.components[1].directionDeg = index === 0 ? 359 : 1;
    });
    expect(deriveSwellWatchFixture(changed)).toMatchObject({ kind: "derived", events: [{ confidence: 0.92 }] });
  });

  it.each([47, 48, 120, 121])("applies the actual %s-hour arrival gate without clipping peak discovery", (lead) => {
    const changed = input();
    changed.now = at(12);
    for (const item of changed.runs) {
      for (const sample of item.samples) {
        const hour = (Date.parse(sample.forecastAt) - start) / HOUR;
        sample.components[1].heightM = hour >= 12 + lead && hour < 16 + lead ? (hour === 14 + lead ? 1.5 : 1) : 0.25;
      }
    }
    const result = deriveSwellWatchFixture(changed);
    expect(result).toMatchObject({ kind: "derived", events: lead === 47 || lead === 121 ? [] : [
      { arrivalAt: at(12 + lead), peakAt: at(14 + lead), confidence: 1 },
    ] });
  });

  it("requires both horizons to cover the full actionability window", () => {
    expect(deriveSwellWatchFixture({ ...input(), now: at(120), runs: [run(0), run(120)] }))
      .toMatchObject({ kind: "suppressed", reason: "incomplete_horizon" });
  });

  it("fails closed for zero/missing exposure baselines and non-fixture policies", () => {
    const zero = input();
    for (const item of zero.runs) for (const sample of item.samples.slice(0, 48)) sample.components[1].heightM = 0;
    expect(deriveSwellWatchFixture(zero)).toMatchObject({ kind: "suppressed", reason: "missing_baseline" });
    const hidden = input();
    hidden.beach.swell_window_center_deg = 0;
    expect(deriveSwellWatchFixture(hidden)).toMatchObject({ kind: "suppressed", reason: "missing_baseline" });
    expect(deriveSwellWatchFixture({ ...input(), policy: { ...fixturePolicy, provenance: "production_approved" } }))
      .toMatchObject({ kind: "suppressed", reason: "invalid_fixture_policy" });
  });

  it("runs through the existing calibration CLI without production access", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase26-derivation-test-"));
    try {
      const path = join(directory, "fixture.json");
      writeFileSync(path, JSON.stringify(input()), { mode: 0o600 });
      const output = execFileSync(join(process.cwd(), "node_modules/.bin/tsx"), [
        "scripts/calibrate-swell-watch.ts", "--mode", "derivation-fixtures", "--input", path,
      ], { encoding: "utf8", timeout: 10_000 });
      expect(JSON.parse(output)).toEqual(deriveSwellWatchFixture(input()));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
