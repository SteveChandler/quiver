export const TIDE_CYCLE_HOURS = 12 + 25 / 60;

export type TideRangeKind = "neap" | "average" | "spring";
export type TideStage = "low" | "rising" | "high" | "falling";

interface TideWindowClassification {
  hoursSinceLow: number;
  heightFeet: number;
  rangeFeet: number;
  normalizedHeight: number;
  stage: TideStage;
  stageLabel: "Low tide" | "Rising tide" | "High tide" | "Falling tide";
  surfCue: string;
}

const TIDE_RANGES: Record<TideRangeKind, number> = {
  neap: 3.5,
  average: 5,
  spring: 7,
};

export function getTideRangeFeet(kind: TideRangeKind): number {
  return TIDE_RANGES[kind];
}

export function classifyTideWindow(
  hoursSinceLow: number,
  rangeKind: TideRangeKind,
): TideWindowClassification {
  const clampedHours = Math.max(0, Math.min(TIDE_CYCLE_HOURS, hoursSinceLow));
  const normalizedHeight =
    (1 - Math.cos((Math.PI * 2 * clampedHours) / TIDE_CYCLE_HOURS)) / 2;
  const rangeFeet = getTideRangeFeet(rangeKind);
  const heightFeet = Math.round(normalizedHeight * rangeFeet * 10) / 10;

  let stage: TideStage;
  if (normalizedHeight <= 0.08) {
    stage = "low";
  } else if (normalizedHeight >= 0.92) {
    stage = "high";
  } else if (clampedHours < TIDE_CYCLE_HOURS / 2) {
    stage = "rising";
  } else {
    stage = "falling";
  }

  const stageCopy: Record<
    TideStage,
    Pick<TideWindowClassification, "stageLabel" | "surfCue">
  > = {
    low: {
      stageLabel: "Low tide",
      surfCue: "More bottom is exposed; reef, rocks, and sandbars matter.",
    },
    rising: {
      stageLabel: "Rising tide",
      surfCue: "Water is filling in; compare the curve with your break.",
    },
    high: {
      stageLabel: "High tide",
      surfCue: "More water covers the break; some waves may soften.",
    },
    falling: {
      stageLabel: "Falling tide",
      surfCue: "Water is draining; shape and current can change quickly.",
    },
  };

  return {
    hoursSinceLow: clampedHours,
    heightFeet,
    rangeFeet,
    normalizedHeight,
    stage,
    ...stageCopy[stage],
  };
}
