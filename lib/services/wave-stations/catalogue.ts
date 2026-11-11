import { haversineDistance } from "@/lib/utils/geo-utils";
import type { SourceStation, WaveStationRow, WaveStationSource } from "./types";

const SLUG_NAME_MAX = 60;
/** A wave reading this recent keeps has_wave true even when the source no longer hints it. */
const WAVE_STICKY_MS = 30 * 24 * 60 * 60 * 1000;

export function buildStationId(source: WaveStationSource, sourceStationId: string): string {
  return `${source}:${sourceStationId}`;
}

function slugifyName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= SLUG_NAME_MAX) return base;
  const cut = base.slice(0, SLUG_NAME_MAX);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/**
 * The place part of a name for its slug: a trailing "(...)" note and a
 * "- 27NM SE of San Clemente Is" distance clause are dropped, a trailing
 * state code is kept ("San Clemente Basin - 27NM SE of ..., CA" -> "San
 * Clemente Basin, CA"). The display name keeps both.
 */
function slugPlace(name: string): string {
  const base = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const clause = base.match(/^(.+?)\s+-?\s*\d[\d.]*\s*(?:NM|KM|MI)\b.*$/i);
  if (!clause || !clause[1].trim()) return base;
  const state = base.match(/,\s*([A-Z]{2})$/);
  const place = clause[1].replace(/[\s,-]+$/, "");
  if (!state || new RegExp(`,\\s*${state[1]}$`).test(place)) return place;
  return `${place}, ${state[1]}`;
}

/** "6200105", "K13a", "A121": an id, not a name run together ("WesthinderBuoy", "A2Buoy"). */
export function isShortPlatformCode(code: string): boolean {
  return /\d/.test(code) && !/[A-Za-z]{4,}/.test(code);
}

/**
 * Readable name plus the source station id: "torrey-pines-outer-ca-46225".
 * A name that already starts or ends with the id keeps it once ("m6-west-coast").
 * An empty id gives the name alone ("westhinder-buoy").
 */
export function buildStationSlug(name: string, sourceStationId: string): string {
  const id = sourceStationId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const namePart = slugifyName(slugPlace(name));
  if (!id) return namePart || "buoy";
  if (!namePart || namePart === id || namePart.endsWith(`-${id}`) || namePart.startsWith(`${id}-`)) {
    return namePart || `buoy-${id}`;
  }
  return `${namePart}-${id}`;
}

/** Existing catalogue state the registry sync must preserve. */
export type ExistingStation = Pick<
  WaveStationRow,
  "id" | "slug" | "active" | "last_wave_observed_at"
>;

/** Registry columns the station sync owns; observation and spec state columns are left out. */
type RegistryUpsertRow = Pick<
  WaveStationRow,
  | "id"
  | "source"
  | "source_station_id"
  | "name"
  | "slug"
  | "country_code"
  | "region"
  | "lat"
  | "lon"
  | "station_type"
  | "owner"
  | "program"
  | "cdip_station_id"
  | "wmo_id"
  | "has_wave"
  | "has_swell_split"
  | "has_met"
  | "license"
  | "attribution"
  | "active"
>;

interface RegistryPlan {
  rows: RegistryUpsertRow[];
  deactivateIds: string[];
}

/**
 * Turn a source's station list into catalogue rows.
 * - A slug, once stored, is reused even when the station is renamed.
 * - has_wave stays true while a wave reading is under 30 days old, because one
 *   snapshot can miss waves (buoys report met at :00 and waves later).
 * - Stored stations missing from the source become inactive; nothing is deleted.
 * `existing` holds every source's stations so a new slug never collides.
 */
export function planRegistryUpsert(
  source: WaveStationSource,
  stations: SourceStation[],
  existing: ExistingStation[],
  nowMs: number,
): RegistryPlan {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const takenSlugs = new Set<string>(existing.map((row) => row.slug));
  const seen = new Set<string>();
  const rows: RegistryUpsertRow[] = [];

  for (const station of stations) {
    const id = buildStationId(source, station.sourceStationId);
    if (seen.has(id)) continue;
    seen.add(id);

    const stored = existingById.get(id);
    let slug = stored?.slug;
    if (!slug) {
      slug = buildStationSlug(station.name, station.slugId ?? station.sourceStationId);
      if (takenSlugs.has(slug)) slug = `${slug}-${source}`;
      takenSlugs.add(slug);
    }

    const lastWaveMs = stored?.last_wave_observed_at ? Date.parse(stored.last_wave_observed_at) : NaN;
    const recentWave = Number.isFinite(lastWaveMs) && nowMs - lastWaveMs < WAVE_STICKY_MS;

    rows.push({
      id,
      source,
      source_station_id: station.sourceStationId,
      name: station.name,
      slug,
      country_code: station.countryCode,
      region: station.region,
      lat: station.lat,
      lon: station.lon,
      station_type: station.stationType,
      owner: station.owner,
      program: station.program,
      cdip_station_id: station.cdipStationId,
      wmo_id: station.wmoId ?? null,
      has_wave: station.hasWave || recentWave,
      has_swell_split: station.hasSwellSplit,
      has_met: station.hasMet,
      license: station.license,
      attribution: station.attribution,
      active: true,
    });
  }

  const deactivateIds = existing
    .filter((row) => row.active && row.id.startsWith(`${source}:`) && !seen.has(row.id))
    .map((row) => row.id);

  return { rows, deactivateIds };
}

// ---------------------------------------------------------------------------
// Same physical buoy in two sources
// ---------------------------------------------------------------------------

/**
 * Lower wins. The operator's own feed beats NDBC, which relays some non-US
 * buoys (62095 is the Irish M6) with fewer fields and a rounded position.
 * Copernicus aggregates other operators' feeds, so every direct source beats it.
 */
const SOURCE_PRIORITY: Record<WaveStationSource, number> = {
  marine_ie: 0,
  aodn: 0,
  fmi: 0,
  smhi: 0,
  ndbc: 1,
  copernicus: 2,
};

/** Name-matched stations must be this close. NDBC's M6 position is ~24 km from the Marine Institute's. */
const DUPLICATE_NAME_RADIUS_KM = 30;

/** Words that do not identify a buoy on their own. */
const GENERIC_NAME_WORDS = new Set([
  "buoy", "boj", "wave", "waves", "waverider", "vagboj", "aaltopoiju", "station", "the", "of", "and",
  "north", "south", "east", "west", "northeast", "northwest", "southeast", "southwest", "coast", "bay",
  "island", "is", "point", "head", "harbour", "harbor", "beach", "outer", "inner", "inshore", "offshore",
  "sea", "gulf", "river", "port", "cape", "basin", "nm", "km", "de", "la",
]);

function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2 && !GENERIC_NAME_WORDS.has(token) && !/^\d{1,2}$/.test(token)),
  );
}

function sharesDistinctiveName(a: string, b: string): boolean {
  const tokens = nameTokens(a);
  for (const token of nameTokens(b)) if (tokens.has(token)) return true;
  return false;
}

export type DuplicateCandidate = Pick<
  WaveStationRow,
  "id" | "source" | "name" | "lat" | "lon" | "wmo_id" | "active" | "duplicate_of" | "has_wave"
>;

/**
 * Mark a station as a duplicate of another source's station when both are
 * active, the other source has a higher priority, and either
 * - both carry the same WMO number, or
 * - they are within 30 km and share a distinctive name word ("M6").
 * A primary without waves never hides a station with waves: NDBC relays the
 * UK Met Office K-buoys (62105 = K4) as met-only rows, while Copernicus
 * carries their waves. The nearest such primary wins. A station whose
 * primary goes away is unmarked.
 * Returns only the rows whose duplicate_of must change.
 */
export function planDuplicates(
  stations: DuplicateCandidate[],
): Array<{ id: string; duplicate_of: string | null }> {
  const active = stations.filter((station) => station.active);
  const changes: Array<{ id: string; duplicate_of: string | null }> = [];
  for (const station of stations) {
    let primary: { id: string; km: number } | null = null;
    if (station.active) {
      for (const other of active) {
        if (other.source === station.source) continue;
        if (SOURCE_PRIORITY[other.source] >= SOURCE_PRIORITY[station.source]) continue;
        if (station.has_wave && !other.has_wave) continue;
        const km = haversineDistance(station.lat, station.lon, other.lat, other.lon);
        const sameWmo = Boolean(station.wmo_id) && station.wmo_id === other.wmo_id;
        const sameName = km <= DUPLICATE_NAME_RADIUS_KM && sharesDistinctiveName(station.name, other.name);
        if (!sameWmo && !sameName) continue;
        if (!primary || km < primary.km) primary = { id: other.id, km };
      }
    }
    const next = primary?.id ?? null;
    if ((station.duplicate_of ?? null) !== next) changes.push({ id: station.id, duplicate_of: next });
  }
  return changes;
}
