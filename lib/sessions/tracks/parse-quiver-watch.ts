import type { NormalizedTrack, TrackSample } from "./types";
import { TrackFileError } from "./types";

type RecordValue = Record<string, unknown>;

function corrupt(message: string): never {
  throw new TrackFileError("corrupt", message);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseQuiverWatch(json: unknown): NormalizedTrack {
  if (!isRecord(json) || json.quiverWatch !== 1 || !isRecord(json.header) || !Array.isArray(json.chunks)) {
    corrupt("Invalid Quiver watch file");
  }

  const { header, chunks } = json;
  if (typeof header.surfId !== "string" || !isValidTime(header.startedAt)
    || !isValidTime(header.endedAt) || header.sport !== "surfing"
    || typeof header.partNumber !== "string" || typeof header.deviceName !== "string"
    || typeof header.appVersion !== "string"
    || !(header.rating === null || (isInteger(header.rating) && header.rating >= 1 && header.rating <= 5))
    || !isInteger(header.chunkCount) || header.chunkCount < 1 || header.chunkCount !== chunks.length) {
    corrupt("Invalid Quiver watch header");
  }

  const samples: TrackSample[] = [];
  let hasFix = false;
  for (const chunk of chunks) {
    if (!isRecord(chunk) || !isInteger(chunk.t0) || !isNullableInteger(chunk.lat0)
      || !isNullableInteger(chunk.lon0) || (chunk.lat0 === null) !== (chunk.lon0 === null)
      || !Array.isArray(chunk.rows) || chunk.rows.length < 1 || chunk.rows.length > 300) {
      corrupt("Invalid Quiver watch chunk");
    }

    let time = chunk.t0;
    let lastLat = chunk.lat0;
    let lastLon = chunk.lon0;
    let chunkHasFix = false;
    for (const [index, row] of chunk.rows.entries()) {
      if (!Array.isArray(row) || row.length !== 6) corrupt("Invalid Quiver watch row");
      const [dt, dlat, dlon, speedCms, hr, tempDeci] = row;
      if (!isInteger(dt) || dt < 0 || (index === 0 && dt !== 0)
        || !isNullableInteger(dlat) || !isNullableInteger(dlon)
        || (dlat === null) !== (dlon === null)
        || !isNullableInteger(speedCms) || (speedCms !== null && speedCms < 0)
        || !isNullableInteger(hr) || (hr !== null && (hr < 0 || hr > 255))
        || !isNullableInteger(tempDeci)) {
        corrupt("Invalid Quiver watch row values");
      }
      time += dt;
      const timestamp = new Date(time * 1000);
      if (!Number.isSafeInteger(time) || !Number.isFinite(timestamp.getTime())) {
        corrupt("Invalid Quiver watch row time");
      }

      let lat: number | null = null;
      let lon: number | null = null;
      if (dlat !== null && dlon !== null) {
        if (lastLat === null || lastLon === null || (!chunkHasFix && (dlat !== 0 || dlon !== 0))) {
          corrupt("Invalid Quiver watch fix origin");
        }
        lastLat += dlat;
        lastLon += dlon;
        if (!Number.isSafeInteger(lastLat) || !Number.isSafeInteger(lastLon)
          || Math.abs(lastLat) > 90e7 || Math.abs(lastLon) > 180e7) {
          corrupt("Invalid Quiver watch coordinates");
        }
        lat = lastLat / 1e7;
        lon = lastLon / 1e7;
        chunkHasFix = true;
        hasFix = true;
      }
      samples.push({
        t: timestamp.toISOString(), lat, lon,
        speedMps: speedCms === null ? null : speedCms / 100,
        hr, tempC: tempDeci === null ? null : tempDeci / 10, cadence: null,
      });
    }
    if (chunkHasFix !== (chunk.lat0 !== null)) corrupt("Invalid Quiver watch fix origin");
  }
  if (!hasFix) throw new TrackFileError("no_gps", "This file has no GPS track");

  return {
    meta: {
      format: "quiver_watch", sport: "surfing", subSport: null,
      recordedBy: `Quiver for Garmin · ${header.deviceName}`,
      startedAt: new Date(header.startedAt).toISOString(),
      endedAt: new Date(header.endedAt).toISOString(),
    },
    samples,
    extras: { rating: header.rating, deviceName: header.deviceName },
  };
}
