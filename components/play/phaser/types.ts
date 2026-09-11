import type {
  BreakDefinition,
  HeatState,
  SimulationState,
  WaveDefinition,
} from "@/lib/play";
import type { PlayAudio } from "../audio";
import type { GameSnapshot } from "../game-types";

export interface AtlasManifestEntry {
  key: string;
  image: string;
  json: string;
}

export interface AtlasOverride {
  atlas: string;
  frame: string;
}

export interface SpriteManifest {
  atlases: AtlasManifestEntry[];
  overrides?: Record<string, AtlasOverride>;
}

export interface PhaserBridge {
  definition: BreakDefinition;
  wave: WaveDefinition;
  initialSimulation: SimulationState;
  initialHeat: HeatState;
  active: boolean;
  reducedMotion: boolean;
  fontFamily: string;
  audio: PlayAudio;
  onSnapshot(snapshot: GameSnapshot): void;
  onWaveComplete(heat: HeatState, simulation: SimulationState, score: number): void;
}

export interface PhaserBridgeRef {
  current: PhaserBridge;
}
