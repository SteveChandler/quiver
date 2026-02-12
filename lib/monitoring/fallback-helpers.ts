import { trackFallback, FallbackEvent } from './fallback-tracker';

/**
 * Generic fallback-with-tracking helper. Returns `value` if non-null,
 * otherwise tracks the fallback and returns `fallbackValue`.
 * Replaces the comma-operator pattern: `value ?? (trackFallback(...), default)`
 */
export function withFallbackTracking<T extends string | number | null>(
  value: T | null | undefined,
  fallbackValue: T,
  tracking: Omit<FallbackEvent, 'fallbackValue' | 'severity'> & { severity?: FallbackEvent['severity'] }
): T {
  if (value == null) {
    trackFallback({ ...tracking, fallbackValue });
    return fallbackValue;
  }
  return value;
}

/**
 * Track and resolve a missing confidence score.
 * Returns the score if present, otherwise tracks fallback and returns 50.
 */
export function resolveConfidence(
  score: number | null | undefined,
  domain: 'forecast' | 'discovery',
  context?: FallbackEvent['context']
): number {
  if (score == null) {
    trackFallback({
      domain,
      field: 'confidence_score',
      fallbackValue: 50,
      context,
    });
    return 50;
  }
  return score;
}

/**
 * Track and resolve a missing tide height.
 * Returns the height if present, otherwise tracks fallback and returns 0.
 */
export function resolveTideHeight(
  heightFt: number | string | null | undefined,
  context?: FallbackEvent['context']
): number {
  const parsed = typeof heightFt === 'string' ? parseFloat(heightFt) : heightFt;
  if (parsed == null || isNaN(parsed)) {
    trackFallback({
      domain: 'tide-analyzer',
      field: 'tide_height',
      fallbackValue: 0,
      context,
    });
    return 0;
  }
  return parsed;
}
