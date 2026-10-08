import { trackFallback, FallbackEvent } from './fallback-tracker';

type FallbackTracking = Pick<FallbackEvent, 'severity' | 'reason'>;

/**
 * Track and resolve a missing confidence score.
 * Returns the score if present, otherwise tracks fallback and returns 50.
 * `tracking` lets a caller whose forecast cannot have a stored score say so
 * (lower severity plus a reason) instead of raising the default alert.
 */
export function resolveConfidence(
  score: number | null | undefined,
  domain: 'forecast' | 'discovery',
  context?: FallbackEvent['context'],
  tracking?: FallbackTracking
): number {
  if (score == null) {
    trackFallback({
      domain,
      field: 'confidence_score',
      fallbackValue: 50,
      context,
      ...tracking,
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
