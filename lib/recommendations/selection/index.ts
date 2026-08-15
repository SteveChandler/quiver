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
import { createContextLogger } from "@/lib/logger";

const log = createContextLogger("RecommendationSelection");

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

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return typeof error === "string" ? error : JSON.stringify(error);
}

type ProbeFailureCause =
  | "invalid_as_of"
  | "invalid_candidate_window"
  | "resolver_returned_unresolved"
  | "invalid_resolved_payload"
  | "resolver_threw";

/**
 * The cause goes in the message, not just the context: log sinks that render
 * only the message string would otherwise turn a DB error, a timeout, and bad
 * input into the same indistinguishable line.
 */
function warnProbeFailed(
  cause: ProbeFailureCause,
  context: Record<string, unknown>,
): void {
  log.warn(
    `Water-quality hold probe failed (${cause}); treating as no holds known`,
    { cause, ...context },
  );
}

/**
 * Beach ids with a *resolved* water-quality closure.
 *
 * Fail-open by design: an unreachable, malformed, or throwing probe means "no
 * holds are known", so the caller suppresses nothing. Only a resolved closure
 * — a real posted advisory — ever removes a beach.
 *
 * Every failure is logged at `warn` with its specific cause. `lib/logger`
 * raises the minimum level to `warn` in deployed environments, so a `debug`
 * line here would be invisible in production, and a cause-less log makes a DB
 * error, a timeout, and bad input indistinguishable.
 */
async function resolveSafeBeachIds<T extends { id: string }>(
  candidates: readonly T[],
  options?: { asOf?: Date },
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();

  const asOf = validAsOf(options?.asOf);
  if (asOf === null) {
    warnProbeFailed("invalid_as_of", {
      asOf: options?.asOf,
      candidateCount: candidates.length,
    });
    return new Set();
  }

  const holdCandidates = buildHoldCandidates(candidates, asOf);
  if (holdCandidates === null) {
    warnProbeFailed("invalid_candidate_window", {
      asOf: asOf.toISOString(),
      candidateCount: candidates.length,
    });
    return new Set();
  }

  try {
    const resolution = await resolveWaterQualityHolds(holdCandidates);
    if (resolution.state === "unresolved") {
      warnProbeFailed("resolver_returned_unresolved", {
        candidateCount: candidates.length,
        epoch: resolution.epoch,
      });
      return new Set();
    }
    const heldBeachIds = resolvedHeldBeachIds(resolution);
    if (heldBeachIds === null) {
      warnProbeFailed("invalid_resolved_payload", {
        candidateCount: candidates.length,
        heldBeachIds: resolution.heldBeachIds,
      });
      return new Set();
    }
    return heldBeachIds;
  } catch (error) {
    warnProbeFailed("resolver_threw", {
      candidateCount: candidates.length,
      error: describeError(error),
    });
    return new Set();
  }
}

function brand<T>(candidate: T): RankedBeach<T> {
  return candidate as RankedBeach<T>;
}

export async function rankBeaches<T extends { id: string }>(
  candidates: readonly T[],
  opts: {
    compare: (a: T, b: T) => number;
    asOf?: Date;
  },
): Promise<RankedBeach<T>[]> {
  const heldBeachIds = await resolveSafeBeachIds(candidates, opts);

  return candidates
    .filter((candidate) => !heldBeachIds.has(candidate.id.toLowerCase()))
    .slice()
    .sort(opts.compare)
    .map((candidate) => brand(candidate));
}

export async function selectBeach<T extends { id: string }>(
  candidate: T | null | undefined,
  opts?: { asOf?: Date },
): Promise<RankedBeach<T> | null> {
  if (candidate == null) return null;

  const heldBeachIds = await resolveSafeBeachIds([candidate], opts);
  if (heldBeachIds.has(candidate.id.toLowerCase())) {
    return null;
  }
  return brand(candidate);
}
