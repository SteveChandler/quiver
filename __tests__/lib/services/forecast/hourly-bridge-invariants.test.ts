/**
 * @jest-environment node
 *
 * A bridged hour is a blend of its two stored neighbours, so it must not score better than both,
 * lift a cap both share, or drop an effect both raise. Real prod rows for 2026-10-27 (five San
 * Diego / OC beaches) bridged with their hourly tide series. The harness found Windansea 06:00
 * over both neighbours and Lower Trestles losing crossing_swells when swell_1/swell_2 swap order.
 */

import fixture from "@/__tests__/fixtures/tide-swing-20261027.json";
import tideFixture from "@/__tests__/fixtures/tide-swing-20261027-tides.json";
import { bridgeForecastsHourly } from "@/lib/services/forecast/hourly-bridge";
import type { TideSeriesSample } from "@/lib/services/tide-series-loader";
import { scoreWindowConditionDetails, scoreWindowWithComposite } from "@/lib/services/discovery/window-selector/window-scorer";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const SCORE_SLACK = 2;
const slugs = Object.keys(fixture.beaches) as Array<keyof typeof fixture.beaches>;

function setup(slug: keyof typeof fixture.beaches) {
  const beach = fixture.beaches[slug] as unknown as Beach;
  const rows = fixture.forecasts[slug] as unknown as EnhancedForecastEntity[];
  const series: TideSeriesSample[] = tideFixture.tides[slug].map((sample) => ({ ts: sample.ts, heightFt: sample.ft }));
  const bridged = bridgeForecastsHourly(rows, series, { timezone: beach.timezone ?? undefined });
  const byAt = new Map(rows.map((row) => [Date.parse(row.forecast_at), row]));
  const synthetic = bridged.filter((row) => row.raw_forecast?.hourly_bridge);
  return { beach, rows, bridged, synthetic, byAt };
}

function scored(row: EnhancedForecastEntity, beach: Beach) {
  const details = scoreWindowConditionDetails(row, beach, "intermediate");
  const caps = new Map<string, number>();
  for (const effect of scoreWindowWithComposite(row, beach).effects ?? []) {
    caps.set(effect.code, Math.min(caps.get(effect.code) ?? 100, effect.verdictCeiling ?? 100));
  }
  const binding = new Set([...caps].filter(([, cap]) => cap === details.decisionCeiling).map(([code]) => code));
  return { score: details.score, ceiling: details.decisionCeiling, effects: new Set(caps.keys()), caps, binding };
}

type Scored = ReturnType<typeof scored>;

/**
 * Two neighbours capped by different effects hand off: one cap relaxes while the other tightens,
 * so the hour between can sit under neither (Lower Trestles 4 PM: crossing_swells 65 fading,
 * tide_outside_band 55 not yet reached, the hour at 69). Each effect's cap must still lie between
 * its two neighbours' caps (absent = 100); only the min across effects may exceed both.
 */
function isCapHandoff(hour: Scored, before: Scored, after: Scored): boolean {
  if ([...before.binding].some((code) => after.binding.has(code))) return false;
  const codes = new Set([...hour.caps.keys(), ...before.caps.keys(), ...after.caps.keys()]);
  return [...codes].every((code) => {
    const [a, b, h] = [before.caps.get(code) ?? 100, after.caps.get(code) ?? 100, hour.caps.get(code) ?? 100];
    return h >= Math.min(a, b) && h <= Math.max(a, b);
  });
}

describe.each([
  ["tide swing off", undefined],
  ["tide swing on", "true"],
])("bridged hours stay within their neighbours (%s)", (_label, tideSwing) => {
  const original = process.env.TIDE_SWING_ENABLED;
  beforeAll(() => {
    if (tideSwing === undefined) delete process.env.TIDE_SWING_ENABLED;
    else process.env.TIDE_SWING_ENABLED = tideSwing;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.TIDE_SWING_ENABLED;
    else process.env.TIDE_SWING_ENABLED = original;
  });

  it.each(slugs)("%s", (slug) => {
    const { beach, synthetic, byAt } = setup(slug);
    expect(synthetic).toHaveLength(8);
    for (const row of synthetic) {
      const bridge = row.raw_forecast?.hourly_bridge;
      const from = byAt.get(Date.parse(bridge?.from ?? ""));
      const to = byAt.get(Date.parse(bridge?.to ?? ""));
      if (!from || !to) throw new Error(`no neighbours for ${row.id}`);
      const [hour, before, after] = [scored(row, beach), scored(from, beach), scored(to, beach)];
      const context = `${slug} ${row.forecast_at}: ${hour.score}/${hour.ceiling} vs ${before.score}/${before.ceiling}, ${after.score}/${after.ceiling}`;

      expect({ context, score: hour.score <= Math.max(before.score, after.score) + SCORE_SLACK }).toEqual({ context, score: true });
      const ceilingHolds = hour.ceiling <= Math.max(before.ceiling, after.ceiling) || isCapHandoff(hour, before, after);
      expect({ context, ceiling: ceilingHolds }).toEqual({ context, ceiling: true });
      const shared = [...before.effects].filter((code) => after.effects.has(code));
      expect({ context, dropped: shared.filter((code) => !hour.effects.has(code)) }).toEqual({ context, dropped: [] });
    }
  });
});

describe("bridged real rows", () => {
  it("take every tide field from the hourly series at every bridged hour", () => {
    for (const slug of slugs) {
      const { synthetic } = setup(slug);
      expect(synthetic.map((row) => row.raw_forecast?.hourly_bridge?.tide_source)).toEqual(Array(8).fill("series"));
    }
  });

  it("keep Lower Trestles' crossing swells through the swell_1/swell_2 swap", () => {
    const { synthetic } = setup("lower-trestles");
    const sixAm = synthetic.find((row) => row.forecast_at === "2026-10-27T13:00:00.000Z");
    expect(sixAm).toMatchObject({
      swell_1_height: "2 ft", swell_1_period: "6.3s", swell_1_direction: "W",
      swell_2_height: "2 ft", swell_2_period: "10.7s", swell_2_direction: "SSW",
    });
  });

  it("switch PB Point's dominant period between trains instead of ramping 5 → 13 s", () => {
    const { bridged } = setup("pb-point");
    const periods = bridged
      .filter((row) => Date.parse(row.forecast_at) <= Date.parse("2026-10-27T15:00:00Z"))
      .map((row) => row.wave_period);
    expect(periods).toEqual(["5s", "4.7s", "4.3s", "13s"]);
  });
});
