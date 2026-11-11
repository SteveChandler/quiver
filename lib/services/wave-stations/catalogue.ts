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

/** Readable name plus the source station id: "torrey-pines-outer-ca-46225". */
export function buildStationSlug(name: string, sourceStationId: string): string {
  const id = sourceStationId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const namePart = slugifyName(name);
  if (!namePart || namePart === id || namePart.endsWith(`-${id}`)) {
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
      slug = buildStationSlug(station.name, station.sourceStationId);
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
