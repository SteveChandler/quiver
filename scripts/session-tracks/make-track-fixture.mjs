import { readFileSync, writeFileSync } from "node:fs";
import FitParser, { getFitGarminProductDisplayName } from "fit-file-parser";

const DAWN_PATROL_APP_ID = "adb20c3398b5458981649e383a9ac1a1";
const LAT_OFFSET = 0.31;
const LON_OFFSET = -0.47;

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestamp(value) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function recordedBy(data) {
  const device = data.device_infos?.find((item) => String(item.device_index) === "creator")
    ?? data.device_infos?.[0];
  const isGarmin = device?.manufacturer === "garmin";
  const product = (isGarmin ? getFitGarminProductDisplayName(Number(device.product)) : null)
    ?? device?.product_name ?? device?.product;
  const creator = product == null ? null : `${isGarmin ? "Garmin " : ""}${String(product)}`;
  const hasDawnPatrol = data.developer_data_ids?.some((item) => {
    const id = item.application_id;
    return Array.isArray(id) && id.every((byte) => typeof byte === "number")
      && id.map((byte) => byte.toString(16).padStart(2, "0")).join("") === DAWN_PATROL_APP_ID;
  });
  return hasDawnPatrol ? [creator, "Dawn Patrol"].filter(Boolean).join(" / ") : creator;
}

function decodeTrack(bytes) {
  let parsed;
  let parseError;
  new FitParser({ mode: "list", force: false, strict: true, speedUnit: "m/s", temperatureUnit: "celsius" })
    .parse(bytes, (error, data) => {
      parseError = error;
      parsed = data;
    });
  if (parseError || !parsed) throw new Error("Could not decode the FIT file");

  const samples = (parsed.records ?? []).map((record) => ({
    t: timestamp(record.timestamp) ?? "",
    lat: finiteNumber(record.position_lat),
    lon: finiteNumber(record.position_long),
    speedMps: finiteNumber(record.enhanced_speed ?? record.speed),
    hr: finiteNumber(record.heart_rate),
    tempC: finiteNumber(record.temperature),
    cadence: finiteNumber(record.cadence),
  }));
  if (samples.some((sample) => !sample.t)) throw new Error("The FIT file has a record with an invalid time");
  const firstFix = samples.find((sample) => sample.lat !== null && sample.lon !== null);
  const lastFix = samples.findLast((sample) => sample.lat !== null && sample.lon !== null);
  if (!firstFix || !lastFix) throw new Error("This file has no GPS track");

  const session = parsed.sessions?.[0];
  return {
    meta: {
      format: "fit",
      sport: typeof session?.sport === "string" ? session.sport : null,
      subSport: typeof session?.sub_sport === "string" ? session.sub_sport : null,
      recordedBy: recordedBy(parsed),
      startedAt: firstFix.t,
      endedAt: lastFix.t,
    },
    samples,
  };
}

const [input, output, beachLatArg, beachLonArg, swellWindowArg, truthWavesArg, note] = process.argv.slice(2);
if (!input || !output || beachLatArg === undefined || beachLonArg === undefined
  || swellWindowArg === undefined || truthWavesArg === undefined || note === undefined) {
  throw new Error("Usage: make-track-fixture.mjs <in.fit> <out.json> <beachLat> <beachLon> <swellWindowCenterDeg> <truthWaves|null> <note>");
}
const beachLat = Number(beachLatArg);
const beachLon = Number(beachLonArg);
const swellWindowCenterDeg = Number(swellWindowArg);
const waves = truthWavesArg === "null" ? null : Number(truthWavesArg);
if (![beachLat, beachLon, swellWindowCenterDeg].every(Number.isFinite)
  || (waves !== null && !Number.isFinite(waves))) {
  throw new Error("Beach coordinates, swell window, and wave count must be finite numbers");
}

const track = decodeTrack(readFileSync(input));
track.samples = track.samples.map((sample) => ({
  ...sample,
  lat: sample.lat === null ? null : sample.lat + LAT_OFFSET,
  lon: sample.lon === null ? null : sample.lon + LON_OFFSET,
}));
writeFileSync(output, `${JSON.stringify({
  track,
  beach: { lat: beachLat + LAT_OFFSET, lon: beachLon + LON_OFFSET, swellWindowCenterDeg },
  truth: { waves, note },
}, null, 2)}\n`);
