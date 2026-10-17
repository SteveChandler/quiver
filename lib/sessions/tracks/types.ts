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
  format: "fit" | "gpx";
  sport: string | null;
  subSport: string | null;
  recordedBy: string | null;
  startedAt: string;
  endedAt: string;
};

export type NormalizedTrack = { meta: TrackMeta; samples: TrackSample[] };

export class TrackFileError extends Error {
  constructor(
    public code: "unsupported_format" | "no_gps" | "bad_time" | "corrupt",
    message: string
  ) {
    super(message);
    this.name = "TrackFileError";
  }
}
