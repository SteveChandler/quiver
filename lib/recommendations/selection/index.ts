import "server-only";

/**
 * RankedBeach is a cooperative, compile-time-only brand: it does not survive
 * JSON and cannot prevent an explicit caller assertion. That is intentional;
 * the invariant is accidental-leak prevention, not a runtime security boundary.
 * The greppable audit surface for deliberate escapes is `as RankedBeach` or
 * `as unknown as` at a caller. Normal consumers must obtain the brand through
 * rankBeaches or selectBeach.
 */

import {
  resolveWaterQualityHolds,
  type WaterQualityHoldResolution,
} from "@/lib/recommendations/major-event-hold/water-quality";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";

declare const RankedBrand: unique symbol;
export type RankedBeach<T> = T & { readonly [RankedBrand]: true };

function validAsOf(asOf: Date | undefined): Date | null {
  const value = asOf ?? new Date();
  return Number.isFinite(value.getTime()) ? value : null;
}

function buildHoldCandidates<T extends { id: string }>(
  candidates: readonly T[],
  asOf: Date,
): MajorEventHoldCandidate[] | null {
  const startsAt = asOf.getTime();
  const endsAt = startsAt + 1;
  if (!Number.isFinite(endsAt)) return null;

  return candidates.map((candidate, index) => ({
    candidateId: `selection:${index}`,
    beachId: candidate.id,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  }));
}

function resolvedHeldBeachIds(
  resolution: WaterQualityHoldResolution,
): Set<string> | null {
  if (resolution.state !== "resolved") return null;
  if (
    !Array.isArray(resolution.heldBeachIds) ||
    resolution.heldBeachIds.some((beachId) => typeof beachId !== "string")
  ) {
    return null;
  }
  return new Set(resolution.heldBeachIds.map((beachId) => beachId.toLowerCase()));
}

async function resolveSafeBeachIds<T extends { id: string }>(
  candidates: readonly T[],
  options?: { asOf?: Date },
): Promise<Set<string> | null> {
  if (candidates.length === 0) return new Set();

  const asOf = validAsOf(options?.asOf);
  if (asOf === null) return null;

  const holdCandidates = buildHoldCandidates(candidates, asOf);
  if (holdCandidates === null) return null;

  try {
    const resolution = await resolveWaterQualityHolds(holdCandidates);
    return resolvedHeldBeachIds(resolution);
  } catch {
    return null;
  }
}

function brand<T>(candidate: T): RankedBeach<T> {
  return candidate as RankedBeach<T>;
}

export async function rankBeaches<T extends { id: string }>(
  candidates: readonly T[],
  opts: { compare: (a: T, b: T) => number; asOf?: Date },
): Promise<RankedBeach<T>[]> {
  const heldBeachIds = await resolveSafeBeachIds(candidates, opts);
  if (heldBeachIds === null) return [];

  return candidates
    .filter((candidate) => !heldBeachIds.has(candidate.id.toLowerCase()))
    .slice()
    .sort(opts.compare)
    .map(brand);
}

export async function selectBeach<T extends { id: string }>(
  candidate: T | null | undefined,
  opts?: { asOf?: Date },
): Promise<RankedBeach<T> | null> {
  if (candidate == null) return null;

  const heldBeachIds = await resolveSafeBeachIds([candidate], opts);
  if (heldBeachIds === null || heldBeachIds.has(candidate.id.toLowerCase())) {
    return null;
  }
  return brand(candidate);
}
