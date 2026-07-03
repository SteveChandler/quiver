import type {
  Bbox,
  NormalizedCreateSurfDropInput,
  NormalizedUpdateSurfDropInput,
  SurfDropAudience,
  SurfDropLocationType,
} from "@/lib/surf-drops/types";
import type { Json } from "@/types/database.generated";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIENCES = new Set<SurfDropAudience>([
  "mutuals",
  "friends",
  "link",
  "private",
]);
const LOCATION_TYPES = new Set<SurfDropLocationType>([
  "known_spot",
  "custom_pin",
]);
const MAX_NOTE_LENGTH = 240;
const MAX_SCHEDULE_AHEAD_MS = 4 * 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_MS = 60 * 60 * 1000;
const MIN_DURATION_MS = 15 * 60 * 1000;

type RawObject = Record<string, unknown>;

function assertObject(value: unknown): RawObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Request body must be an object");
  }
  return value as RawObject;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error(`${field} cannot exceed ${maxLength} characters`);
  }
  return trimmed;
}

function requiredUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_REGEX.test(value)) {
    throw new Error(`${field} must be a valid UUID`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a number`);
  }
  return parsed;
}

function assertLat(value: number | null, field: string): number {
  if (value == null) {
    throw new Error(`${field} is required for custom_pin drops`);
  }
  if (value < -90 || value > 90) {
    throw new Error(`${field} must be between -90 and 90`);
  }
  return value;
}

function assertLon(value: number | null, field: string): number {
  if (value == null) {
    throw new Error(`${field} is required for custom_pin drops`);
  }
  if (value < -180 || value > 180) {
    throw new Error(`${field} must be between -180 and 180`);
  }
  return value;
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`${field} must be a valid ISO timestamp`);
  }
  return date;
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value == null) return null;
  return parseDate(value, field);
}

function validateTimeWindow(startsAt: Date, endsAt: Date, now: Date): void {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("ends_at must be after starts_at");
  }

  if (endsAt.getTime() - startsAt.getTime() < MIN_DURATION_MS) {
    throw new Error("Surf Drops must last at least 15 minutes");
  }

  if (startsAt.getTime() > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    throw new Error("starts_at cannot be more than 4 days ahead");
  }
}

function normalizeAudience(value: unknown): SurfDropAudience {
  if (value == null) return "mutuals";
  if (typeof value !== "string" || !AUDIENCES.has(value as SurfDropAudience)) {
    throw new Error("audience must be one of mutuals, friends, link, private");
  }
  return value as SurfDropAudience;
}

function normalizeLocationType(value: unknown): SurfDropLocationType {
  if (typeof value !== "string" || !LOCATION_TYPES.has(value as SurfDropLocationType)) {
    throw new Error("location_type must be known_spot or custom_pin");
  }
  return value as SurfDropLocationType;
}

function normalizeForecastSnapshot(value: unknown): Json | null {
  if (value == null) return null;
  return value as Json;
}

export function normalizeCreateSurfDropInput(
  raw: unknown,
  now: Date = new Date(),
): NormalizedCreateSurfDropInput {
  const body = assertObject(raw);
  const locationType = normalizeLocationType(body.location_type);
  const startsAt = parseDate(body.starts_at, "starts_at");
  const endsAt =
    parseOptionalDate(body.ends_at, "ends_at") ??
    new Date(startsAt.getTime() + DEFAULT_DURATION_MS);

  validateTimeWindow(startsAt, endsAt, now);

  const base = {
    user_id: undefined,
    location_type: locationType,
    general_area: optionalText(body.general_area, "general_area", 120),
    exact_label: optionalText(body.exact_label, "exact_label", 160),
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    audience: normalizeAudience(body.audience),
    note: optionalText(body.note, "note", MAX_NOTE_LENGTH),
    forecast_snapshot: normalizeForecastSnapshot(body.forecast_snapshot),
  };

  if (locationType === "known_spot") {
    if (!body.beach_id) {
      throw new Error("beach_id is required for known_spot drops");
    }
    return {
      ...base,
      beach_id: requiredUuid(body.beach_id, "beach_id"),
      custom_lat: null,
      custom_lon: null,
    };
  }

  return {
    ...base,
    beach_id: null,
    custom_lat: assertLat(optionalNumber(body.custom_lat, "custom_lat"), "custom_lat"),
    custom_lon: assertLon(optionalNumber(body.custom_lon, "custom_lon"), "custom_lon"),
  };
}

export function normalizeUpdateSurfDropInput(
  raw: unknown,
  existing: Pick<NormalizedCreateSurfDropInput, "starts_at" | "ends_at" | "location_type" | "beach_id" | "custom_lat" | "custom_lon">,
  now: Date = new Date(),
): NormalizedUpdateSurfDropInput {
  const body = assertObject(raw);
  const patch: NormalizedUpdateSurfDropInput = {};

  if ("location_type" in body) {
    patch.location_type = normalizeLocationType(body.location_type);
  }
  const locationType = patch.location_type ?? existing.location_type;

  if ("starts_at" in body) {
    patch.starts_at = parseDate(body.starts_at, "starts_at").toISOString();
  }
  if ("ends_at" in body) {
    patch.ends_at = parseDate(body.ends_at, "ends_at").toISOString();
  }

  const startsAt = new Date(patch.starts_at ?? existing.starts_at);
  const endsAt = new Date(patch.ends_at ?? existing.ends_at);
  validateTimeWindow(startsAt, endsAt, now);

  if ("audience" in body) patch.audience = normalizeAudience(body.audience);
  if ("note" in body) patch.note = optionalText(body.note, "note", MAX_NOTE_LENGTH);
  if ("general_area" in body) {
    patch.general_area = optionalText(body.general_area, "general_area", 120);
  }
  if ("exact_label" in body) {
    patch.exact_label = optionalText(body.exact_label, "exact_label", 160);
  }
  if ("forecast_snapshot" in body) {
    patch.forecast_snapshot = normalizeForecastSnapshot(body.forecast_snapshot);
  }

  if (locationType === "known_spot") {
    if ("beach_id" in body) {
      patch.beach_id = requiredUuid(body.beach_id, "beach_id");
    } else if (!existing.beach_id) {
      throw new Error("beach_id is required for known_spot drops");
    }
    patch.custom_lat = null;
    patch.custom_lon = null;
  }

  if (locationType === "custom_pin") {
    const customLat = "custom_lat" in body
      ? optionalNumber(body.custom_lat, "custom_lat")
      : existing.custom_lat;
    const customLon = "custom_lon" in body
      ? optionalNumber(body.custom_lon, "custom_lon")
      : existing.custom_lon;
    patch.beach_id = null;
    patch.custom_lat = assertLat(customLat, "custom_lat");
    patch.custom_lon = assertLon(customLon, "custom_lon");
  }

  return patch;
}

export function parseBboxParam(value: string | null): Bbox {
  if (!value) {
    throw new Error("bbox is required");
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("bbox must contain four comma-separated numbers");
  }

  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    throw new Error("bbox latitude is out of range");
  }
  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
    throw new Error("bbox longitude is out of range");
  }
  if (minLon >= maxLon || minLat >= maxLat) {
    throw new Error("bbox minimums must be less than maximums");
  }

  return { minLon, minLat, maxLon, maxLat };
}
