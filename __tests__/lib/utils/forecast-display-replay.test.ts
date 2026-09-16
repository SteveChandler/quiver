import { toFaceHeightFeetDecomposedWithDebug, METERS_TO_FEET, type DecomposedFaceHeightParams } from '@/lib/utils/wave-formatters';
import { createForecastHandoffBlendState, processForecastHandoffBlendSlot } from '@/lib/utils/forecast-handoff-blend';
import { replayForecastDisplayHeightM, type ForecastDisplayReplayContext } from '@/lib/utils/forecast-display-replay';
import type { BeachTerrainConfig } from '@/lib/utils/wave-height-transformer';

const generatedAt = '2026-09-11T00:00:00Z';
const beach: BeachTerrainConfig = {
  terrain_enabled: true, swell_access_factors: Array(72).fill(0.25),
  shoaling_factors: { version: 1, type: 'period_lookup', buckets: [{ tp_min_s: 0, tp_max_s: 999, factor: 1 }] },
};

function generate(config: BeachTerrainConfig, enabled = true): { context: ForecastDisplayReplayContext; meters: number }[] {
  const state = createForecastHandoffBlendState();
  const inputs: DecomposedFaceHeightParams[] = [
    { cdipSigFt: 4, components: [], periodS: 14 },
    { modelSwellM: 0.8, components: [{ heightFt: 2.5, periodS: 14, directionDeg: 220 }], periodS: 14 },
    { modelSwellM: 1, components: [{ heightFt: 3, periodS: 14, directionDeg: 220 }], periodS: 14 },
  ];
  return inputs.map((params, i) => {
    const forecastAt = `2026-09-${i === 2 ? '12' : '11'}T${i === 0 ? '00' : '03'}:00:00Z`;
    const rendered = toFaceHeightFeetDecomposedWithDebug({ ...params, beach: config });
    const base = { input: rendered.debug.replayInput!, supported: true };
    const step = processForecastHandoffBlendSlot({ state, enabled, slot: {
      forecastAt, waveHeight: rendered.value, dataSource: i === 0 ? 'CDIP' : 'NOAA_NWS',
      waveHeightSource: rendered.debug.source, replay: base,
    } });
    const ft = parseFloat(step.adjustment?.waveHeight ?? rendered.value!);
    return {
      context: JSON.parse(JSON.stringify({ version: 1, generatedAt, forecastAt, base,
        handoff: enabled ? state.replay ?? null : null, unsupportedReason: null })),
      meters: Math.round(ft / METERS_TO_FEET * 1000) / 1000,
    };
  });
}

describe('immutable forecast display replay', () => {
  it.each([true, false])('reproduces a serialized same-run forecast with blending=%s', (enabled) => {
    for (const row of generate(beach, enabled)) {
      expect(replayForecastDisplayHeightM(row.context)).toBe(row.meters);
    }
  });

  it('recomputes both seam endpoints under proposed terrain and shoaling', () => {
    const patch: BeachTerrainConfig = {
      swell_access_factors: Array(72).fill(1),
      shoaling_factors: { version: 1, type: 'period_lookup', buckets: [{ tp_min_s: 0, tp_max_s: 999, factor: 1.5 }] },
    };
    const original = generate(beach), changed = generate({ ...beach, ...patch });
    expect(changed[2].meters).not.toBe(original[2].meters);
    for (let i = 0; i < original.length; i++) {
      expect(replayForecastDisplayHeightM(original[i].context, patch)).toBe(changed[i].meters);
    }
  });

  it('keeps seam inputs when the current blend ratio equals one', () => {
    const unity: BeachTerrainConfig = { ...beach,
      shoaling_factors: { version: 1, type: 'period_lookup', buckets: [{ tp_min_s: 0, tp_max_s: 999, factor: 0.6 }] },
    };
    const rows = generate(unity);
    expect(rows[1].context.handoff).not.toBeNull();
    const patch = { swell_access_factors: Array(72).fill(1) };
    const changed = generate({ ...unity, ...patch });
    expect(replayForecastDisplayHeightM(rows[2].context, patch)).toBe(changed[2].meters);
  });

  it.each([
    { cdipSigFt: 20, modelSwellM: 1, components: [], periodS: 14 },
    { nowcastAnchorM: 1, components: [], periodS: 14, allowCalibratedShoaling: true },
  ] satisfies DecomposedFaceHeightParams[])('captures selected scalar inputs including rejection and nowcast', (params) => {
    const rendered = toFaceHeightFeetDecomposedWithDebug({ ...params, beach });
    const context: ForecastDisplayReplayContext = {
      version: 1, generatedAt, forecastAt: generatedAt,
      base: { input: rendered.debug.replayInput!, supported: true }, handoff: null, unsupportedReason: null,
    };
    expect(replayForecastDisplayHeightM(context)).toBe(Math.round(parseFloat(rendered.value!) / METERS_TO_FEET * 1000) / 1000);
  });

  it('rejects missing, malformed, offset and conditional guardrail contexts', () => {
    const ctx = generate(beach)[2].context;
    expect(replayForecastDisplayHeightM(null)).toBeNull();
    expect(replayForecastDisplayHeightM({ ...ctx, version: 2 })).toBeNull();
    expect(replayForecastDisplayHeightM({ ...ctx, unsupportedReason: 'offset' })).toBeNull();
    expect(replayForecastDisplayHeightM({ ...ctx, base: { ...ctx.base, supported: false } })).toBeNull();
    expect(replayForecastDisplayHeightM({ ...ctx, handoff: { ...ctx.handoff,
      model: { ...ctx.handoff!.model, supported: false } } })).toBeNull();
    expect(replayForecastDisplayHeightM({ ...ctx, handoff: { ...ctx.handoff,
      cdip: { ...ctx.handoff!.cdip, forecastAt: '2027-01-01T00:00:00Z' } } })).toBeNull();
    expect(replayForecastDisplayHeightM(ctx, { swell_access_factors: [NaN] })).toBeNull();
    expect(replayForecastDisplayHeightM(ctx, { deepwater_decay_factor: 0.6 })).toBeNull();
  });

  it('freezes configuration before later caller mutation', () => {
    const config = { ...beach, swell_access_factors: Array(72).fill(0.25) };
    const rows = generate(config);
    config.swell_access_factors.fill(0);
    expect(rows[2].context.base.input.beach.swell_access_factors).toEqual(Array(72).fill(0.25));
    expect(replayForecastDisplayHeightM(rows[2].context)).toBe(rows[2].meters);
  });
});
