import { judgeWave } from "./judge";
import type {
  BreakDefinition,
  ManeuverType,
  RideStats,
  SimulationInput,
  SimulationState,
  WaveDefinition,
} from "./types";

export const FIXED_TIMESTEP_SECONDS = 1 / 60;

const MANEUVER_POINTS: Record<ManeuverType, number> = {
  "bottom-turn": 0.8,
  snap: 1.7,
  air: 3.2,
  barrel: 2.4,
};

const MANEUVER_DIFFICULTY: Record<ManeuverType, number> = {
  "bottom-turn": 0.5,
  snap: 1.4,
  air: 3.4,
  barrel: 2.8,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createRideStats(): RideStats {
  return {
    peakSpeed: 24,
    maneuvers: [],
    uniqueManeuvers: [],
    maxFlow: 1,
    flowMultiplier: 1,
    difficultyPoints: 0,
    barrelSeconds: 0,
    wipeout: false,
  };
}

export function createSimulationState(wave: WaveDefinition): SimulationState {
  return {
    phase: "riding",
    elapsed: 0,
    phaseElapsed: 0,
    facePosition: 0.42,
    previousFacePosition: 0.42,
    speed: 24,
    sectionDistance: wave.sectionStart,
    pumping: false,
    inBarrel: false,
    barrelStartAt: null,
    airLandingStart: null,
    airLandingEnd: null,
    landedAir: false,
    stats: createRideStats(),
  };
}

export function performManeuver(
  stats: RideStats,
  type: ManeuverType,
  at: number,
  basePoints: number = MANEUVER_POINTS[type],
): RideStats {
  const previous = stats.maneuvers.at(-1);
  const repeated = previous?.type === type;
  const flowMultiplier = type === "bottom-turn"
    ? 1
    : clamp(stats.flowMultiplier + 0.2, 1, 2.5);
  const awardedPoints = basePoints * flowMultiplier * (repeated ? 0.5 : 1);
  const uniqueManeuvers = stats.uniqueManeuvers.includes(type)
    ? stats.uniqueManeuvers
    : [...stats.uniqueManeuvers, type];

  return {
    ...stats,
    maneuvers: [
      ...stats.maneuvers,
      { type, at, basePoints, awardedPoints, flowMultiplier },
    ],
    uniqueManeuvers,
    flowMultiplier,
    maxFlow: Math.max(stats.maxFlow, flowMultiplier),
    difficultyPoints: stats.difficultyPoints + MANEUVER_DIFFICULTY[type],
  };
}

function startWipeout(state: SimulationState): SimulationState {
  return {
    ...state,
    phase: "wipeout",
    phaseElapsed: 0,
    pumping: false,
    inBarrel: false,
    stats: { ...state.stats, wipeout: true },
  };
}

function isThrowing(wave: WaveDefinition, elapsed: number): boolean {
  return wave.throwWindows.some(({ start, end }) => elapsed >= start && elapsed <= end);
}

function handleRelease(state: SimulationState): SimulationState {
  if (state.facePosition >= 0.9 && state.speed >= 65) {
    return {
      ...state,
      phase: "airborne",
      phaseElapsed: 0,
      pumping: false,
      airLandingStart: 10 / 60,
      airLandingEnd: 18 / 60,
    };
  }
  if (state.facePosition >= 0.67) {
    return {
      ...state,
      speed: Math.max(0, state.speed - 12),
      stats: performManeuver(state.stats, "snap", state.elapsed),
    };
  }
  if (state.facePosition <= 0.33 && state.speed >= 28) {
    return {
      ...state,
      speed: Math.min(100, state.speed + 9),
      stats: performManeuver(state.stats, "bottom-turn", state.elapsed),
    };
  }
  return {
    ...state,
    stats: { ...state.stats, flowMultiplier: 1 },
  };
}

function stepAirborne(
  state: SimulationState,
  input: SimulationInput,
  timestep: number,
): SimulationState {
  const phaseElapsed = state.phaseElapsed + timestep;
  const landingStart = state.airLandingStart ?? 0;
  const landingEnd = state.airLandingEnd ?? 0;

  if (input.actionPressed && phaseElapsed >= landingStart && phaseElapsed <= landingEnd) {
    return {
      ...state,
      phase: "riding",
      phaseElapsed: 0,
      landedAir: true,
      speed: Math.max(0, state.speed - 18),
      stats: performManeuver(state.stats, "air", state.elapsed),
    };
  }
  if (phaseElapsed > landingEnd) return startWipeout({ ...state, phaseElapsed });
  return { ...state, phaseElapsed };
}

export function stepSimulation(
  state: SimulationState,
  input: SimulationInput,
  definition: BreakDefinition,
  wave: WaveDefinition,
  timestep: number = FIXED_TIMESTEP_SECONDS,
): SimulationState {
  if (state.phase === "complete") return state;

  const elapsed = state.elapsed + timestep;
  if (state.phase === "wipeout") {
    const phaseElapsed = state.phaseElapsed + timestep;
    if (phaseElapsed < 4) return { ...state, elapsed, phaseElapsed };
    return { ...state, phase: "complete", elapsed, phaseElapsed };
  }
  if (state.phase === "airborne") {
    const next = stepAirborne({ ...state, elapsed }, input, timestep);
    return next.phase === "wipeout" ? next : { ...next, elapsed };
  }

  const facePosition = clamp(state.facePosition + input.vertical * timestep * 0.82, 0, 1);
  const dropped = Math.max(0, state.previousFacePosition - facePosition);
  let speed = state.speed - timestep * (4 + facePosition * 4);

  if (input.action) {
    speed += facePosition < 0.58
      ? timestep * 20 + dropped * 38
      : -timestep * 12;
  }
  speed = clamp(speed, 0, 100);

  const throwing = isThrowing(wave, elapsed);
  let inBarrel = state.inBarrel;
  let barrelStartAt = state.barrelStartAt;
  let stats = { ...state.stats, peakSpeed: Math.max(state.stats.peakSpeed, speed) };
  if (!inBarrel && throwing && facePosition <= 0.29) {
    inBarrel = true;
    barrelStartAt = elapsed;
  }
  if (inBarrel) {
    const flowMultiplier = clamp(stats.flowMultiplier + timestep * 0.12, 1, 2.5);
    stats = {
      ...stats,
      barrelSeconds: stats.barrelSeconds + timestep,
      flowMultiplier,
      maxFlow: Math.max(stats.maxFlow, flowMultiplier),
    };
    if (facePosition > 0.48 || !throwing) {
      const barrelDuration = Math.max(0, elapsed - (barrelStartAt ?? elapsed));
      stats = performManeuver(stats, "barrel", elapsed, Math.max(1.2, barrelDuration * 0.9));
      inBarrel = false;
      barrelStartAt = null;
    }
  }

  const closeRate = Math.max(0.012, definition.sectionSpeed - speed * 0.00078);
  const sectionDistance = state.sectionDistance - closeRate * timestep * (inBarrel ? 1.75 : 1);
  let next: SimulationState = {
    ...state,
    elapsed,
    phaseElapsed: 0,
    facePosition,
    previousFacePosition: facePosition,
    speed,
    sectionDistance,
    pumping: input.action,
    inBarrel,
    barrelStartAt,
    stats,
  };

  if (input.actionReleased) next = handleRelease(next);
  if (sectionDistance <= 0) return startWipeout(next);
  if (elapsed >= wave.duration) return { ...next, phase: "complete" };
  return next;
}

export function getLiveWaveScore(state: SimulationState): number {
  return judgeWave(state.stats).score;
}
