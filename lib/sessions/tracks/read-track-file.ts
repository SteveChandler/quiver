import { unzipSync } from "fflate";
import { parseFit } from "./parse-fit";
import { parseGpx } from "./parse-gpx";
import type { NormalizedTrack } from "./types";
import { TrackFileError } from "./types";

const EARLIEST_START = Date.parse("2015-01-01T00:00:00.000Z");
const MAX_ZIP_TRACK_BYTES = 50 * 2 ** 20;

export function readTrackFile(bytes: Uint8Array, filename: string, now: Date = new Date()): NormalizedTrack {
  let source = bytes;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    try {
      let oversizedTrack = false;
      let selectedTrack = false;
      const entries = unzipSync(bytes, { filter: (file) => {
        const parts = file.name.split(/[\\/]/);
        if (parts.includes("__MACOSX") || parts.at(-1)?.startsWith("._")
          || !/\.(fit|gpx)$/i.test(file.name)) return false;
        if (file.originalSize > MAX_ZIP_TRACK_BYTES) {
          oversizedTrack = true;
          return false;
        }
        // Inflate one track only, so multiple entries cannot multiply the memory limit.
        if (selectedTrack) return false;
        selectedTrack = true;
        return true;
      } });
      const selected = Object.values(entries)[0];
      if (!selected) {
        if (oversizedTrack) throw new TrackFileError("corrupt", "ZIP track exceeds the 50 MiB size limit");
        throw new TrackFileError("unsupported_format", "ZIP contains no FIT or GPX track");
      }
      source = selected;
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
