/**
 * Request-scoped memo for pure domain scoring.
 *
 * One discovery or Week Scout request scores the same row for the same beach many times: the
 * window selector, the slot scores, the representative score. Inside a scope the spot profile is
 * built once per beach object and the null-window composite once per (forecast, beach) object
 * pair; outside a scope nothing is cached. Keys are object identities, so a copied beach or row
 * only misses, never reads another's result. Flags are read per request, so within one scope
 * they do not change.
 *
 * This module stays free of Node APIs because client code imports the scorers; the server scope
 * that supplies the store lives in `scoring-memo-scope.ts`.
 */

import type { SpotProfile } from '@/lib/domains/spot-profile/types';
import type { CompositeScore } from './types';

export interface ScoringMemo {
  profiles: WeakMap<object, SpotProfile>;
  composites: WeakMap<object, WeakMap<object, CompositeScore>>;
}

let memoSource: () => ScoringMemo | undefined = () => undefined;

export function createScoringMemo(): ScoringMemo {
  return { profiles: new WeakMap(), composites: new WeakMap() };
}

/** Called once by the server scope module. */
export function installScoringMemoSource(source: () => ScoringMemo | undefined): void {
  memoSource = source;
}

export function memoizedSpotProfile(beach: object, build: () => SpotProfile): SpotProfile {
  const memo = memoSource();
  if (!memo) return build();
  const cached = memo.profiles.get(beach);
  if (cached) return cached;
  const profile = build();
  memo.profiles.set(beach, profile);
  return profile;
}

export function memoizedComposite(forecast: object, beach: object, score: () => CompositeScore): CompositeScore {
  const memo = memoSource();
  if (!memo) return score();
  let byBeach = memo.composites.get(forecast);
  const cached = byBeach?.get(beach);
  if (cached) return cached;
  const composite = score();
  if (!byBeach) {
    byBeach = new WeakMap();
    memo.composites.set(forecast, byBeach);
  }
  byBeach.set(beach, composite);
  return composite;
}
