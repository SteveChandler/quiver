import type { WavesSummary } from "./waves-summary";

export type SessionWave = {
  id: string;
  index: number;
  startedAt: string;
  endedAt: string;
  durationS: number;
  distanceM: number;
  maxSpeedMps: number | null;
  avgSpeedMps: number | null;
  headingDeg: number | null;
  confidence: number;
  excluded: boolean;
  counted: boolean;
  tideFt: number | null;
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
};

export type SessionWavesResponse = {
  summary: WavesSummary;
  waves: SessionWave[];
  track: { type: "LineString"; coordinates: [number, number][] };
  speedSeries: { t: string; mps: number }[];
  recordedBy: string | null;
};
