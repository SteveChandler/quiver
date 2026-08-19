/**
 * Dev-only override: lets us force a YES / MAYBE / NO verdict on a
 * surf-call result so we can visually verify each branch in sim and web
 * without waiting for real-world conditions to cooperate.
 *
 * The caller is responsible for only setting `isDev` to true when
 * `process.env.NODE_ENV !== 'production'`.
 */

import type { SpotSurfReportResult } from '@/lib/services/spot-surf-report-service';
import {
  narrowWindowAroundPeak,
  type SurfCallVerdict,
} from '@/lib/utils/surf-call-logic';

const VALID_VERDICTS: readonly SurfCallVerdict[] = ['YES', 'MAYBE', 'NO'];

function isValidVerdict(value: string): value is SurfCallVerdict {
  return (VALID_VERDICTS as readonly string[]).includes(value);
}

export function applyForceVerdict(
  result: SpotSurfReportResult | null,
  forceVerdict: string | null,
  isDev: boolean,
): SpotSurfReportResult | null {
  if (!result || !forceVerdict || !isDev) return result;
  if (!isValidVerdict(forceVerdict)) return result;
  if (result.report.recommendationAvailability.state === 'none') return result;
  if (
    forceVerdict !== 'NO' &&
    (!result.report.bestWindowStart || !result.report.bestWindowEnd)
  ) {
    return result;
  }

  const verdict = forceVerdict;
  const report = { ...result.report, verdict };

  // Mirror computeSurfCall's verdict gating on bestWindow so a forced
  // verdict produces a consistent visual (NO → suppressed row, MAYBE →
  // narrowed ±1h, YES → wide window unchanged).
  if (verdict === 'NO') {
    report.bestWindowStart = null;
    report.bestWindowEnd = null;
  } else if (verdict === 'MAYBE' && result.report.peakTime) {
    const peakTime = new Date(result.report.peakTime);
    if (!isNaN(peakTime.getTime())) {
      const rawStart = result.report.bestWindowStart ? new Date(result.report.bestWindowStart) : null;
      const rawEnd = result.report.bestWindowEnd ? new Date(result.report.bestWindowEnd) : null;
      if (rawStart && rawEnd) {
        const narrow = narrowWindowAroundPeak(peakTime, rawStart, rawEnd);
        report.bestWindowStart = narrow.start.toISOString();
        report.bestWindowEnd = narrow.end.toISOString();
      }
    }
  }

  return { ...result, report };
}
