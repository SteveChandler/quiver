import { formatWaveHeightRange } from "@/lib/formatters/surf-data";

export interface CompactSurfSummaryInput {
  waveHeight?: string | null;
  windSpeed?: string | null;
  windDirection?: string | null;
  windSummary?: string | null;
  swellPeriod?: string | null;
  swellDirection?: string | null;
  tideHeight?: string | null;
  tideStatus?: string | null;
  why?: string | null;
}

export interface CompactSurfSummary {
  waveHeightHeadline: string | null;
  windSummary: string | null;
  swellSummary: string | null;
  tideSummary: string | null;
  whySummary: string | null;
  supportingSegments: string[];
  conditionLine: string | null;
}

const RANGE_PATTERN =
  /^\s*(-?\d+(?:\.\d+)?)\s*(?:-|\u2013)\s*(-?\d+(?:\.\d+)?)\s*(ft|feet)?\s*$/i;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function compactSingleFeet(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  return formatWaveHeightRange(value);
}

export function formatCompactWaveHeight(raw: string | null | undefined): string | null {
  const text = clean(raw);
  if (!text) return null;

  const range = text.match(RANGE_PATTERN);
  if (range) {
    const low = Number.parseFloat(range[1]);
    const high = Number.parseFloat(range[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return text;

    const min = Math.min(low, high);
    const max = Math.max(low, high);
    const hasDecimalEndpoint = range[1].includes(".") || range[2].includes(".");
    const spread = max - min;

    if (hasDecimalEndpoint || spread > 3) {
      return compactSingleFeet((min + max) / 2);
    }

    return text;
  }

  const numeric = text.match(/-?\d+(?:\.\d+)?/);
  if (!numeric) return text;
  const value = Number.parseFloat(numeric[0]);
  return compactSingleFeet(value) ?? text;
}

function formatWindSummary(input: CompactSurfSummaryInput): string | null {
  const explicit = clean(input.windSummary);
  if (explicit) return /^wind\b/i.test(explicit) ? explicit : `Wind ${explicit}`;

  const speed = clean(input.windSpeed);
  const direction = clean(input.windDirection);
  if (!speed && !direction) return null;
  if (speed && /^0\s*(mph|kn)/i.test(speed)) return "Wind calm";

  const normalizedSpeed =
    speed && /mph|kn/i.test(speed) ? speed : speed ? `${speed} mph` : null;
  return ["Wind", direction, normalizedSpeed].filter(Boolean).join(" ");
}

function formatSwellSummary(input: CompactSurfSummaryInput): string | null {
  const period = clean(input.swellPeriod);
  const direction = clean(input.swellDirection);
  if (!period && !direction) return null;
  if (period && direction) return `Swell ${direction} @ ${period}`;
  if (direction) return `Swell ${direction}`;
  return `Swell ${period}`;
}

function formatTideSummary(input: CompactSurfSummaryInput): string | null {
  const height = clean(input.tideHeight);
  const status = clean(input.tideStatus);
  if (!height && !status) return null;
  return ["Tide", height, status].filter(Boolean).join(" ");
}

export function buildCompactSurfSummary(
  input: CompactSurfSummaryInput
): CompactSurfSummary {
  const waveHeightHeadline = formatCompactWaveHeight(input.waveHeight);
  const windSummary = formatWindSummary(input);
  const swellSummary = formatSwellSummary(input);
  const tideSummary = formatTideSummary(input);
  const whySummary = clean(input.why);
  const supportingSegments = [windSummary, swellSummary, tideSummary].filter(
    (segment): segment is string => Boolean(segment)
  );
  const conditionLineSegments = [
    waveHeightHeadline,
    ...supportingSegments,
  ].filter((segment): segment is string => Boolean(segment));

  return {
    waveHeightHeadline,
    windSummary,
    swellSummary,
    tideSummary,
    whySummary,
    supportingSegments,
    conditionLine:
      conditionLineSegments.length > 0 ? conditionLineSegments.join(" · ") : null,
  };
}
