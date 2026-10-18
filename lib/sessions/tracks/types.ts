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
};

export const WATCH_WAVE_HEIGHTS_FT = [1.5, 2.5, 3.5, 5, 7, 8.5] as const;
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
