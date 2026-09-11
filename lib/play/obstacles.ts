import { mulberry32, randomBetween } from "./rng";
import type {
  DebrisVariant,
  Obstacle,
  ObstacleLane,
  PierObstacle,
  PierPattern,
  SimulationState,
  WipeoutReason,
} from "./types";

export const PIER_WARNING_LEAD_SECONDS = 4;

const DEBRIS: readonly DebrisVariant[] = ["plank", "crate", "barrel", "tire", "cooler", "driftwood"];
const PROFILES: readonly (readonly Obstacle["kind"][])[] = [
  ["buoy", "fish"],
  ["fish", "buoy", "seagull"],
  ["fish", "debris", "seagull"],
  ["swimmer", "debris", "bodyboarder", "debris", "fish"],
  ["seagull", "pier", "pier", "pier", "seagull"],
  [],
];

const PIER_PATTERNS: readonly PierPattern[] = ["single-post", "double-post-gap", "cross-brace"];

function pierData(pattern: PierPattern): Pick<PierObstacle, "posts" | "gaps"> {
  if (pattern === "single-post") return { posts: [{ lane: "low", width: 0.18 }], gaps: ["upper", "mid"] };
  if (pattern === "double-post-gap") return { posts: [{ lane: "upper", width: 0.18 }, { lane: "low", width: 0.18 }], gaps: ["mid"] };
  return { posts: [{ lane: "mid", width: 0.22 }, { lane: "low", width: 0.18 }], gaps: ["upper"] };
}

function makeObstacle(
  kind: Obstacle["kind"],
  id: string,
  hitAt: number,
  random: () => number,
  pierIndex: number,
): Obstacle {
  const cueAt = Math.max(0, hitAt - (kind === "pier" ? 4.5 : randomBetween(random, 2, 3.2)));
  const base = { id, kind, cueAt, hitAt, endAt: hitAt + (kind === "fish" ? 0.65 : 0.42) };
  if (kind === "debris") return { ...base, kind, lane: "low", variant: DEBRIS[Math.floor(random() * DEBRIS.length)] };
  if (kind === "pier") {
    const pattern = PIER_PATTERNS[pierIndex % PIER_PATTERNS.length];
    return { ...base, kind, lane: "mid", pattern, ...pierData(pattern) };
  }
  if (kind === "seagull") return { ...base, kind, lane: "upper" };
  if (kind === "fish") return { ...base, kind, lane: "mid" };
  if (kind === "buoy") return { ...base, kind, lane: "low" };
  return { ...base, kind, lane: "mid" };
}

export function generateObstacleSchedule(
  seed: number,
  breakIndex: number,
  waveIndex: number,
  duration: number,
): Obstacle[] {
  const profile = PROFILES[breakIndex] ?? PROFILES[0];
  const random = mulberry32((seed ^ Math.imul(breakIndex + 11, 0x85ebca6b) ^ Math.imul(waveIndex + 1, 0xc2b2ae35)) >>> 0);
  let pierIndex = 0;
  return profile.map((kind, index) => {
    const ratio = (index + 1) / (profile.length + 1);
    const hitAt = Math.max(5, Math.min(duration - 1.2, duration * (0.16 + ratio * 0.7) + randomBetween(random, -0.45, 0.45)));
    const item = makeObstacle(kind, `${waveIndex + 1}-${index + 1}-${kind}`, hitAt, random, pierIndex);
    if (kind === "pier") pierIndex += 1;
    return item;
  }).sort((left, right) => left.hitAt - right.hitAt);
}

function riderLane(facePosition: number): ObstacleLane {
  if (facePosition >= 0.7) return "upper";
  if (facePosition <= 0.34) return "low";
  return "mid";
}

function isCuttingBack(state: SimulationState): boolean {
  const current = state.stats.maneuvers.at(-1);
  const previous = state.stats.maneuvers.at(-2);
  return current?.type === "snap" && previous?.type === "snap" && state.elapsed - current.at <= 0.65;
}

export function getObstacleCollision(obstacle: Obstacle, state: SimulationState): WipeoutReason | null {
  if (state.elapsed < obstacle.hitAt || state.elapsed > obstacle.endAt) return null;
  if (obstacle.kind === "buoy") return null;
  if (obstacle.kind === "seagull") return state.phase === "airborne" || state.facePosition >= 0.72 ? "Took a gull to the face" : null;
  if (obstacle.kind === "fish") return state.facePosition < 0.72 ? "Bad landing" : null;
  if (obstacle.kind === "debris") return state.facePosition <= 0.36 ? "Clipped by debris" : null;
  if (obstacle.kind === "swimmer" || obstacle.kind === "bodyboarder") {
    return state.facePosition < 0.7 && !isCuttingBack(state) ? "Hit a swimmer" : null;
  }
  if (obstacle.kind !== "pier") return null;
  return obstacle.gaps.includes(riderLane(state.facePosition)) ? null : "Hit the pier";
}

export function getPierClearance(obstacle: PierObstacle, facePosition: number): number {
  const centers: Record<ObstacleLane, number> = { low: 0.2, mid: 0.52, upper: 0.84 };
  return Math.max(0, Math.min(...obstacle.posts.map((post) => Math.abs(facePosition - centers[post.lane]) - post.width / 2)));
}

export function getPierWarning(obstacles: readonly Obstacle[], elapsed: number): PierObstacle | null {
  return obstacles
    .filter((item): item is PierObstacle => item.kind === "pier" && elapsed >= item.cueAt && elapsed < item.hitAt)
    .sort((left, right) => left.hitAt - right.hitAt)[0] ?? null;
}
