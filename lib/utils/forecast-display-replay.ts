import { z } from 'zod';
import { transformToFaceHeightDecomposed, type BeachTerrainConfig } from './wave-height-transformer';
import { WAVE_HEIGHT_SOURCE_TAG_SET, type WaveHeightSourceTag } from './wave-height-source';
import { clampWaveHeight, roundWaveHeight } from './wave-formatters';
import { createForecastHandoffBlendState, processForecastHandoffBlendSlot } from './forecast-handoff-blend';
import { METERS_TO_FEET } from './unit-conversions';

const finite = z.number().finite();
const nullableFinite = finite.nullable();
const beachSchema = z.object({
  terrain_enabled: z.boolean().optional(),
  swell_access_factors: z.array(finite.min(0).max(1)).length(72).nullable().optional(),
  swell_window_center_deg: nullableFinite.optional(),
  swell_window_halfwidth_deg: nullableFinite.optional(),
  deepwater_decay_factor: nullableFinite.optional(),
  shoaling_factors: z.object({
    type: z.literal('period_lookup'),
    version: z.literal(1),
    buckets: z.array(z.object({ tp_min_s: finite, tp_max_s: finite, factor: finite })),
  }).nullable().optional(),
});
const inputSchema = z.object({
  beach: beachSchema,
  source: z.custom<WaveHeightSourceTag>((v) => typeof v === 'string' && WAVE_HEIGHT_SOURCE_TAG_SET.has(v as WaveHeightSourceTag)),
  rawHeightFt: finite.nonnegative(),
  periodS: nullableFinite,
  swellDirectionDeg: nullableFinite,
  allowCalibratedShoaling: z.boolean().optional(),
  components: z.array(z.object({
    heightFt: finite.nonnegative(), periodS: finite, directionDeg: nullableFinite,
    partition: z.enum(['swell', 'wind_wave']).optional(),
  }).nullable()).max(3),
});
const slotSchema = z.object({ input: inputSchema, supported: z.boolean() });
const endpointSchema = slotSchema.extend({ forecastAt: z.string().datetime({ offset: true }) });
// ponytail: v1 excludes conditional guardrails, offsets and decay overrides; version their replay before admitting them.
const contextSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  forecastAt: z.string().datetime({ offset: true }),
  base: slotSchema,
  handoff: z.object({ cdip: endpointSchema, model: endpointSchema }).nullable(),
  unsupportedReason: z.enum(['offset', 'missing-handoff']).nullable(),
});

export type ForecastReplayInput = z.infer<typeof inputSchema>;
export type ForecastReplaySlot = z.infer<typeof slotSchema>;
export type ForecastReplayHandoff = NonNullable<z.infer<typeof contextSchema>['handoff']>;
export type ForecastDisplayReplayContext = z.infer<typeof contextSchema>;

export function parseForecastDisplayReplayContext(value: unknown): ForecastDisplayReplayContext | null {
  const parsed = contextSchema.safeParse(value);
  if (!parsed.success) return null;
  const ctx = parsed.data;
  if (ctx.handoff && (Date.parse(ctx.handoff.cdip.forecastAt) > Date.parse(ctx.handoff.model.forecastAt) ||
    Date.parse(ctx.handoff.model.forecastAt) > Date.parse(ctx.forecastAt))) return null;
  if (ctx.handoff && (!['cdip_sig', 'cdip_swell'].includes(ctx.handoff.cdip.input.source) ||
    !['model_swell', 'model_hs'].includes(ctx.handoff.model.input.source) ||
    !['model_swell', 'model_hs'].includes(ctx.base.input.source))) return null;
  return ctx;
}

export function replayForecastDisplayHeightM(value: unknown, overrides: BeachTerrainConfig = {}): number | null {
  const ctx = parseForecastDisplayReplayContext(value);
  const patch = beachSchema.safeParse(overrides);
  if (!ctx || !patch.success || patch.data.deepwater_decay_factor !== undefined ||
    ctx.unsupportedReason || !ctx.base.supported ||
    (ctx.handoff && (!ctx.handoff.cdip.supported || !ctx.handoff.model.supported))) return null;
  const transform = (input: ForecastReplayInput): number => roundWaveHeight(clampWaveHeight(
    transformToFaceHeightDecomposed({ ...input, beach: { ...input.beach, ...patch.data } }).faceHeightFt,
  ));
  let ft = transform(ctx.base.input);
  if (ctx.handoff) {
    const { cdip, model } = ctx.handoff;
    const state = createForecastHandoffBlendState();
    for (const endpoint of [cdip, model]) {
      processForecastHandoffBlendSlot({ state, enabled: true, slot: {
        forecastAt: endpoint.forecastAt, waveHeight: `${transform(endpoint.input)} ft`,
        dataSource: endpoint === cdip ? 'CDIP' : 'NOAA_NWS', waveHeightSource: endpoint.input.source,
      } });
    }
    const step = processForecastHandoffBlendSlot({ state, enabled: true, slot: {
      forecastAt: ctx.forecastAt, waveHeight: `${ft} ft`, dataSource: 'NOAA_NWS',
      waveHeightSource: ctx.base.input.source,
    } });
    if (step.adjustment) ft = Number.parseFloat(step.adjustment.waveHeight);
  }
  return Math.round(ft / METERS_TO_FEET * 1000) / 1000;
}
