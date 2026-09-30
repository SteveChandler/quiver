import type { CanonicalWeekScoutResponse } from '@/lib/services/discovery/week-scout';
import weekScoutContractFixtureJson from './week-scout-contract-v1.json';

export const WEEK_SCOUT_CONTRACT_BEACH_ID = '11111111-1111-4111-8111-111111111111';
export const WEEK_SCOUT_CONTRACT_GENERATED_AT = '2026-07-15T18:00:00.000Z';

export const WEEK_SCOUT_CONTRACT_FIXTURE = (
  weekScoutContractFixtureJson as unknown as CanonicalWeekScoutResponse
);

const PERSONAL_VERDICT_FOR_VERDICT = { worth_it: 'go', maybe: 'maybe', skip: 'no' } as const;
const PERSONAL_LABELS_FOR_PERSONAL_VERDICT = {
  go: ['EPIC', 'GOOD'],
  maybe: ['FAIR', 'RIDEABLE'],
  no: ['MEH'],
} as const;

interface PersonalCallHolder {
  verdict: 'worth_it' | 'maybe' | 'skip' | null;
  personalVerdict?: unknown;
  personalLabel?: unknown;
}

/**
 * The additive personal-call contract the native app reads: `personalVerdict`
 * ('go' | 'maybe' | 'no', the vocabulary of /api/surf/call `sessionDecision.verdict`)
 * and `personalLabel` ('EPIC' | 'GOOD' | 'FAIR' | 'RIDEABLE' | 'MEH') sit on every
 * window and ranked spot that carries a verdict, and on none that does not. The
 * verdict maps onto it (worth_it = go, maybe = maybe, skip = no) and the label
 * stays inside its tier: a maybe never reads above FAIR, a go never below GOOD.
 */
export function weekScoutPersonalCallViolations(response: {
  days: Array<{
    windows: Array<PersonalCallHolder & { id: string; rankedSpots: Array<PersonalCallHolder & { beachId: string }> }>;
  }>;
}): string[] {
  const violations: string[] = [];
  const check = (where: string, holder: PersonalCallHolder): void => {
    if (holder.verdict === null) {
      if (holder.personalVerdict !== undefined || holder.personalLabel !== undefined) {
        violations.push(`${where}: no verdict, so no personal call`);
      }
      return;
    }
    const expected = PERSONAL_VERDICT_FOR_VERDICT[holder.verdict];
    if (holder.personalVerdict !== expected) {
      violations.push(`${where}: personalVerdict ${String(holder.personalVerdict)} is not ${expected}`);
      return;
    }
    const labels: readonly unknown[] = PERSONAL_LABELS_FOR_PERSONAL_VERDICT[expected];
    if (!labels.includes(holder.personalLabel)) {
      violations.push(`${where}: personalLabel ${String(holder.personalLabel)} is outside the ${expected} tier`);
    }
  };
  for (const day of response.days) {
    for (const window of day.windows) {
      check(`window ${window.id}`, window);
      window.rankedSpots.forEach((spot) => check(`window ${window.id} spot ${spot.beachId}`, spot));
    }
  }
  return violations;
}
