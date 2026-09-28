import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { buildCamEmbed } from "@/lib/media/cam-embed";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260926190000_add_east_coast_competitive_gap_beaches.sql",
  ),
  "utf8",
);

const research = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "docs/research/east-coast-beach-expansion-2026-09-26.json",
    ),
    "utf8",
  ),
) as {
  precision_review: { cameras_assigned: number };
  camera_review: {
    permission_status: string;
    cameras: Array<{
      beach_id: string;
      slug: string;
      alias: string;
      camera_url: string;
      thumbnail_url: string;
      direct: { status: number; valid: boolean; segment_status: number };
      proxy: { status: number; valid: boolean; segment_status: number };
      still_status: number;
    }>;
  };
  counts: {
    supplied: number;
    import: number;
    resolved_without_new_row: number;
    approved_reviewed_heroes: number;
    generated_regional_assets: number;
    spots_with_hero_coverage: number;
  };
  hero_media: Array<{
    slug: string;
    source: string;
    source_id: string;
    license: string;
    scope_note?: string;
  }>;
  generated_assets: Array<{
    id: string;
    local_path: string;
    status: string;
    exact_location_verified: boolean;
    disclosure: string;
  }>;
  decisions: Array<{ supplied_name: string; decision: string; targetSlug: string }>;
  imports: Array<{
    id: string;
    slug: string;
    timezone: string;
    tide_stage: string | null;
    tide_note: string;
    aspect: number;
    offshore: number;
    lat: number;
    lon: number;
    precision_review: {
      camera_status: string;
      orientation_method: string;
      orientation_source_url: string;
      bathymetry_status: string;
      swell_window_override_note?: string;
      terrain: { local_open_sector: { min_deg: number; max_deg: number } };
    };
    swell_min: number;
    swell_max: number;
    swell_center: number;
    swell_halfwidth: number;
    recommendation_eligible: boolean;
    seo_indexable: boolean;
    is_private: boolean;
    hero_fallback_id?: string;
    preferred_tide_direction: "rising" | null;
    tide_direction_sensitivity: "low";
    editorial_sources: Array<{ url: string; publisher: string; fields: string[] }>;
  }>;
};

describe("East Coast competitive-gap beach catalog", () => {
  it("maps only seven authorized Surfline views through the existing HLS integration", () => {
    const expected: Record<string, string> = {
      "long-sands-beach-york-me": "ec-longsands",
      "jennettes-pier-northside-nags-head-nc": "ec-jennettesnorth",
      "kitty-hawk-pier-kitty-hawk-nc": "ec-kittyhawk",
      "oceanana-pier-atlantic-beach-nc": "ec-oceananapier",
      "bogue-inlet-pier-emerald-isle-nc": "ec-bogueinletpier",
      "cherry-grove-pier-southside-north-myrtle-beach-sc": "ec-cherrypiersouth",
      "cherry-grove-pier-northside-north-myrtle-beach-sc": "ec-cherrypiernorth",
    };
    expect(research.precision_review.cameras_assigned).toBe(7);
    expect(research.camera_review.permission_status).toBe("user_attested_authorized");
    expect(research.camera_review.cameras).toHaveLength(7);
    expect(Object.fromEntries(research.camera_review.cameras.map((c) => [c.slug, c.alias]))).toEqual(expected);
    const cameraSql = migration.slice(migration.indexOf("INSERT INTO _east_coast_cameras"), migration.indexOf("WITH hero_photos"));
    expect([...cameraSql.matchAll(/'([0-9a-f-]{36})'::uuid/g)]).toHaveLength(7);
    for (const c of research.camera_review.cameras) {
      const beach = research.imports.find((b) => b.slug === c.slug);
      expect(beach?.id).toBe(c.beach_id);
      expect(beach?.precision_review.camera_status).toBe("verified_surfline_hls_staged_user_authorized");
      expect(cameraSql).toContain(`('${c.beach_id}'::uuid, '${c.alias}')`);
      expect(c.camera_url).toBe(`https://hls.cdn-surfline.com/ohio/${c.alias}/playlist.m3u8`);
      expect(c.thumbnail_url).toBe(`https://camstills.cdn-surfline.com/us-east-2/${c.alias}/latest_small.jpg`);
      expect(buildCamEmbed(c.camera_url)).toEqual({ kind: "hls", src: `/api/hls-proxy/hls.cdn-surfline.com/ohio/${c.alias}/playlist.m3u8` });
      for (const result of [c.direct, c.proxy]) expect(result).toMatchObject({ status: 200, valid: true, segment_status: 200 });
      expect(c.still_status).toBe(200);
    }
    expect(research.imports.filter((b) => b.precision_review.camera_status === "verified_surfline_hls_staged_user_authorized")).toHaveLength(7);
    expect(migration).toContain("Existing camera or thumbnail differs from reviewed Surfline mapping");
    expect(migration).toContain("Expected exactly seven reviewed Surfline camera assignments");
    expect(migration).not.toContain("Expected zero unverified camera assignments");
  });

  it("preserves stage-only evidence without inventing flood or ebb preferences", () => {
    const stages: Record<string, string | null> = {
      "bethune-beach-new-smyrna-beach-fl": "low",
      "oceanana-pier-atlantic-beach-nc": "low-mid",
      "avon-pier-avon-nc": null,
      "eckner-street-kitty-hawk-nc": null,
      "venice-north-jetty-nokomis-fl": null,
    };
    expect(research.imports.filter((beach) => beach.tide_stage)).toHaveLength(15);
    expect(migration).toContain("b.preference_model->'tide' IS DISTINCT FROM COALESCE(to_jsonb(i.tide_stage), 'null'::jsonb)");
    expect(migration).toContain("b.preference_model->'tide_calibration'->>'note' IS DISTINCT FROM i.tide_note");
    for (const [slug, tideStage] of Object.entries(stages)) {
      const beach = research.imports.find((row) => row.slug === slug);
      expect(beach).toEqual(expect.objectContaining({
        tide_stage: tideStage,
        preferred_tide_direction: null,
        tide_note: expect.stringContaining("Numeric MLLW height bounds are not established."),
      }));
      expect(beach?.editorial_sources).toContainEqual(expect.objectContaining({
        publisher: "Surfline",
        fields: ["tide_stage", "tide_note"],
      }));
      expect(migration).toContain(beach!.tide_note.replace(/'/g, "''"));
    }
  });
  it("accounts for every supplied name without duplicate spot rows", () => {
    expect(research.counts).toEqual({
      supplied: 71,
      import: 61,
      resolved_without_new_row: 10,
      approved_reviewed_heroes: 8,
      generated_regional_assets: 6,
      spots_with_hero_coverage: 61,
    });
    expect(research.decisions).toHaveLength(71);
    expect(new Set(research.decisions.map((decision) => decision.supplied_name)).size).toBe(71);
    expect(new Set(research.imports.map((beach) => beach.id)).size).toBe(61);
    expect(new Set(research.imports.map((beach) => beach.slug)).size).toBe(61);
    expect(research.decisions).toContainEqual(
      expect.objectContaining({
        supplied_name: "Buxton Coastal Hazard",
        decision: "not_a_spot_label",
        targetSlug: "north-buxton-buxton-nc",
      }),
    );
    expect(research.decisions).toContainEqual(
      expect.objectContaining({
        supplied_name: "St Augustine Pier",
        decision: "existing_exact",
        targetSlug: "st-augustine-beach-pier-st-augustine-beach-fl",
      }),
    );
  });

  it("stores complete forecast anchors and circular swell windows", () => {
    expect(
      research.imports.every((beach) =>
        ["America/New_York", "America/Chicago", "America/Los_Angeles"].includes(beach.timezone),
      ),
    ).toBe(true);
    expect(
      research.imports.every(
        (beach) =>
          beach.swell_min >= 0 &&
          beach.swell_min < 360 &&
          beach.swell_max >= 0 &&
          beach.swell_max < 360,
      ),
    ).toBe(true);
    const overrides: Record<string, [number, number]> = {
      "long-sands-beach-york-me": [40, 190],
      "old-orchard-beach-old-orchard-beach-me": [50, 190],
      "short-sands-beach-york-me": [0, 100],
    };
    expect(research.imports.filter((b) => b.precision_review.swell_window_override_note).map((b) => b.slug).sort()).toEqual(Object.keys(overrides).sort());
    for (const b of research.imports) {
      expect((b.swell_center - b.swell_halfwidth + 360) % 360).toBe(b.swell_min);
      expect((b.swell_center + b.swell_halfwidth) % 360).toBe(b.swell_max);
      expect(b.swell_halfwidth).toBeGreaterThan(0);
      expect(b.swell_halfwidth).toBeLessThanOrEqual(90);
      const sector = b.precision_review.terrain.local_open_sector;
      const expected = overrides[b.slug] ?? [Math.round(sector.min_deg / 10) * 10 % 360, Math.round(sector.max_deg / 10) * 10 % 360];
      expect([b.swell_min, b.swell_max]).toEqual(expected);
    }
    for (const slug of Object.keys(overrides)) {
      expect(research.imports.find((b) => b.slug === slug)?.precision_review.swell_window_override_note?.length).toBeGreaterThan(60);
    }
    expect(
      research.imports.every((beach) =>
        beach.editorial_sources.some(
          (source) =>
            source.publisher === "National Weather Service" &&
            source.fields.includes("forecast_anchor"),
        ),
      ),
    ).toBe(true);
    expect(migration).toContain("'marine_provider', 'open_meteo'");
    expect(migration).toContain("INSERT INTO public.beach_sources");
    expect(migration).toContain("Expected 61 Open-Meteo source rows");
    expect(research.imports.filter((beach) => beach.preferred_tide_direction === "rising")).toHaveLength(6);
    expect(research.imports.filter((beach) => beach.preferred_tide_direction === null)).toHaveLength(55);
    expect(research.imports.every((beach) => beach.tide_direction_sensitivity === "low")).toBe(true);
    expect(migration).not.toContain("THEN 'rising' ELSE 'falling' END");
    expect(migration).toContain("b.preferred_tide_direction IS DISTINCT FROM i.preferred_tide_direction");
    expect(migration).toContain("'nws_point_reviewed', true");
  });

  it("uses per-spot shoreline estimates without fabricated period precision", () => {
    const find = (slug: string) => research.imports.find((beach) => beach.slug === slug);
    expect(find("spyglass-drive-panama-city-beach-fl")?.timezone).toBe("America/Chicago");
    expect(find("frisco-pier-beach-frisco-nc")?.aspect).toBe(160);
    expect(find("bogue-inlet-pier-emerald-isle-nc")?.aspect).toBe(160);
    expect(find("oceanana-pier-atlantic-beach-nc")?.aspect).toBe(180);
    expect(new Set(research.imports.map((beach) => beach.aspect)).size).toBeGreaterThan(10);
    for (const beach of research.imports) {
      expect(beach.offshore).toBe((beach.aspect + 180) % 360);
      expect(beach.precision_review.orientation_method).toBe("per_spot_north_up_satellite_editorial_estimate");
      expect(beach.precision_review.orientation_source_url).toContain("World_Imagery/MapServer/export");
      expect(["coarse_context_only_no_nearshore_calibration", "cudem_transect_reviewed_no_shoaling_calibration"]).toContain(beach.precision_review.bathymetry_status);
      const seed = migration.split("\n").find((line) => line.startsWith(`  ('${beach.id}'::uuid,`));
      expect(seed).toContain(`, ${beach.aspect}, ${beach.offshore}, `);
      expect(seed).toContain(`'${beach.timezone}'`);
      expect(seed).toContain(`, ${beach.lat}, ${beach.lon}, `);
      expect(seed).toContain(JSON.stringify(beach.precision_review).replace(/'/g, "''"));
    }
    expect(migration).not.toContain("'period_s', 11");
    expect(migration).not.toContain("'primary_swell', jsonb_build_object('dir_deg', swell_center)");
    expect(migration).not.toContain("provisional_ideal_direction_plus_45_degrees_not_verified_exposure_limits");
    expect(find("frisco-pier-beach-frisco-nc")?.swell_min).toBe(80);
    expect(find("frisco-pier-beach-frisco-nc")?.swell_max).toBe(250);
    expect(migration).not.toContain("'status', 'editorially_validated'");
    expect(migration).not.toContain("'status', 'qualitative_session_evidence'");
    expect(migration).toContain("'precision_review', precision_review");
    expect(migration).not.toContain("DRAFT: East Coast precision audit incomplete");
    expect(migration).toContain("Existing import UUID differs from reviewed identity or coordinate");
    expect(migration).toContain("Stored forecast/editorial fields differ from reviewed seed");
    expect(migration).toContain("Expected 61 complete reviewed terrain fingerprints");
    expect(migration).toContain("Expected all nine reviewed catalog aliases");
  });

  it("uses current official public-access citations", () => {
    const serialized = JSON.stringify(research);

    expect(serialized).not.toContain("https://www.kittyhawknc.gov/beach/");
    expect(serialized).not.toContain("https://gis.dhec.sc.gov/beachaccess/");
    expect(serialized).not.toContain("https://discover.pbcgov.org/parks/Pages/Beaches.aspx");
    expect(serialized).toContain("https://gis.des.sc.gov/beachaccess/");
    expect(serialized).toContain("https://discover.pbc.gov/parks/Locations/Juno-Beach.aspx");
    expect(serialized).toContain("https://stateparks.oregon.gov/?do=park.profile&parkId=193");
    expect(
      research.imports
        .find((beach) => beach.slug === "rockaway-beach-rockaway-beach-or")
        ?.editorial_sources.map((source) => source.url),
    ).not.toContain("https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=164");
    expect(serialized).toContain("From May 1 through September 30");
    expect(serialized).toContain("from the Inlet through 27th Street");
    expect(serialized).toContain("the former pier and pier house were removed");
    expect(serialized).not.toContain("Atlantic or Pacific");
  });

  it("stores a complete coordinate-derived terrain fingerprint for every new row", () => {
    const terrain = migration.slice(
      migration.indexOf("WITH terrain_factors"),
      migration.indexOf(
        "UPDATE public.beaches AS b",
        migration.indexOf("WITH terrain_factors"),
      ),
    );
    const rows = [
      ...terrain.matchAll(
        /'([0-9a-f-]{36})'::uuid, ARRAY\[([^\]]+)\]::real\[\], ARRAY\[([^\]]+)\]::real\[\]/g,
      ),
    ];

    expect(rows).toHaveLength(61);
    expect(new Set(rows.map((row) => row[1])).size).toBe(61);
    expect(new Set(rows.map((row) => row[1]))).toEqual(new Set(research.imports.map((beach) => beach.id)));
    for (const row of rows) {
      const swell = row[2].split(",").map(Number);
      const wind = row[3].split(",").map(Number);
      expect(swell).toHaveLength(72);
      expect(wind).toHaveLength(72);
      expect(
        [...swell, ...wind].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1,
        ),
      ).toBe(true);
    }
    expect(migration).toContain("'bathymetric_amplification_claim', false");
    expect(migration).toContain(
      "ca84656a8a0e721a7c47813f541c147bcbe81157b1d6ed054c715b21119cc659",
    );
  });

  it("gates only Southern Duck because it has no public access", () => {
    const gated = research.imports.filter(
      (beach) =>
        !beach.recommendation_eligible ||
        !beach.seo_indexable ||
        beach.is_private,
    );

    expect(gated).toHaveLength(1);
    expect(gated[0]?.slug).toBe("southern-duck-duck-nc");
    expect(migration).toContain("Duck has no town-owned public beach access");
    expect(migration).toContain("Expected only Southern Duck to remain gated");
  });

  it("attaches only reviewed, attributable hero media with honest scope", () => {
    expect(research.hero_media).toHaveLength(8);
    expect(research.hero_media.every((photo) => photo.source === "wikimedia")).toBe(
      true,
    );
    expect(research.hero_media.every((photo) => photo.license.length > 0)).toBe(true);
    expect(research.hero_media.find((photo) => photo.slug === "8th-street-ocean-city-md")?.scope_note).toContain("not an exact");
    expect(migration.match(/'wikimedia'/g)).toHaveLength(2);
    expect(migration).toContain("Expected at least eight approved reviewed hero images");
    expect(research.generated_assets).toHaveLength(6);
    expect(research.generated_assets.every((asset) => asset.status === "approved")).toBe(true);
    expect(research.generated_assets.every((asset) => asset.exact_location_verified === false)).toBe(true);
    expect(research.generated_assets.every((asset) => asset.disclosure.includes("Illustrative only"))).toBe(true);
    expect(
      research.generated_assets.every((asset) =>
        existsSync(join(process.cwd(), "public", asset.local_path)),
      ),
    ).toBe(true);
    const exactSlugs = new Set(research.hero_media.map((photo) => photo.slug));
    expect(
      research.imports.every(
        (beach) => exactSlugs.has(beach.slug) || Boolean(beach.hero_fallback_id),
      ),
    ).toBe(true);
    expect(research.imports.filter((beach) => beach.hero_fallback_id)).toHaveLength(53);
    expect(migration).toContain("AI-generated representative regional coastline. Illustrative only");
    expect(migration).toContain("'ai_generated'");
    expect(migration).not.toContain("'user'");
    expect(migration).toContain("Expected approved hero coverage for all 61 imported beaches");
  });

  it("ties the terrain, bathymetry and live NOAA evidence to every final coordinate", () => {
    const evidence = JSON.parse(readFileSync(join(process.cwd(), "docs/research/east-coast-precision-evidence-2026-09-27.json"), "utf8")) as {
      terrain: { results: Array<{ id: string; lat: number; lon: number; missing_cells: number; mock: boolean; params: { dem_source: string }; swell: { factors: number[] }; wind: { factors: number[] } }> };
      nws: { results: Array<{ id: string; original: { lat: number; lon: number }; offshore_shift: { bearing_deg: number }; grid_status: number; fields: { waveHeight: { nonzero: number } } }> };
      bathymetry: { results: Array<{ id: string; distance_m: number; elevation_m: number; http_status: number; datasets: unknown[] }> };
    };
    expect(evidence.terrain.results).toHaveLength(61);
    expect(evidence.nws.results).toHaveLength(61);
    expect(evidence.bathymetry.results).toHaveLength(427);
    for (const b of research.imports) {
      const t = evidence.terrain.results.find((row) => row.id === b.id);
      const n = evidence.nws.results.find((row) => row.id === b.id);
      expect(t).toMatchObject({ lat: b.lat, lon: b.lon, missing_cells: 0, mock: false, params: { dem_source: "aws_terrain_tiles" } });
      expect(n).toMatchObject({ original: { lat: b.lat, lon: b.lon }, offshore_shift: { bearing_deg: b.aspect }, grid_status: 200 });
      expect(n?.fields.waveHeight.nonzero).toBeGreaterThan(0);
      const samples = evidence.bathymetry.results.filter((row) => row.id === b.id);
      expect(samples.map((row) => row.distance_m).sort((a, b) => a - b)).toEqual([0, 100, 250, 500, 1000, 2000, 6000]);
      expect(samples.every((row) => row.http_status === 200 && Number.isFinite(row.elevation_m) && row.datasets.length > 0)).toBe(true);
      expect(samples.find((row) => row.distance_m === 6000)?.elevation_m).toBeLessThan(0);
      const factors = migration.split("\n").find((line) => line.startsWith(`  ('${b.id}'::uuid, ARRAY[`));
      expect(factors).toContain(`ARRAY[${t?.swell.factors.map((v) => +v.toFixed(4)).join(",")}]::real[]`);
      expect(factors).toContain(`ARRAY[${t?.wind.factors.map((v) => +v.toFixed(4)).join(",")}]::real[]`);
    }
  });
});
