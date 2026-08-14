/**
 * NPC beach selection.
 *
 * The home/secondary/adventure split is retained for local credibility. When
 * a traffic snapshot is available, the beach inside that split is sampled by
 * weight instead of uniformly.
 */

import { selectBeach } from "@/lib/recommendations/selection";

export const DEFAULT_TRAFFIC_FLOOR = 1;
export const DEFAULT_MAX_BEACH_SHARE = 0.12;

export interface BeachTrafficWeight {
  beachId: string;
  views30d: number;
  weight: number;
  computedAt: string | null;
  marketKey?: string;
  allocationTier?: "proven" | "adjacent" | "exploration";
}

export interface BeachSelectionRun {
  targetPosts: number;
  maxBeachShare: number;
  counts: Map<string, number>;
  total: number;
}

export interface NPCBeachConfig {
  homeBeachIds: string[];
  secondaryBeaches: string[];
  homeRegion: string;
  trafficWeights?: readonly BeachTrafficWeight[];
  random?: () => number;
  floorWeight?: number;
  maxBeachShare?: number;
  selectionRun?: BeachSelectionRun;
  excludedIds?: ReadonlySet<string>;
}

export function createBeachSelectionRun(
  targetPosts: number,
  maxBeachShare: number = DEFAULT_MAX_BEACH_SHARE,
): BeachSelectionRun {
  return {
    targetPosts: Math.max(1, Math.floor(targetPosts)),
    maxBeachShare: clampShare(maxBeachShare),
    counts: new Map<string, number>(),
    total: 0,
  };
}

export function recordBeachSelection(
  run: BeachSelectionRun | undefined,
  beachId: string,
): void {
  if (!run) return;
  const normalizedId = beachId.toLowerCase();
  run.counts.set(normalizedId, (run.counts.get(normalizedId) ?? 0) + 1);
  run.total += 1;
}

/**
 * Select a beach while retaining the established 50/35/15 local mix.
 * `random` is injectable so distribution tests do not depend on ambient RNG.
 */
export function selectBeachForPost(config: NPCBeachConfig): string {
  const { homeBeachIds, secondaryBeaches } = config;
  if (!homeBeachIds.length) {
    throw new Error("NPC must have at least one home beach");
  }

  const allBeachIds = uniqueIds([...homeBeachIds, ...secondaryBeaches]);
  const excludedIds = config.excludedIds ?? new Set<string>();
  const eligibleAll = applyRunCap(
    allBeachIds.filter((id) => !excludedIds.has(id)),
    config.selectionRun,
  );
  if (!eligibleAll.length) {
    throw new Error("NPC has no eligible beaches for this selection run");
  }

  const eligibleHome = applyRunCap(
    uniqueIds(homeBeachIds).filter((id) => eligibleAll.includes(id)),
    config.selectionRun,
  );
  const eligibleSecondary = applyRunCap(
    uniqueIds(secondaryBeaches).filter((id) => eligibleAll.includes(id)),
    config.selectionRun,
  );

  const random = config.random ?? Math.random;
  const roll = normalizeRandom(random());
  let pool = eligibleAll;

  if (roll < 0.5 && eligibleHome.length > 0) {
    pool = eligibleHome;
  } else if (roll < 0.85 && eligibleSecondary.length > 0) {
    pool = eligibleSecondary;
  }

  const selectedId = pickWeighted(pool, config, random);
  return selectedId;
}

/**
 * Select and pass the chosen beach through the canonical recommendation
 * primitive. Held beaches are rejected and another candidate is sampled.
 */
export async function selectSafeBeachForPost(
  config: NPCBeachConfig,
): Promise<string | null> {
  const allBeachIds = uniqueIds([
    ...config.homeBeachIds,
    ...config.secondaryBeaches,
  ]);
  const excludedIds = new Set<string>(config.excludedIds ?? []);

  for (let attempt = 0; attempt < allBeachIds.length; attempt += 1) {
    let selectedId: string;
    try {
      selectedId = selectBeachForPost({ ...config, excludedIds });
    } catch {
      return null;
    }

    const selected = await selectBeach({ id: selectedId });
    if (selected) {
      recordBeachSelection(config.selectionRun, selected.id);
      return selected.id;
    }

    excludedIds.add(selectedId);
  }

  return null;
}

function pickWeighted(
  items: readonly string[],
  config: NPCBeachConfig,
  random: () => number,
): string {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty beach pool");
  }

  const weights = new Map(
    (config.trafficWeights ?? []).map((row) => [
      row.beachId.toLowerCase(),
      Math.max(config.floorWeight ?? DEFAULT_TRAFFIC_FLOOR, finiteWeight(row.weight)),
    ]),
  );
  const hasTrafficWeights = config.trafficWeights !== undefined;

  if (!hasTrafficWeights) {
    return items[Math.floor(normalizeRandom(random()) * items.length)];
  }

  const floor = Math.max(config.floorWeight ?? DEFAULT_TRAFFIC_FLOOR, 0);
  const totalWeight = items.reduce(
    (sum, id) => sum + Math.max(floor, weights.get(id.toLowerCase()) ?? floor),
    0,
  );
  let threshold = normalizeRandom(random()) * totalWeight;

  for (const id of items) {
    threshold -= Math.max(floor, weights.get(id.toLowerCase()) ?? floor);
    if (threshold < 0) return id;
  }

  return items[items.length - 1];
}

function applyRunCap(
  items: string[],
  run: BeachSelectionRun | undefined,
): string[] {
  if (!run || items.length <= 1) return items;

  const maxPerBeach = Math.max(
    1,
    Math.ceil(run.targetPosts * run.maxBeachShare),
  );
  const belowCap = items.filter(
    (id) => (run.counts.get(id.toLowerCase()) ?? 0) < maxPerBeach,
  );

  // If the configured candidate pool is too small to satisfy the cap, keep
  // posting rather than silently dropping the cron run.
  return belowCap.length > 0 ? belowCap : items;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

function finiteWeight(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 0.9999999999999999);
}

function clampShare(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_BEACH_SHARE;
  return Math.min(1, Math.max(0.01, value));
}
