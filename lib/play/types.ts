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
  obstacles: Obstacle[];
}

export type ObstacleLane = "upper" | "mid" | "low";
export type DebrisVariant = "plank" | "crate" | "barrel" | "tire" | "cooler" | "driftwood";
export type PierPattern = "single-post" | "double-post-gap" | "cross-brace";
export type WipeoutReason = "Caught by the foam" | "Hit the pier" | "Bad landing" | "Hit a swimmer" | "Clipped by debris" | "Took a gull to the face";

interface ObstacleBase {
  id: string;
  cueAt: number;
  hitAt: number;
  endAt: number;
  lane: ObstacleLane;
}

export interface SeagullObstacle extends ObstacleBase {
  kind: "seagull";
}

export interface FishObstacle extends ObstacleBase {
  kind: "fish";
}

export interface DebrisObstacle extends ObstacleBase {
  kind: "debris";
  variant: DebrisVariant;
}

export interface HumanObstacle extends ObstacleBase {
  kind: "swimmer" | "bodyboarder";
}

export interface BuoyObstacle extends ObstacleBase {
  kind: "buoy";
}

export interface PierPost {
  lane: ObstacleLane;
  width: number;
}

export interface PierObstacle extends ObstacleBase {
  kind: "pier";
  pattern: PierPattern;
  posts: PierPost[];
  gaps: ObstacleLane[];
}

export type Obstacle = SeagullObstacle | FishObstacle | DebrisObstacle | HumanObstacle | BuoyObstacle | PierObstacle;

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
  rideSeconds: number;
  closestPierPass: number | null;
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
  wipeoutReason: WipeoutReason | null;
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
  arcadeScore: number;
  stats: HeatStats;
}

export interface HeatStats {
  tricksLanded: number;
  longestRideSeconds: number;
  closestPierPass: number | null;
}

export interface Challenge {
  breakIndex: number;
  seed: number;
  heatTotal: number;
  initials?: string;
}
