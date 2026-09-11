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

export interface SpriteManifest {
  atlases: AtlasManifestEntry[];
}

export interface PhaserBridge {
  definition: BreakDefinition;
  wave: WaveDefinition;
  initialSimulation: SimulationState;
  initialHeat: HeatState;
  active: boolean;
  reducedMotion: boolean;
  currentBestArcadeScore: number;
  fontFamily: string;
  audio: PlayAudio;
  muted: boolean;
  onToggleMute(): void;
  onSnapshot(snapshot: GameSnapshot): void;
  onFrameCapture(dataUrl: string): void;
  onWaveComplete(heat: HeatState, simulation: SimulationState, score: number): void;
}

export interface PhaserBridgeRef {
  current: PhaserBridge;
}
