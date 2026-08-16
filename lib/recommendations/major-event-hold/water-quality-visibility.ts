import "server-only";

import {
  resolveWaterQualityHolds,
  type WaterQualityHoldResolution,
} from "./water-quality";
import type { MajorEventHoldCandidate } from "./types";

const VISIBILITY_WINDOW_START = "1970-01-01T00:00:00.000Z";
const VISIBILITY_WINDOW_END = "9999-12-31T23:59:59.999Z";

export interface WaterQualityVisibilityResolution {
  state: "resolved" | "unresolved";
  visibleBeachIds: string[];
  heldBeachIds: string[];
  epoch: string;
}

export interface WaterQualityVisibilityOptions {
  resolveHolds?: (
    candidates: readonly MajorEventHoldCandidate[],
  ) => Promise<WaterQualityHoldResolution>;
}

function unresolvedResolution(): WaterQualityVisibilityResolution {
  return {
    state: "unresolved",
    visibleBeachIds: [],
    heldBeachIds: [],
    epoch: "water-quality-visibility:unresolved",
  };
}

function candidateForBeachId(beachId: string): MajorEventHoldCandidate {
  return {
    candidateId: `water-quality-visibility:${beachId}`,
    beachId,
    startsAt: VISIBILITY_WINDOW_START,
    endsAt: VISIBILITY_WINDOW_END,
  };
}

export async function resolveBeachVisibility(
  beachIds: readonly string[],
  options: WaterQualityVisibilityOptions = {},
): Promise<WaterQualityVisibilityResolution> {
  if (beachIds.some((beachId) => typeof beachId !== "string")) {
    return unresolvedResolution();
  }
  const requestedBeachIds = [
    ...new Set(beachIds.map((beachId) => beachId.toLowerCase())),
  ];
  if (requestedBeachIds.length === 0) {
    return {
      state: "resolved",
      visibleBeachIds: [],
      heldBeachIds: [],
      epoch: "water-quality-visibility:empty",
    };
  }

  try {
    const resolution = await (
      options.resolveHolds ?? resolveWaterQualityHolds
    )(requestedBeachIds.map(candidateForBeachId));
    if (resolution.state === "unresolved") return unresolvedResolution();

    const heldBeachIds = [
      ...new Set(
        resolution.heldBeachIds.map((beachId) => beachId.toLowerCase()),
      ),
    ];
    const heldBeachIdSet = new Set(heldBeachIds);
    return {
      state: "resolved",
      visibleBeachIds: requestedBeachIds.filter(
        (beachId) => !heldBeachIdSet.has(beachId),
      ),
      heldBeachIds,
      epoch: resolution.epoch,
    };
  } catch (error) {
    console.error("[water-quality-visibility:resolution-failed]", {
      beachCount: requestedBeachIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return unresolvedResolution();
  }
}

export async function filterBeachesByWaterQualityVisibility<
  T extends { id: string },
>(
  beaches: readonly T[],
  options: WaterQualityVisibilityOptions = {},
): Promise<T[]> {
  if (beaches.length === 0) return [];

  const resolution = await resolveBeachVisibility(
    beaches.map(({ id }) => id),
    options,
  );
  if (resolution.state === "unresolved") return [];

  const visibleBeachIds = new Set(resolution.visibleBeachIds);
  return beaches.filter(({ id }) => visibleBeachIds.has(id.toLowerCase()));
}
