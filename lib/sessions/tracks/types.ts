import { WATCH_CONTRACT } from "@/lib/watch/contract";

export type TrackSample = {
  t: string;
  lat: number | null;
  lon: number | null;
  speedMps: number | null;
  hr: number | null;
  tempC: number | null;
  cadence: number | null;
};

export type TrackMeta = {
  format: "fit" | "gpx" | "quiver_watch";
  sport: string | null;
  subSport: string | null;
  recordedBy: string | null;
  startedAt: string;
  endedAt: string;
  calories?: number | null;
};

export const WATCH_WAVE_HEIGHTS_FT = WATCH_CONTRACT.waveHeightsFt;
export type WatchWaveHeightFt = (typeof WATCH_WAVE_HEIGHTS_FT)[number];

export type NormalizedTrack = {
  meta: TrackMeta;
  samples: TrackSample[];
  extras?: { rating: number | null; deviceName: string | null; waveHeightFt: WatchWaveHeightFt | null };
};

export class TrackFileError extends Error {
  constructor(
    public code: "unsupported_format" | "no_gps" | "bad_time" | "corrupt" | "too_short",
    message: string
  ) {
    super(message);
    this.name = "TrackFileError";
  }
}
