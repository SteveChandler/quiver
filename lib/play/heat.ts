import { getBreak } from "./breaks";
import type { HeatState } from "./types";

function roundScore(score: number): number {
  return Number(score.toFixed(2));
}

function calculateHeatTotal(scores: number[], bestWaveCount: number): number {
  return roundScore(
    [...scores]
      .sort((left, right) => right - left)
      .slice(0, bestWaveCount)
      .reduce((total, score) => total + score, 0),
  );
}

export function createHeatState(
  breakIndex: number,
  seed: number,
  practice = false,
): HeatState {
  const definition = getBreak(breakIndex);
  return {
    breakIndex: definition.index,
    seed: seed >>> 0,
    practice,
    status: "ready",
    secondsRemaining: definition.heatSeconds,
    waveScores: [],
    currentWaveIndex: 0,
    heatTotal: 0,
  };
}

export function startHeat(state: HeatState): HeatState {
  if (state.status !== "ready") return state;
  return { ...state, status: "running" };
}

export function tickHeat(state: HeatState, seconds: number): HeatState {
  if (state.status !== "running" || state.practice) return state;
  const secondsRemaining = Math.max(0, state.secondsRemaining - seconds);
  if (secondsRemaining > 0) return { ...state, secondsRemaining };

  const definition = getBreak(state.breakIndex);
  return {
    ...state,
    secondsRemaining: 0,
    status: state.heatTotal >= definition.threshold ? "passed" : "failed",
  };
}

export function completeWave(
  state: HeatState,
  score: number,
  wipedOut: boolean,
): HeatState {
  if (state.status !== "running") return state;

  const definition = getBreak(state.breakIndex);
  const waveScores = [...state.waveScores, roundScore(score)];
  const heatTotal = calculateHeatTotal(waveScores, definition.maxWaves === 1 ? 1 : 2);
  const secondsRemaining = state.practice
    ? state.secondsRemaining
    : Math.max(0, state.secondsRemaining - (wipedOut ? 4 : 1.5));
  const finished = waveScores.length >= definition.maxWaves || secondsRemaining <= 0;

  return {
    ...state,
    waveScores,
    heatTotal,
    secondsRemaining,
    currentWaveIndex: state.currentWaveIndex + 1,
    status: finished
      ? heatTotal >= definition.threshold ? "passed" : "failed"
      : "running",
  };
}

export function getNeedsScore(state: HeatState, currentWaveScore = 0): number | null {
  const definition = getBreak(state.breakIndex);
  if (state.status !== "running") return null;

  if (definition.maxWaves === 1) {
    return roundScore(Math.max(0, definition.threshold - currentWaveScore));
  }
  if (state.waveScores.length === 0) return null;

  const bestCompleted = Math.max(...state.waveScores);
  return roundScore(Math.max(0, definition.threshold - bestCompleted - currentWaveScore));
}

export function getProjectedHeatTotal(state: HeatState, currentWaveScore: number): number {
  const definition = getBreak(state.breakIndex);
  return calculateHeatTotal(
    [...state.waveScores, currentWaveScore],
    definition.maxWaves === 1 ? 1 : 2,
  );
}
