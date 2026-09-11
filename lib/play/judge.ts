import type { RideStats } from "./types";

export interface JudgeBreakdown {
  commitment: number;
  variety: number;
  difficulty: number;
  flow: number;
  score: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function judgeWave(stats: RideStats): JudgeBreakdown {
  const commitment = clamp01(stats.peakSpeed / 90);
  const variety = clamp01(stats.uniqueManeuvers.length / 4);
  const difficulty = clamp01((stats.difficultyPoints + stats.barrelSeconds * 0.8) / 9);
  const flow = clamp01((stats.maxFlow - 1) / 1.5);
  const execution = clamp01(
    stats.maneuvers.reduce((sum, maneuver) => sum + maneuver.awardedPoints, 0) / 10,
  );
  const rawScore = 10 * (
    commitment * 0.25 +
    variety * 0.2 +
    difficulty * 0.25 +
    flow * 0.2 +
    execution * 0.1
  );
  const score = Math.min(10, rawScore * (stats.wipeout ? 0.8 : 1));

  return {
    commitment,
    variety,
    difficulty,
    flow,
    score: Number(score.toFixed(2)),
  };
}

export function getArcadeScore(stats: RideStats): number {
  const airBonus = stats.maneuvers.filter(({ type }) => type === "air").length * 300;
  const barrelBonus = stats.barrelSeconds * 50;
  return Math.round((judgeWave(stats).score * 100 + airBonus + barrelBonus) * stats.maxFlow);
}
