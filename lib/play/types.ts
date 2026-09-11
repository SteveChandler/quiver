export type ManeuverType = "bottom-turn" | "snap" | "air" | "barrel";

export type ThrowCadence = "never" | "rare" | "sometimes" | "often" | "once";

export interface DawnPalette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  water: string;
  waterDeep: string;
}

export interface BreakDefinition {
  index: number;
  name: string;
  sizeCopy: string;
  beachSlug: string;
  beachPath: string;
  usesBeachFallback: boolean;
  sectionLabel: string;
  sectionSpeed: number;
  throwCadence: ThrowCadence;
  threshold: number;
  heatSeconds: number;
  maxWaves: number;
  palette: DawnPalette;
}

export interface ThrowWindow {
  start: number;
  end: number;
}

export interface WaveDefinition {
  id: number;
  height: number;
  duration: number;
  sectionStart: number;
  textureSeed: number;
  throwWindows: ThrowWindow[];
}

export interface ManeuverEvent {
  type: ManeuverType;
  at: number;
  basePoints: number;
  awardedPoints: number;
  flowMultiplier: number;
}

export interface RideStats {
  peakSpeed: number;
  maneuvers: ManeuverEvent[];
  uniqueManeuvers: ManeuverType[];
  maxFlow: number;
  flowMultiplier: number;
  difficultyPoints: number;
  barrelSeconds: number;
  wipeout: boolean;
}

export type SimulationPhase = "riding" | "airborne" | "wipeout" | "complete";

export interface SimulationState {
  phase: SimulationPhase;
  elapsed: number;
  phaseElapsed: number;
  facePosition: number;
  previousFacePosition: number;
  speed: number;
  sectionDistance: number;
  pumping: boolean;
  inBarrel: boolean;
  barrelStartAt: number | null;
  airLandingStart: number | null;
  airLandingEnd: number | null;
  landedAir: boolean;
  stats: RideStats;
}

export interface SimulationInput {
  vertical: -1 | 0 | 1;
  action: boolean;
  actionPressed: boolean;
  actionReleased: boolean;
}

export type HeatStatus = "ready" | "running" | "passed" | "failed";

export interface HeatState {
  breakIndex: number;
  seed: number;
  practice: boolean;
  status: HeatStatus;
  secondsRemaining: number;
  waveScores: number[];
  currentWaveIndex: number;
  heatTotal: number;
}

export interface Challenge {
  breakIndex: number;
  seed: number;
  heatTotal: number;
  initials?: string;
}
