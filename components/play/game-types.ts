import type { HeatState, SimulationState } from "@/lib/play";

export interface GameSnapshot {
  simulation: SimulationState;
  heat: HeatState;
  liveScore: number;
}
