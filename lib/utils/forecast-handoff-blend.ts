import type { ForecastReplaySlot, ForecastReplayHandoff } from './forecast-display-replay';
import type { WaveHeightSourceTag } from "./wave-height-source";

const HANDOFF_BLEND_RATIO_MIN = 0.5;
const HANDOFF_BLEND_RATIO_MAX = 2.0;
const DEFAULT_HANDOFF_BLEND_TAPER_HOURS = 48;

interface ForecastHandoffBlendSlot {
  replay?: ForecastReplaySlot;
  forecastAt: string;
  waveHeight: string | null;
  dataSource: string | null;
  waveHeightSource: WaveHeightSourceTag | null;
}

interface HandoffAnchor {
  replay?: ForecastReplaySlot;
  forecastAt: string;
  forecastAtMs: number;
  faceFt: number;
}

export interface ForecastHandoffBlendState {
  lastCdip: HandoffAnchor | null;
  seam: ForecastHandoffDiscontinuityMetric | null;
  replay?: ForecastReplayHandoff;
}

export interface ForecastHandoffDiscontinuityMetric {
  cdipForecastAt: string;
  modelForecastAt: string;
  cdipFaceFt: number;
  modelFaceFt: number;
  handoffDiscontinuityFt: number;
  rawRatio: number;
  clampedRatio: number;
}

export interface ForecastHandoffBlendMetadata
  extends ForecastHandoffDiscontinuityMetric {
  taperHours: number;
  hoursAfterSeam: number;
  taperFactor: number;
  originalFaceFt: number;
  blendedFaceFt: number;
}

interface ForecastHandoffBlendAdjustment {
  waveHeight: string;
  metadata: ForecastHandoffBlendMetadata;
}

interface ForecastHandoffBlendStep {
  metric: ForecastHandoffDiscontinuityMetric | null;
  adjustment: ForecastHandoffBlendAdjustment | null;
}

export function createForecastHandoffBlendState(): ForecastHandoffBlendState {
  return {
    lastCdip: null,
    seam: null,
  };
}

function clampHandoffBlendRatio(ratio: number): number {
  return Math.min(
    HANDOFF_BLEND_RATIO_MAX,
    Math.max(HANDOFF_BLEND_RATIO_MIN, ratio),
  );
}

export function calculateForecastHandoffBlendFactor(args: {
  clampedRatio: number;
  hoursAfterSeam: number;
  taperHours?: number;
}): number {
  const taperHours = args.taperHours ?? DEFAULT_HANDOFF_BLEND_TAPER_HOURS;
  if (!Number.isFinite(args.clampedRatio) || args.clampedRatio <= 0) return 1;
  if (!Number.isFinite(args.hoursAfterSeam) || args.hoursAfterSeam < 0) {
    return 1;
  }
  if (!Number.isFinite(taperHours) || taperHours <= 0) return 1;
  if (args.hoursAfterSeam >= taperHours) return 1;

  const remaining = 1 - args.hoursAfterSeam / taperHours;
  return 1 + (args.clampedRatio - 1) * remaining;
}

export function processForecastHandoffBlendSlot(args: {
  state: ForecastHandoffBlendState;
  slot: ForecastHandoffBlendSlot;
  enabled: boolean;
  taperHours?: number;
}): ForecastHandoffBlendStep {
  const faceFt = parsePositiveSingleFaceHeight(args.slot.waveHeight);
  const forecastAtMs = Date.parse(args.slot.forecastAt);
  if (faceFt == null || !Number.isFinite(forecastAtMs)) {
    resetForecastHandoffBlendState(args.state);
    return { metric: null, adjustment: null };
  }

  if (isCdipDerivedSlot(args.slot)) {
    args.state.lastCdip = {
      forecastAt: args.slot.forecastAt,
      forecastAtMs,
      faceFt,
      ...(args.slot.replay ? { replay: args.slot.replay } : {}),
    };
    args.state.seam = null;
    delete args.state.replay;
    return { metric: null, adjustment: null };
  }

  if (!isModelDerivedSlot(args.slot)) {
    resetForecastHandoffBlendState(args.state);
    return { metric: null, adjustment: null };
  }

  const metric = args.state.seam ?? buildMetric(args.state.lastCdip, {
    forecastAt: args.slot.forecastAt,
    forecastAtMs,
    faceFt,
  });

  if (!metric) {
    return { metric: null, adjustment: null };
  }

  const isNewMetric = args.state.seam == null;
  args.state.seam = metric;
  if (isNewMetric) {
    delete args.state.replay;
    if (args.state.lastCdip?.replay && args.slot.replay) {
      args.state.replay = {
        cdip: { ...args.state.lastCdip.replay, forecastAt: metric.cdipForecastAt },
        model: { ...args.slot.replay, forecastAt: metric.modelForecastAt },
      };
    }
  }

  if (!args.enabled) {
    return { metric: isNewMetric ? metric : null, adjustment: null };
  }

  const hoursAfterSeam =
    (forecastAtMs - Date.parse(metric.modelForecastAt)) / 3_600_000;
  const taperHours = args.taperHours ?? DEFAULT_HANDOFF_BLEND_TAPER_HOURS;
  const taperFactor = calculateForecastHandoffBlendFactor({
    clampedRatio: metric.clampedRatio,
    hoursAfterSeam,
    taperHours,
  });

  if (taperFactor === 1) {
    return { metric: isNewMetric ? metric : null, adjustment: null };
  }

  const blendedFaceFt = roundOneDecimal(faceFt * taperFactor);
  if (!Number.isFinite(blendedFaceFt) || blendedFaceFt <= 0) {
    return { metric: isNewMetric ? metric : null, adjustment: null };
  }

  return {
    metric: isNewMetric ? metric : null,
    adjustment: {
      waveHeight: `${blendedFaceFt} ft`,
      metadata: {
        ...metric,
        taperHours,
        hoursAfterSeam: roundThreeDecimals(hoursAfterSeam),
        taperFactor: roundThreeDecimals(taperFactor),
        originalFaceFt: faceFt,
        blendedFaceFt,
      },
    },
  };
}

function resetForecastHandoffBlendState(state: ForecastHandoffBlendState): void {
  delete state.replay;
  state.lastCdip = null;
  state.seam = null;
}

function buildMetric(
  cdip: HandoffAnchor | null,
  model: HandoffAnchor,
): ForecastHandoffDiscontinuityMetric | null {
  if (!cdip) return null;
  if (model.forecastAtMs < cdip.forecastAtMs) return null;
  if (cdip.faceFt <= 0 || model.faceFt <= 0) return null;

  const rawRatio = cdip.faceFt / model.faceFt;
  if (!Number.isFinite(rawRatio) || rawRatio <= 0) return null;

  return {
    cdipForecastAt: cdip.forecastAt,
    modelForecastAt: model.forecastAt,
    cdipFaceFt: cdip.faceFt,
    modelFaceFt: model.faceFt,
    handoffDiscontinuityFt: roundOneDecimal(cdip.faceFt - model.faceFt),
    rawRatio: roundThreeDecimals(rawRatio),
    clampedRatio: roundThreeDecimals(clampHandoffBlendRatio(rawRatio)),
  };
}

function isCdipDerivedSlot(slot: ForecastHandoffBlendSlot): boolean {
  return (
    isCdipDataSource(slot.dataSource) &&
    (slot.waveHeightSource === "cdip_sig" ||
      slot.waveHeightSource === "cdip_swell")
  );
}

function isModelDerivedSlot(slot: ForecastHandoffBlendSlot): boolean {
  return (
    !isCdipDataSource(slot.dataSource) &&
    (slot.waveHeightSource === "model_swell" ||
      slot.waveHeightSource === "model_hs")
  );
}

function isCdipDataSource(dataSource: string | null): boolean {
  return dataSource?.toUpperCase().startsWith("CDIP") === true;
}

function parsePositiveSingleFaceHeight(value: string | null): number | null {
  if (value == null) return null;
  const stripped = value.trim().toLowerCase().replace(/\s*ft\s*$/, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(stripped)) return null;

  const parsed = Number(stripped);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
}
