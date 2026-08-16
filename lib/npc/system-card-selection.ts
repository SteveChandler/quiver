import { selectBeach } from "@/lib/recommendations/selection";
import {
  MAX_SYSTEM_CARDS_PER_BEACH_PER_DAY,
  MAX_SYSTEM_CARD_SHARE_7D,
  TARGET_SYSTEM_CARDS_PER_DAY,
} from "./system-card-config";
import type { SystemCardClass } from "./system-card-types";
import type { SystemCardCandidate } from "./system-cards";

export interface SystemCardSelectionRecord {
  beachId: string;
  contentClass: SystemCardClass | "legacy";
  createdAt: string;
}

export interface PlannedSystemCard {
  candidate: SystemCardCandidate;
  contentClass: SystemCardClass;
}

export interface SelectSystemCardCandidatesOptions {
  candidates: readonly SystemCardCandidate[];
  contentClasses: readonly SystemCardClass[];
  history: readonly SystemCardSelectionRecord[];
  asOf: Date;
  expectedSevenDayCards?: number;
  sequenceOffset?: number;
  random?: () => number;
  selectSafeBeach?: (candidate: SystemCardCandidate) => Promise<SystemCardCandidate | null>;
}

export async function selectSystemCardCandidates(
  options: SelectSystemCardCandidatesOptions,
): Promise<PlannedSystemCard[]> {
  const random = options.random ?? Math.random;
  const expectedSevenDayCards = options.expectedSevenDayCards ?? TARGET_SYSTEM_CARDS_PER_DAY * 7;
  const maxPerBeachSevenDays = Math.max(
    1,
    Math.ceil(expectedSevenDayCards * MAX_SYSTEM_CARD_SHARE_7D),
  );
  const selected: PlannedSystemCard[] = [];
  const workingHistory = [...options.history];
  const rejectedIds = new Set<string>();

  for (let index = 0; index < options.contentClasses.length; index += 1) {
    const contentClass = options.contentClasses[index];
    const targetTier = allocationTierForSlot(
      (options.sequenceOffset ?? 0) + index,
    );
    const eligible = options.candidates.filter((candidate) => {
      const normalizedId = candidate.id.toLowerCase();
      if (rejectedIds.has(normalizedId)) return false;
      if (!isWithinCaps(candidate, contentClass, workingHistory, options.asOf, maxPerBeachSevenDays)) {
        return false;
      }
      return true;
    });
    if (eligible.length === 0) break;

    const tierPool = eligible.filter(
      (candidate) => candidate.allocationTier === targetTier,
    );
    const candidate = pickWeighted(
      tierPool.length > 0 ? tierPool : eligible,
      random,
    );
    const safeBeach = await (options.selectSafeBeach ?? defaultSafeBeach)(candidate);
    if (!safeBeach) {
      rejectedIds.add(candidate.id.toLowerCase());
      index -= 1;
      if (rejectedIds.size >= options.candidates.length) break;
      continue;
    }

    selected.push({ candidate: safeBeach, contentClass });
    workingHistory.push({
      beachId: safeBeach.id,
      contentClass,
      createdAt: options.asOf.toISOString(),
    });
  }

  return selected;
}

export function allocationTierForSlot(
  sequence: number,
): "proven" | "adjacent" | "exploration" {
  const slot = ((sequence % 10) + 10) % 10;
  if (slot < 7) return "proven";
  if (slot < 9) return "adjacent";
  return "exploration";
}

function isWithinCaps(
  candidate: SystemCardCandidate,
  contentClass: SystemCardClass,
  history: readonly SystemCardSelectionRecord[],
  asOf: Date,
  maxPerBeachSevenDays: number,
): boolean {
  const normalizedId = candidate.id.toLowerCase();
  const currentTime = asOf.getTime();
  const recent = history.filter((record) => {
    if (record.beachId.toLowerCase() !== normalizedId) return false;
    const createdAt = new Date(record.createdAt).getTime();
    return Number.isFinite(createdAt) && createdAt <= currentTime;
  });
  const dayAgo = currentTime - 86400000;
  const weekAgo = currentTime - 7 * 86400000;
  const lastDayCount = recent.filter((record) => new Date(record.createdAt).getTime() > dayAgo).length;
  const lastWeekCount = recent.filter((record) => new Date(record.createdAt).getTime() > weekAgo).length;
  if (lastDayCount >= MAX_SYSTEM_CARDS_PER_BEACH_PER_DAY) return false;
  if (lastWeekCount >= maxPerBeachSevenDays) return false;

  const sameDay = recent.some((record) => new Date(record.createdAt).getTime() > dayAgo);
  if (!sameDay) return true;

  // A second card is legal only when the caller has explicitly supplied a
  // material-transition candidate and changed content class. The live route
  // leaves this off unless it has a measured/forecast transition.
  return Boolean(candidate.materialTransition) &&
    recent.some((record) => record.contentClass !== contentClass);
}

function pickWeighted(
  candidates: readonly SystemCardCandidate[],
  random: () => number,
): SystemCardCandidate {
  if (candidates.length === 0) throw new Error("No eligible system-card beaches");
  const total = candidates.reduce(
    (sum, candidate) => sum + Math.max(0.01, candidate.trafficWeight),
    0,
  );
  let threshold = normalizeRandom(random()) * total;
  for (const candidate of candidates) {
    threshold -= Math.max(0.01, candidate.trafficWeight);
    if (threshold < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

async function defaultSafeBeach(
  candidate: SystemCardCandidate,
): Promise<SystemCardCandidate | null> {
  const safe = await selectBeach(candidate);
  return safe ?? null;
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 0.9999999999999999);
}
