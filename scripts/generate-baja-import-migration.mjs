#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_INPUT = path.join(
  REPO_ROOT,
  "docs/imports/baja-surf-spots/2026-08-27/baja-surf-spots-production-v2.json"
);
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "supabase/migrations/20260827190000_import_baja_surf_spots.sql"
);
const EXPECTED_SPOT_COUNT = 112;
const EXPECTED_INSERT_COUNT = 105;
const EXPECTED_UPDATE_COUNT = 7;

function sqlText(value) {
  if (value == null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  if (value == null) return "NULL";
  if (!Number.isFinite(value)) throw new Error(`Invalid number: ${value}`);
  return String(value);
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlTextArray(values) {
  if (values == null) return "NULL";
  return `ARRAY[${values.map(sqlText).join(", ")}]::text[]`;
}

function sqlIntegerArray(values) {
  if (values == null) return "NULL";
  return `ARRAY[${values.map(sqlNumber).join(", ")}]::integer[]`;
}

function sqlJson(value) {
  if (value == null) return "NULL";
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function circularWindow(min, max) {
  const width = (max - min + 360) % 360;
  return {
    center: (min + width / 2) % 360,
    halfwidth: width / 2,
  };
}

function assertDataset(dataset) {
  const spots = dataset.spots.filter((spot) => spot.import_eligible === true);
  const inserts = spots.filter((spot) => spot.import_action === "insert_new");
  const updates = spots.filter(
    (spot) => spot.import_action === "update_existing_preserve_uuid"
  );

  if (spots.length !== EXPECTED_SPOT_COUNT) {
    throw new Error(`Expected ${EXPECTED_SPOT_COUNT} eligible spots, found ${spots.length}`);
  }
  if (inserts.length !== EXPECTED_INSERT_COUNT) {
    throw new Error(`Expected ${EXPECTED_INSERT_COUNT} inserts, found ${inserts.length}`);
  }
  if (updates.length !== EXPECTED_UPDATE_COUNT) {
    throw new Error(`Expected ${EXPECTED_UPDATE_COUNT} updates, found ${updates.length}`);
  }

  const ids = new Set();
  const names = new Set();
  const slugs = new Set();
  for (const spot of spots) {
    if (!spot.quiver_beach_id || !spot.name || !spot.slug || !spot.timezone) {
      throw new Error(`Missing required import field for ${spot.source_spot_id}`);
    }
    if (!spot.recommendation_ready || !spot.catalog_ready) {
      throw new Error(`Non-ready spot marked import eligible: ${spot.source_spot_id}`);
    }
    if (spot.seo_indexable !== false) {
      throw new Error(`SEO must remain disabled for ${spot.source_spot_id}`);
    }
    if (spot.swell_window_min_deg == null || spot.swell_window_max_deg == null) {
      throw new Error(`Missing swell window for ${spot.source_spot_id}`);
    }
    if (
      spot.swell_window_min_deg < 0 ||
      spot.swell_window_min_deg >= 360 ||
      spot.swell_window_max_deg < 0 ||
      spot.swell_window_max_deg >= 360
    ) {
      throw new Error(`Swell window outside [0, 360) for ${spot.source_spot_id}`);
    }
    if (!spot.media?.hero?.visual_reviewed) {
      throw new Error(`Hero image is not approved for ${spot.source_spot_id}`);
    }
    for (const [label, value, seen] of [
      ["UUID", spot.quiver_beach_id, ids],
      ["name", spot.name.toLowerCase(), names],
      ["slug", spot.slug.toLowerCase(), slugs],
    ]) {
      if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
      seen.add(value);
    }
  }

  return spots;
}

function buildPreferenceModel(dataset, spot) {
  return {
    ...spot.preference_model,
    import_provenance: {
      dataset_id: dataset.dataset_id,
      source_spot_id: spot.source_spot_id,
      import_action: spot.import_action,
      recommendation_ready: spot.recommendation_ready,
      recommendation_confidence: spot.recommendation_confidence,
      coordinate_review: spot.coordinate_editorial_review,
      access_and_hazard_review: spot.access_and_hazard_editorial_review,
      swell_window_evidence: spot.swell_window_evidence,
      surfline_reference: spot.surfline_reference,
      forecast_validation: spot.forecast_validation,
    },
  };
}

function beachValue(dataset, spot) {
  const window = circularWindow(spot.swell_window_min_deg, spot.swell_window_max_deg);
  const values = [
    `${sqlText(spot.quiver_beach_id)}::uuid`,
    sqlText(spot.source_spot_id),
    sqlText(spot.import_action),
    sqlText(spot.name),
    sqlText(spot.slug),
    sqlText(spot.city),
    sqlText(spot.state),
    sqlText(spot.country),
    sqlText(spot.region),
    sqlText(spot.timezone),
    sqlNumber(spot.lat),
    sqlNumber(spot.lon),
    sqlText(spot.break_type),
    sqlText(spot.skill_level),
    sqlTextArray(spot.hazards),
    sqlTextArray(spot.break_categories),
    sqlTextArray(spot.warnings),
    sqlText(spot.description),
    sqlText(spot.access_tips),
    sqlText(spot.wave_tips),
    sqlText(spot.crowd_tips),
    sqlText(spot.best_conditions_prose),
    sqlIntegerArray(spot.best_months),
    sqlNumber(spot.wind_offshore_deg),
    sqlNumber(spot.wind_offshore_tol_deg),
    sqlNumber(spot.wind_cross_shore_ok_kt),
    sqlNumber(spot.wind_onshore_bad_kt),
    sqlNumber(spot.max_wind_onshore_mph),
    sqlNumber(spot.max_wind_any_mph),
    sqlNumber(spot.swell_window_min_deg),
    sqlNumber(spot.swell_window_max_deg),
    sqlNumber(window.center),
    sqlNumber(window.halfwidth),
    sqlNumber(spot.preferred_tide_ft_min),
    sqlNumber(spot.preferred_tide_ft_max),
    sqlText(spot.preferred_tide_direction),
    sqlText(spot.tide_direction_sensitivity),
    sqlJson(buildPreferenceModel(dataset, spot)),
    sqlJson(spot.editorial_sources),
    sqlBoolean(spot.seo_indexable),
  ];
  return `  (${values.join(", ")})`;
}

function photoValue(spot) {
  const hero = spot.media.hero;
  const imageUrl = hero.image_url ?? hero.local_path;
  const thumbUrl = hero.thumb_url ?? imageUrl;
  const creatorUrl = hero.source_page_url ?? null;
  if (!imageUrl) throw new Error(`Missing hero URL for ${spot.source_spot_id}`);

  return `  (${[
    `${sqlText(spot.quiver_beach_id)}::uuid`,
    sqlText(hero.source),
    sqlText(hero.source_id),
    sqlText(imageUrl),
    sqlText(thumbUrl),
    sqlText(hero.title),
    sqlText(hero.creator_name),
    sqlText(creatorUrl),
    sqlText(hero.license_code),
    sqlText(hero.license_url),
    sqlText(hero.attribution_html),
  ].join(", ")})`;
}

function buildMigration(dataset, spots) {
  const beachValues = spots.map((spot) => beachValue(dataset, spot)).join(",\n");
  const photoValues = spots.map(photoValue).join(",\n");

  return `-- Generated by scripts/generate-baja-import-migration.mjs.
-- Source: ${dataset.dataset_id}
-- Imports 112 rankable Baja surf spots; the two parent-area metadata records are excluded.
-- SEO remains disabled pending separate human editorial approval.

BEGIN;

CREATE TEMP TABLE _baja_spots_import (
  id uuid PRIMARY KEY,
  source_spot_id text NOT NULL,
  import_action text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  city text,
  state text,
  country text,
  region text,
  timezone text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  break_type text,
  skill_level text,
  hazards text[],
  features text[],
  warnings text[],
  description text,
  access_tips text,
  wave_tips text,
  crowd_tips text,
  best_conditions_prose text,
  best_months integer[],
  wind_offshore_deg double precision,
  wind_offshore_tol_deg double precision,
  wind_cross_shore_ok_kt double precision,
  wind_onshore_bad_kt double precision,
  max_wind_onshore_mph double precision,
  max_wind_any_mph double precision,
  swell_window_min_deg double precision NOT NULL,
  swell_window_max_deg double precision NOT NULL,
  swell_window_center_deg double precision NOT NULL,
  swell_window_halfwidth_deg double precision NOT NULL,
  preferred_tide_ft_min double precision,
  preferred_tide_ft_max double precision,
  preferred_tide_direction text,
  tide_direction_sensitivity text,
  preference_model jsonb NOT NULL,
  editorial_sources jsonb NOT NULL,
  seo_indexable boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO _baja_spots_import VALUES
${beachValues};

DO $preflight$
DECLARE
  v_collision_count integer;
  v_missing_update_count integer;
BEGIN
  IF (SELECT count(*) FROM _baja_spots_import) <> ${EXPECTED_SPOT_COUNT} THEN
    RAISE EXCEPTION 'Baja import aborted: expected ${EXPECTED_SPOT_COUNT} staged spots';
  END IF;

  SELECT count(*) INTO v_collision_count
  FROM public.beaches AS b
  JOIN _baja_spots_import AS s ON lower(b.name) = lower(s.name)
  WHERE b.id <> s.id;
  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'Baja import aborted: % beach name(s) belong to a different UUID', v_collision_count;
  END IF;

  SELECT count(*) INTO v_missing_update_count
  FROM _baja_spots_import AS s
  LEFT JOIN public.beaches AS b ON b.id = s.id
  WHERE s.import_action = 'update_existing_preserve_uuid'
    AND b.id IS NULL;
  IF v_missing_update_count > 0 THEN
    RAISE EXCEPTION 'Baja import aborted: % expected existing beach UUID(s) are missing', v_missing_update_count;
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public._backup_baja_beaches_20260827 (
  id uuid PRIMARY KEY,
  row_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._backup_baja_beaches_20260827 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._backup_baja_beaches_20260827 FROM anon, authenticated;

INSERT INTO public._backup_baja_beaches_20260827 (id, row_data)
SELECT b.id, to_jsonb(b)
FROM public.beaches AS b
JOIN _baja_spots_import AS s ON s.id = b.id
WHERE s.import_action = 'update_existing_preserve_uuid'
  AND NOT EXISTS (
    SELECT 1
    FROM public._backup_baja_beaches_20260827 AS backup
    WHERE backup.id = b.id
  );

INSERT INTO public.beaches (
  id, name, slug, city, state, country, region, timezone, lat, lon,
  break_type, skill_level, hazards, features, warnings, description,
  access_tips, wave_tips, crowd_tips, best_conditions_prose, best_months,
  wind_offshore_deg, wind_offshore_tol_deg, wind_cross_shore_ok_kt,
  wind_onshore_bad_kt, max_wind_onshore_mph, max_wind_any_mph,
  swell_window_min_deg, swell_window_max_deg, swell_window_center_deg,
  swell_window_halfwidth_deg, preferred_tide_ft_min, preferred_tide_ft_max,
  preferred_tide_direction, tide_direction_sensitivity, preference_model,
  editorial_sources, seo_indexable, is_private
)
SELECT
  s.id, s.name, s.slug, s.city, s.state, s.country, s.region, s.timezone,
  s.lat, s.lon, s.break_type, s.skill_level, s.hazards, s.features,
  s.warnings, s.description, s.access_tips, s.wave_tips, s.crowd_tips,
  s.best_conditions_prose, s.best_months, s.wind_offshore_deg,
  s.wind_offshore_tol_deg, s.wind_cross_shore_ok_kt, s.wind_onshore_bad_kt,
  s.max_wind_onshore_mph, s.max_wind_any_mph, s.swell_window_min_deg,
  s.swell_window_max_deg, s.swell_window_center_deg,
  s.swell_window_halfwidth_deg, s.preferred_tide_ft_min,
  s.preferred_tide_ft_max, s.preferred_tide_direction,
  s.tide_direction_sensitivity, s.preference_model, s.editorial_sources,
  s.seo_indexable, false
FROM _baja_spots_import AS s
WHERE NOT EXISTS (SELECT 1 FROM public.beaches AS b WHERE b.id = s.id);

UPDATE public.beaches AS b
SET
  name = s.name,
  slug = s.slug,
  city = s.city,
  state = s.state,
  country = s.country,
  region = s.region,
  timezone = s.timezone,
  lat = s.lat,
  lon = s.lon,
  break_type = s.break_type,
  skill_level = s.skill_level,
  hazards = s.hazards,
  features = s.features,
  warnings = s.warnings,
  description = s.description,
  access_tips = s.access_tips,
  wave_tips = s.wave_tips,
  crowd_tips = s.crowd_tips,
  best_conditions_prose = s.best_conditions_prose,
  best_months = s.best_months,
  wind_offshore_deg = s.wind_offshore_deg,
  wind_offshore_tol_deg = s.wind_offshore_tol_deg,
  wind_cross_shore_ok_kt = s.wind_cross_shore_ok_kt,
  wind_onshore_bad_kt = s.wind_onshore_bad_kt,
  max_wind_onshore_mph = s.max_wind_onshore_mph,
  max_wind_any_mph = s.max_wind_any_mph,
  swell_window_min_deg = s.swell_window_min_deg,
  swell_window_max_deg = s.swell_window_max_deg,
  swell_window_center_deg = s.swell_window_center_deg,
  swell_window_halfwidth_deg = s.swell_window_halfwidth_deg,
  preferred_tide_ft_min = s.preferred_tide_ft_min,
  preferred_tide_ft_max = s.preferred_tide_ft_max,
  preferred_tide_direction = s.preferred_tide_direction,
  tide_direction_sensitivity = s.tide_direction_sensitivity,
  preference_model = s.preference_model,
  editorial_sources = s.editorial_sources,
  seo_indexable = false,
  is_private = false,
  deleted_at = NULL
FROM _baja_spots_import AS s
WHERE b.id = s.id;

CREATE TEMP TABLE _baja_photos_import (
  beach_id uuid NOT NULL,
  source text NOT NULL,
  source_id text NOT NULL,
  image_url text NOT NULL,
  thumb_url text,
  title text,
  creator_name text,
  creator_url text,
  license_code text,
  license_url text,
  attribution_html text,
  PRIMARY KEY (beach_id, source, source_id)
) ON COMMIT DROP;

INSERT INTO _baja_photos_import VALUES
${photoValues};

CREATE TABLE IF NOT EXISTS public._backup_baja_beach_photos_20260827 (
  id uuid PRIMARY KEY,
  row_data jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public._backup_baja_beach_photos_20260827 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public._backup_baja_beach_photos_20260827 FROM anon, authenticated;

INSERT INTO public._backup_baja_beach_photos_20260827 (id, row_data)
SELECT bp.id, to_jsonb(bp)
FROM public.beach_photos AS bp
JOIN _baja_photos_import AS p
  ON p.beach_id = bp.beach_id
 AND p.source = bp.source
 AND p.source_id = bp.source_id
WHERE (
    bp.image_url IS DISTINCT FROM p.image_url
    OR bp.thumb_url IS DISTINCT FROM p.thumb_url
    OR bp.title IS DISTINCT FROM p.title
    OR bp.creator_name IS DISTINCT FROM p.creator_name
    OR bp.creator_url IS DISTINCT FROM p.creator_url
    OR bp.license_code IS DISTINCT FROM p.license_code
    OR bp.license_url IS DISTINCT FROM p.license_url
    OR bp.attribution_html IS DISTINCT FROM p.attribution_html
    OR bp.approved IS DISTINCT FROM true
    OR bp.deleted_at IS NOT NULL
  )
  AND NOT EXISTS (
  SELECT 1
  FROM public._backup_baja_beach_photos_20260827 AS backup
  WHERE backup.id = bp.id
);

INSERT INTO public.beach_photos (
  beach_id, source, source_id, image_url, thumb_url, title, creator_name,
  creator_url, license_code, license_url, attribution_html, approved, deleted_at
)
SELECT
  p.beach_id, p.source, p.source_id, p.image_url, p.thumb_url, p.title,
  p.creator_name, p.creator_url, p.license_code, p.license_url,
  p.attribution_html, true, NULL::timestamptz
FROM _baja_photos_import AS p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.beach_photos AS existing
  WHERE existing.beach_id = p.beach_id
    AND existing.source = p.source
    AND existing.source_id = p.source_id
);

UPDATE public.beach_photos AS bp
SET
  image_url = p.image_url,
  thumb_url = p.thumb_url,
  title = p.title,
  creator_name = p.creator_name,
  creator_url = p.creator_url,
  license_code = p.license_code,
  license_url = p.license_url,
  attribution_html = p.attribution_html,
  approved = true,
  deleted_at = NULL,
  fetched_at = now()
FROM _baja_photos_import AS p
WHERE bp.beach_id = p.beach_id
  AND bp.source = p.source
  AND bp.source_id = p.source_id;

DO $verify$
DECLARE
  v_beach_count integer;
  v_photo_count integer;
  v_seo_count integer;
BEGIN
  SELECT count(*) INTO v_beach_count
  FROM public.beaches AS b
  JOIN _baja_spots_import AS s ON s.id = b.id
  WHERE b.deleted_at IS NULL;

  SELECT count(*) INTO v_photo_count
  FROM _baja_photos_import AS p
  JOIN public.beach_photos AS bp
    ON bp.beach_id = p.beach_id
   AND bp.source = p.source
   AND bp.source_id = p.source_id
  WHERE bp.approved = true AND bp.deleted_at IS NULL;

  SELECT count(*) INTO v_seo_count
  FROM public.beaches AS b
  JOIN _baja_spots_import AS s ON s.id = b.id
  WHERE b.seo_indexable = true;

  IF v_beach_count <> ${EXPECTED_SPOT_COUNT} OR v_photo_count <> ${EXPECTED_SPOT_COUNT} THEN
    RAISE EXCEPTION
      'Baja import verification failed: beaches %, photos %',
      v_beach_count, v_photo_count;
  END IF;
  IF v_seo_count <> 0 THEN
    RAISE EXCEPTION 'Baja import verification failed: % beaches unexpectedly SEO-enabled', v_seo_count;
  END IF;
END
$verify$;

COMMIT;

-- Rollback is intentionally manual. The first-capture backup tables preserve the
-- seven updated beach rows and any replaced photo rows. Before deleting the 105
-- inserted UUIDs, verify that no user or forecast data references them.
`;
}

async function main() {
  const inputPath = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
  const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);
  const dataset = JSON.parse(await readFile(inputPath, "utf8"));
  const spots = assertDataset(dataset);
  const migration = buildMigration(dataset, spots);
  await writeFile(outputPath, migration, "utf8");
  console.log(`Generated ${outputPath} from ${spots.length} spots`);
}

await main();
