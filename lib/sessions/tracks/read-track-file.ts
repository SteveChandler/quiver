import { unzipSync } from "fflate";
import { parseFit } from "./parse-fit";
import { parseGpx } from "./parse-gpx";
import type { NormalizedTrack } from "./types";
import { TrackFileError } from "./types";

const EARLIEST_START = Date.parse("2015-01-01T00:00:00.000Z");

export function readTrackFile(bytes: Uint8Array, filename: string, now: Date = new Date()): NormalizedTrack {
  let source = bytes;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    try {
      const entries = unzipSync(bytes, { filter: (file) => /\.(fit|gpx)$/i.test(file.name) });
      const selected = Object.entries(entries).find(([name]) => /\.(fit|gpx)$/i.test(name));
      if (!selected) throw new TrackFileError("unsupported_format", "ZIP contains no FIT or GPX track");
      source = selected[1];
    } catch (error) {
      if (error instanceof TrackFileError) throw error;
      throw new TrackFileError("corrupt", "Could not open the ZIP file");
    }
  }

  let track: NormalizedTrack;
  if (source.length >= 12 && source[8] === 0x2e && source[9] === 0x46 && source[10] === 0x49 && source[11] === 0x54) {
    track = parseFit(source);
  } else {
    const prefix = new TextDecoder().decode(source.subarray(0, 512));
    if (!/<gpx(?:\s|>)/i.test(prefix)) {
      throw new TrackFileError("unsupported_format", `Unsupported track format: ${filename}`);
    }
    track = parseGpx(source);
  }

  const startedAt = Date.parse(track.meta.startedAt);
  const endedAt = Date.parse(track.meta.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)
    || startedAt < EARLIEST_START || startedAt > now.getTime() || endedAt < startedAt) {
    throw new TrackFileError("bad_time", "The track has an implausible start or end time");
  }
  return track;
}
