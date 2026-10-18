import type { NormalizedTrack, TrackSample } from "@/lib/sessions/tracks/types";

type WatchRow = [number, number | null, number | null, number | null, number | null, number | null];
type WatchChunk = {
  header?: WatchHeader;
  t0: number;
  lat0: number | null;
  lon0: number | null;
  rows: WatchRow[];
};
type WatchHeader = {
  surfId: string;
  startedAt: string;
  endedAt: string;
  sport: "surfing";
  partNumber: string;
  deviceName: string;
  appVersion: string;
  rating: number | null;
  chunkCount: number;
};
export type WatchFile = { quiverWatch: 1; header: WatchHeader; chunks: WatchChunk[] };

function encodeChunk(samples: TrackSample[]): WatchChunk {
  const firstFix = samples.find((sample) => sample.lat !== null && sample.lon !== null);
  const lat0 = firstFix?.lat == null ? null : Math.round(firstFix.lat * 1e7);
  const lon0 = firstFix?.lon == null ? null : Math.round(firstFix.lon * 1e7);
  const t0 = Math.floor(Date.parse(samples[0].t) / 1000);
  let previousTime = t0;
  let previousLat = lat0;
  let previousLon = lon0;
  const rows: WatchRow[] = samples.map((sample, index) => {
    const time = Math.floor(Date.parse(sample.t) / 1000);
    const hasFix = sample.lat !== null && sample.lon !== null;
    const lat = hasFix ? Math.round(sample.lat! * 1e7) : null;
    const lon = hasFix ? Math.round(sample.lon! * 1e7) : null;
    const row: WatchRow = [
      index === 0 ? 0 : time - previousTime,
      lat === null || previousLat === null ? null : lat - previousLat,
      lon === null || previousLon === null ? null : lon - previousLon,
      sample.speedMps === null ? null : Math.round(sample.speedMps * 100),
      sample.hr,
      sample.tempC === null ? null : Math.round(sample.tempC * 10),
    ];
    previousTime = time;
    if (lat !== null && lon !== null) {
      previousLat = lat;
      previousLon = lon;
    }
    return row;
  });
  return { t0, lat0, lon0, rows };
}

export function encodeWatchTrack(track: NormalizedTrack): WatchFile {
  const chunks: WatchChunk[] = [];
  for (let index = 0; index < track.samples.length; index += 300) {
    chunks.push(encodeChunk(track.samples.slice(index, index + 300)));
  }
  const header: WatchHeader = {
    surfId: "123e4567-e89b-42d3-a456-426614174000",
    startedAt: track.meta.startedAt,
    endedAt: track.meta.endedAt,
    sport: "surfing",
    partNumber: "010-02863-20",
    deviceName: "Forerunner 165",
    appVersion: "1.0.0",
    rating: 4,
    chunkCount: chunks.length,
  };
  if (chunks[0]) chunks[0].header = header;
  return { quiverWatch: 1, header, chunks };
}
