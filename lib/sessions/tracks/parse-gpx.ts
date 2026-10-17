import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { NormalizedTrack, TrackSample } from "./types";
import { TrackFileError } from "./types";

type GpxPoint = { "@_lat"?: unknown; "@_lon"?: unknown; time?: unknown };
type GpxSegment = { trkpt?: GpxPoint | GpxPoint[] };
type GpxTrack = { trkseg?: GpxSegment | GpxSegment[] };
type GpxDocument = { gpx?: { trk?: GpxTrack | GpxTrack[] } };

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export function parseGpx(bytes: Uint8Array): NormalizedTrack {
  let document: GpxDocument;
  try {
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (XMLValidator.validate(xml) !== true) throw new Error("Invalid GPX XML");
    document = new XMLParser({ ignoreAttributes: false, parseTagValue: false })
      .parse(xml) as GpxDocument;
  } catch {
    throw new TrackFileError("corrupt", "Could not decode the GPX file");
  }
  if (!document.gpx) throw new TrackFileError("corrupt", "The GPX file has no gpx root");

  const points = asArray(document.gpx.trk)
    .flatMap((track) => asArray(track.trkseg))
    .flatMap((segment) => asArray(segment.trkpt));
  const samples: TrackSample[] = points.map((point) => {
    const parsedTime = typeof point.time === "string" ? Date.parse(point.time) : Number.NaN;
    if (!Number.isFinite(parsedTime)) throw new TrackFileError("bad_time", "The GPX file has an invalid point time");
    return {
      t: new Date(parsedTime).toISOString(),
      lat: coordinate(point["@_lat"], 90),
      lon: coordinate(point["@_lon"], 180),
      speedMps: null,
      hr: null,
      tempC: null,
      cadence: null,
    };
  });
  const firstFix = samples.find((sample) => sample.lat !== null && sample.lon !== null);
  const lastFix = samples.findLast((sample) => sample.lat !== null && sample.lon !== null);
  if (!firstFix || !lastFix) throw new TrackFileError("no_gps", "This file has no GPS track");

  return {
    meta: {
      format: "gpx", sport: null, subSport: null, recordedBy: null,
      startedAt: firstFix.t, endedAt: lastFix.t,
    },
    samples,
  };
}
