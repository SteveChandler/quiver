import { createHash } from "node:crypto";

const ENDPOINT = "https://single-runs-api.open-meteo.com/v1/forecast";
const MODEL = "ncep_gfswave016";
const PARSER_VERSION = "open-meteo-single-runs-receipt.v1";
const HOURLY_FIELDS = ["swell_wave_height", "swell_wave_period", "swell_wave_direction", "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"] as const;
const ENVELOPE_FIELDS = ["latitude", "longitude", "generationtime_ms", "utc_offset_seconds", "timezone", "timezone_abbreviation", "elevation", "hourly_units", "hourly"] as const;
const RUN = /^\d{4}-\d{2}-\d{2}T(?:00|06|12|18):00Z$/;
const MAX_RESPONSE_BYTES = 524_288;

type FetchResponse = { status: number; text: () => Promise<string> };
type PartitionValues = {
  heightM: number;
  periodS: number;
  directionDeg: number;
  unavailableReason?: "provider_zero_tuple";
};

interface OpenMeteoSingleRunInput {
  latitude: number;
  longitude: number;
  runUtc: string;
  forecastDays: number;
}

export interface OpenMeteoSingleRunRequest {
  method: "GET";
  url: string;
  requestedRunUtc: string;
}

export interface PrototypeSingleRunReceipt {
  schemaVersion: typeof PARSER_VERSION;
  parserVersion: typeof PARSER_VERSION;
  requested: {
    canonicalRequest: OpenMeteoSingleRunRequest;
    runUtc: string;
    model: typeof MODEL;
    transportProvider: "open_meteo_single_runs";
    upstreamModelProvider: "ncep";
  };
  rawResponse: string;
  canonicalSemanticPayload: string;
  rawResponseSha256: string;
  revisionHash: string;
  prototypeIssuanceIdentity: string;
  prototypeEvaluationIdentity: string;
  prototypeReceiptKey: string;
  qualification: {
    status: "prototype_unqualified";
    reason: "provider_response_does_not_echo_run_and_completion_not_operationally_proven";
  };
  selectedGrid: {
    latitude: number;
    longitude: number;
    elevationM: number;
    distanceFromRequestedKm: number;
    policy: { status: "prototype_local_mapping_policy"; maxDistanceKm: 30; providerGuarantee: false };
  };
  observations: Array<{
    providerForecastAt: string;
    forecastAtUtc: string;
    timeProvenance: { field: "time"; timezone: "UTC" };
    components: [
      PartitionValues & { sourceSlot: "s1"; rawFieldProvenance: { height: "swell_wave_height"; period: "swell_wave_period"; direction: "swell_wave_direction" } },
      PartitionValues & { sourceSlot: "s2"; rawFieldProvenance: { height: "secondary_swell_wave_height"; period: "secondary_swell_wave_period"; direction: "secondary_swell_wave_direction" } },
    ];
  }>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function validInput(input: OpenMeteoSingleRunInput): void {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) throw new Error("Single Runs coordinates are invalid");
  const runTime = new Date(input.runUtc);
  if (!RUN.test(input.runUtc) || !Number.isFinite(runTime.getTime()) || `${runTime.toISOString().slice(0, 16)}Z` !== input.runUtc) throw new Error("Single Runs run must be an aligned UTC 00/06/12/18 minute");
  if (!Number.isInteger(input.forecastDays) || input.forecastDays < 1 || input.forecastDays > 7) throw new Error("Single Runs forecast days are invalid");
}

function expectedSlots(runUtc: string, forecastDays: number): string[] {
  const start = Date.parse(runUtc);
  return Array.from({ length: forecastDays * 24 }, (_, index) => new Date(start + index * 3_600_000).toISOString().slice(0, 16));
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function tuple(height: unknown, period: unknown, direction: unknown): PartitionValues {
  if (height === 0 && period === 0 && direction === 0) {
    return { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" };
  }
  if (typeof height !== "number" || !Number.isFinite(height) || height < 0 || typeof period !== "number" || !Number.isFinite(period) || period <= 0 || typeof direction !== "number" || !Number.isFinite(direction) || direction < 0 || direction >= 360) throw new Error("Single Runs tuple is invalid");
  return { heightM: height, periodS: period, directionDeg: direction };
}

function parseHourly(value: unknown, runUtc: string, forecastDays: number): PrototypeSingleRunReceipt["observations"] {
  if (!record(value)) throw new Error("Single Runs hourly response is invalid");
  const keys = Object.keys(value).sort();
  const expectedKeys = ["time", ...HOURLY_FIELDS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) throw new Error("Single Runs hourly response is unexpected");
  const time = value.time;
  const fields = HOURLY_FIELDS.map((field) => value[field]);
  if (!Array.isArray(time) || fields.some((field) => !Array.isArray(field))) throw new Error("Single Runs hourly arrays are invalid");
  const arrays = fields as unknown[][];
  const slots = expectedSlots(runUtc, forecastDays);
  if (time.length !== slots.length || arrays.some((field) => field.length !== slots.length) || time.some((value, index) => value !== slots[index])) throw new Error("Single Runs hourly slots are invalid");
  return slots.map((forecastAtUtc, index) => {
    const s1 = tuple(arrays[0][index], arrays[1][index], arrays[2][index]);
    const s2 = tuple(arrays[3][index], arrays[4][index], arrays[5][index]);
    return { providerForecastAt: forecastAtUtc, forecastAtUtc: `${forecastAtUtc}Z`, timeProvenance: { field: "time", timezone: "UTC" }, components: [
      { sourceSlot: "s1", ...s1, rawFieldProvenance: { height: "swell_wave_height", period: "swell_wave_period", direction: "swell_wave_direction" } },
      { sourceSlot: "s2", ...s2, rawFieldProvenance: { height: "secondary_swell_wave_height", period: "secondary_swell_wave_period", direction: "secondary_swell_wave_direction" } },
    ] };
  });
}

function parseEnvelope(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error("Single Runs top-level response is unexpected");
  const keys = Object.keys(value).sort();
  const expected = [...ENVELOPE_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new Error("Single Runs top-level response is unexpected");
  if (typeof value.latitude !== "number" || !Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90 || typeof value.longitude !== "number" || !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180 || typeof value.generationtime_ms !== "number" || !Number.isFinite(value.generationtime_ms) || value.generationtime_ms < 0 || value.utc_offset_seconds !== 0 || (value.timezone !== "UTC" && value.timezone !== "GMT") || (value.timezone_abbreviation !== "UTC" && value.timezone_abbreviation !== "GMT") || typeof value.elevation !== "number" || !Number.isFinite(value.elevation) || !record(value.hourly_units)) throw new Error("Single Runs top-level response is invalid");
  const hourlyUnits = value.hourly_units;
  const expectedUnits: Record<string, string> = { time: "iso8601", swell_wave_height: "m", swell_wave_period: "s", swell_wave_direction: "°", secondary_swell_wave_height: "m", secondary_swell_wave_period: "s", secondary_swell_wave_direction: "°" };
  const unitKeys = Object.keys(hourlyUnits).sort();
  const expectedUnitKeys = Object.keys(expectedUnits).sort();
  if (unitKeys.length !== expectedUnitKeys.length || unitKeys.some((key, index) => key !== expectedUnitKeys[index]) || unitKeys.some((key) => hourlyUnits[key] !== expectedUnits[key])) throw new Error("Single Runs hourly units are invalid");
  return value;
}

function selectedGrid(input: OpenMeteoSingleRunInput, envelope: Record<string, unknown>): PrototypeSingleRunReceipt["selectedGrid"] {
  const latitude = envelope.latitude as number;
  const longitude = envelope.longitude as number;
  const latitudeRadians = (latitude - input.latitude) * Math.PI / 180;
  const longitudeDelta = ((longitude - input.longitude + 540) % 360) - 180;
  const longitudeRadians = longitudeDelta * Math.PI / 180;
  const a = Math.sin(latitudeRadians / 2) ** 2 + Math.cos(input.latitude * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.sin(longitudeRadians / 2) ** 2;
  const distanceFromRequestedKm = 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (distanceFromRequestedKm > 30) throw new Error("Single Runs selected grid is outside the prototype mapping policy");
  return { latitude, longitude, elevationM: envelope.elevation as number, distanceFromRequestedKm, policy: { status: "prototype_local_mapping_policy", maxDistanceKm: 30, providerGuarantee: false } };
}

export function buildOpenMeteoSingleRunRequest(input: OpenMeteoSingleRunInput): OpenMeteoSingleRunRequest {
  validInput(input);
  const query = new URLSearchParams([
    ["latitude", String(input.latitude)], ["longitude", String(input.longitude)], ["models", MODEL], ["hourly", HOURLY_FIELDS.join(",")],
    ["run", input.runUtc.slice(0, -1)], ["cell_selection", "sea"], ["timezone", "UTC"], ["forecast_days", String(input.forecastDays)],
  ]);
  return { method: "GET", url: `${ENDPOINT}?${query.toString()}`, requestedRunUtc: input.runUtc };
}

/** Local-only prototype: never elevates a transport response into a completed evaluation. */
export async function fetchOpenMeteoSingleRunReceipt(input: OpenMeteoSingleRunInput, fetcher: (url: string, init: { method: "GET"; redirect: "error" }) => Promise<FetchResponse>): Promise<PrototypeSingleRunReceipt> {
  const canonicalRequest = buildOpenMeteoSingleRunRequest(input);
  const response = await fetcher(canonicalRequest.url, { method: canonicalRequest.method, redirect: "error" });
  if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300) throw new Error("Single Runs HTTP response was unsuccessful");
  const raw = await response.text();
  if (Buffer.byteLength(raw,"utf8") > MAX_RESPONSE_BYTES) throw new Error("Single Runs response exceeds the durable receipt limit");
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { throw new Error("Single Runs response JSON is invalid"); }
  const envelope = parseEnvelope(decoded);
  const rawResponseSha256 = sha256(raw);
  const prototypeIssuanceIdentity = sha256(JSON.stringify({ transportProvider: "open_meteo_single_runs", model: MODEL, runUtc: input.runUtc }));
  const prototypeEvaluationIdentity = sha256(JSON.stringify({ parser: PARSER_VERSION, prototypeIssuanceIdentity, requestedScope: canonicalRequest }));
  const canonicalSemanticPayload = stable({ latitude: envelope.latitude, longitude: envelope.longitude, utc_offset_seconds: envelope.utc_offset_seconds, timezone: envelope.timezone, timezone_abbreviation: envelope.timezone_abbreviation, elevation: envelope.elevation, hourly_units: envelope.hourly_units, hourly: envelope.hourly });
  const revisionHash = sha256(canonicalSemanticPayload);
  const mappedGrid = selectedGrid(input, envelope);
  return {
    schemaVersion: PARSER_VERSION, parserVersion: PARSER_VERSION,
    requested: { canonicalRequest, runUtc: input.runUtc, model: MODEL, transportProvider: "open_meteo_single_runs", upstreamModelProvider: "ncep" },
    rawResponse: raw, canonicalSemanticPayload, rawResponseSha256, revisionHash, prototypeIssuanceIdentity, prototypeEvaluationIdentity,
    prototypeReceiptKey: sha256(`${prototypeEvaluationIdentity}:${revisionHash}`),
    qualification: { status: "prototype_unqualified", reason: "provider_response_does_not_echo_run_and_completion_not_operationally_proven" },
    selectedGrid: mappedGrid,
    observations: parseHourly(envelope.hourly, input.runUtc, input.forecastDays),
  };
}
