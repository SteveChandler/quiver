import FitParser, { getFitGarminProductDisplayName, type ParsedFit } from "fit-file-parser";
import type { NormalizedTrack, TrackSample } from "./types";
import { TrackFileError } from "./types";

// FIT record timestamps become ISO-8601 UTC; semicircle coordinates use x * 180 / 2**31
// (the decoder yields degrees). enhanced_speed ?? speed is m/s; temperature is °C,
// and cadence is the record cadence.
const DAWN_PATROL_APP_ID = "adb20c3398b5458981649e383a9ac1a1";

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function recordedBy(data: ParsedFit): string | null {
  const device = data.device_infos?.find((item) => String(item.device_index) === "creator")
    ?? data.device_infos?.[0];
  const isGarmin = device?.manufacturer === "garmin";
  const product = (isGarmin ? getFitGarminProductDisplayName(Number(device.product)) : null)
    ?? device?.product_name ?? device?.product;
  const creator = product == null ? null : `${isGarmin ? "Garmin " : ""}${String(product)}`;
  const hasDawnPatrol = data.developer_data_ids?.some((item) => {
    const id = item.application_id;
    return Array.isArray(id) && id.every((byte): byte is number => typeof byte === "number")
      && id.map((byte) => byte.toString(16).padStart(2, "0")).join("") === DAWN_PATROL_APP_ID;
  });
  return hasDawnPatrol ? [creator, "Dawn Patrol"].filter(Boolean).join(" / ") : creator;
}

export function parseFit(bytes: Uint8Array): NormalizedTrack {
  let parsed: ParsedFit | undefined;
  let parseError: string | undefined;
  try {
    new FitParser({ mode: "list", force: false, strict: true, speedUnit: "m/s", temperatureUnit: "celsius" })
      .parse(Buffer.from(bytes), (error, data) => {
        parseError = error;
        parsed = data;
      });
  } catch {
    throw new TrackFileError("corrupt", "Could not decode the FIT file");
  }
  if (parseError || !parsed) throw new TrackFileError("corrupt", "Could not decode the FIT file");

  const samples: TrackSample[] = (parsed.records ?? []).map((record) => ({
    t: timestamp(record.timestamp) ?? "",
    lat: finiteNumber(record.position_lat),
    lon: finiteNumber(record.position_long),
    speedMps: finiteNumber(record.enhanced_speed ?? record.speed),
    hr: finiteNumber(record.heart_rate),
    tempC: finiteNumber(record.temperature),
    cadence: finiteNumber(record.cadence),
  }));
  if (samples.some((sample) => !sample.t)) {
    throw new TrackFileError("bad_time", "The FIT file has a record with an invalid time");
  }
  const firstFix = samples.find((sample) => sample.lat !== null && sample.lon !== null);
  const lastFix = samples.findLast((sample) => sample.lat !== null && sample.lon !== null);
  if (!firstFix || !lastFix) throw new TrackFileError("no_gps", "This file has no GPS track");

  const session = parsed.sessions?.[0];
  return {
    meta: {
      format: "fit",
      sport: typeof session?.sport === "string" ? session.sport : null,
      subSport: typeof session?.sub_sport === "string" ? session.sub_sport : null,
      recordedBy: recordedBy(parsed),
      startedAt: firstFix.t,
      endedAt: lastFix.t,
      ...(typeof session?.total_calories === "number"
        && Number.isInteger(session.total_calories) && session.total_calories >= 0
        && session.total_calories <= 32767 ? { calories: session.total_calories } : {}),
    },
    samples,
  };
}
