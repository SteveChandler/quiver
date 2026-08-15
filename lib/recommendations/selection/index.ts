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
export type SelectionSafetyReason =
  | "water_quality_closure"
  | "hold_state_unavailable";
export type SafetyMarkedRankedBeach<T> = RankedBeach<T> & {
  readonly safetyOverrideReasons?: SelectionSafetyReason[];
};

type SafetyResolution =
  | { state: "resolved"; heldBeachIds: Set<string> }
  | { state: "unresolved"; reason: "hold_state_unavailable" };

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
): Promise<SafetyResolution> {
  if (candidates.length === 0) {
    return { state: "resolved", heldBeachIds: new Set() };
  }

  const asOf = validAsOf(options?.asOf);
  if (asOf === null) {
    log.warn("Water-quality hold resolution unavailable: invalid_as_of", {
      cause: "invalid_as_of",
      asOf: options?.asOf,
    });
    return { state: "unresolved", reason: "hold_state_unavailable" };
  }

  const holdCandidates = buildHoldCandidates(candidates, asOf);
  if (holdCandidates === null) {
    log.warn("Water-quality hold resolution unavailable: invalid_candidate_window", {
      cause: "invalid_candidate_window",
      asOf: asOf.toISOString(),
      candidateCount: candidates.length,
    });
    return { state: "unresolved", reason: "hold_state_unavailable" };
  }

  try {
    const resolution = await resolveWaterQualityHolds(holdCandidates);
    if (resolution.state === "unresolved") {
      log.warn("Water-quality hold resolution unavailable: resolver_returned_unresolved", {
        cause: "resolver_returned_unresolved",
        candidateCount: candidates.length,
        epoch: resolution.epoch,
      });
      return { state: "unresolved", reason: "hold_state_unavailable" };
    }
    const heldBeachIds = resolvedHeldBeachIds(resolution);
    if (heldBeachIds === null) {
      log.warn("Water-quality hold resolution unavailable: invalid_resolved_payload", {
        cause: "invalid_resolved_payload",
        candidateCount: candidates.length,
        heldBeachIds: resolution.heldBeachIds,
      });
      return { state: "unresolved", reason: "hold_state_unavailable" };
    }
    return { state: "resolved", heldBeachIds };
  } catch (error) {
    log.warn("Water-quality hold resolution unavailable: resolver_threw", {
      cause: "resolver_threw",
      candidateCount: candidates.length,
      error,
    });
    return { state: "unresolved", reason: "hold_state_unavailable" };
  }
}

function brand<T>(candidate: T): RankedBeach<T> {
  return candidate as RankedBeach<T>;
}

function withSafetyReason<T extends { id: string }>(
  candidate: T,
  reason: SelectionSafetyReason,
): T & { safetyOverrideReasons: SelectionSafetyReason[] } {
  const existing = (candidate as T & {
    safetyOverrideReasons?: readonly SelectionSafetyReason[];
  }).safetyOverrideReasons ?? [];
  return {
    ...candidate,
    safetyOverrideReasons: Array.from(new Set([...existing, reason])),
  };
}

export async function rankBeaches<T extends { id: string }>(
  candidates: readonly T[],
  opts: {
    compare: (a: T, b: T) => number;
    asOf?: Date;
    /** Only canonical decisions preserve blocked rows to explain their reason. */
    preserveSafetyReasons?: boolean;
    /**
     * Discovery treats an unresolved probe as a data gap, not a closure: keep
     * the candidates and mark them so the surface can disclose it. Genuine
     * resolved closures still filter out.
     */
    degradeOnUnresolvedHolds?: boolean;
  },
): Promise<SafetyMarkedRankedBeach<T>[]> {
  const resolution = await resolveSafeBeachIds(candidates, opts);
  if (resolution.state === "unresolved") {
    if (!opts.preserveSafetyReasons && !opts.degradeOnUnresolvedHolds) return [];
    return candidates
      .slice()
      .sort(opts.compare)
      .map((candidate) => brand(withSafetyReason(candidate, resolution.reason)));
  }

  return candidates
    .filter(
      (candidate) =>
        opts.preserveSafetyReasons ||
        !resolution.heldBeachIds.has(candidate.id.toLowerCase()),
    )
    .slice()
    .sort(opts.compare)
    .map((candidate) => {
      const isHeld = resolution.heldBeachIds.has(candidate.id.toLowerCase());
      return brand(
        opts.preserveSafetyReasons && isHeld
          ? withSafetyReason(candidate, "water_quality_closure")
          : candidate,
      );
    });
}

export async function selectBeach<T extends { id: string }>(
  candidate: T | null | undefined,
  opts?: { asOf?: Date },
): Promise<RankedBeach<T> | null> {
  if (candidate == null) return null;

  const resolution = await resolveSafeBeachIds([candidate], opts);
  if (
    resolution.state === "unresolved" ||
    resolution.heldBeachIds.has(candidate.id.toLowerCase())
  ) {
    return null;
  }
  return brand(candidate);
}
