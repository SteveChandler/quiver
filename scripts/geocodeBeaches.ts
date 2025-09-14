#!/usr/bin/env tsx

import "dotenv/config";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import { createObjectCsvWriter } from "csv-writer";

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (!MAPBOX_ACCESS_TOKEN) {
  console.error("❌ Missing Mapbox token. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in .env");
  process.exit(1);
}

const INPUT = path.resolve("docs/beaches_etl.csv");
const OUTPUT = path.resolve("docs/beaches_etl_geocoded.csv");
const FORCE_RECODE = process.env.FORCE_RECODE === "1";

// Keep in sync with CSV headers
export type Row = {
  name: string;
  region: string;
  country: string;
  lat: string;
  lng: string;
  ndbc_buoy_ids: string;
  forecast_source_id: string;
  camera_url: string;
  alt_names: string;
  slug: string;
  geocode_query: string;
};

// Targeted overrides to disambiguate tricky spots
const QUERY_OVERRIDES: Record<string, string> = {
  // Hawaii - Oahu
  "ala-moana-bowls": "Ala Moana Bowls, Honolulu, Oahu, Hawaii, USA",
  "kaisers": "Kaisers, Honolulu, Oahu, Hawaii, USA",
  "kewalos": "Kewalo Basin Harbor, Honolulu, Oahu, Hawaii, USA",
  "banzai-pipeline": "Ehukai Beach Park (Banzai Pipeline), Pupukea, Oahu, Hawaii, USA",
  "sunset-beach": "Sunset Beach, Pupukea, Oahu, Hawaii, USA",
  "waimea-bay": "Waimea Bay Beach Park, Pupukea, Oahu, Hawaii, USA",
  "laniakea": "Laniakea Beach, Haleiwa, Oahu, Hawaii, USA",
  "haleiwa": "Haleiwa Beach Park, Haleiwa, Oahu, Hawaii, USA",
  "chun-s-reef": "Chun's Reef Beach, Haleiwa, Oahu, Hawaii, USA",
  "makaha": "Makaha Beach Park, Waianae, Oahu, Hawaii, USA",
  "diamond-head-lighthouse": "Diamond Head Lighthouse, Honolulu, Oahu, Hawaii, USA",
  // Hawaii - Maui
  "honolua-bay": "Honolua Bay, Kapalua, Maui, Hawaii, USA",
  "lahaina-breakwall": "Lahaina Harbor Breakwall, Lahaina, Maui, Hawaii, USA",
  "olowalu": "Olowalu Beach, Lahaina, Maui, Hawaii, USA",
  "ukumehame": "Ukumehame Beach Park, Lahaina, Maui, Hawaii, USA",
  // Hawaii - Kauai
  "hanalei-bay": "Hanalei Bay, Hanalei, Kauai, Hawaii, USA",
  "poipu": "Poipu Beach, Koloa, Kauai, Hawaii, USA",
  // California disambiguations
  "ocean-beach-san-francisco": "Ocean Beach, Golden Gate National Recreation Area, San Francisco, California, USA",
  "windansea": "Windansea Beach, La Jolla, San Diego, California, USA",
  "campus-point": "Campus Point Beach, Goleta, California, USA",
  "rockaway": "Rockaway Beach, Pacifica, California, USA",
  "the-wedge": "The Wedge, Newport Beach, California, USA",
  "sunset-cliffs": "Sunset Cliffs Natural Park, Point Loma, San Diego, California, USA",
  "imperial-beach": "Imperial Beach Pier, Imperial Beach, California, USA",
  "leo-carrillo": "Leo Carrillo State Beach, Malibu, California, USA",
  "zuma-beach": "Zuma Beach, Malibu, California, USA",
  "c-street-surfers-point": "Surfers Point at Seaside Park, Ventura, California, USA",
  "fort-point": "Fort Point National Historic Site, Golden Gate Bridge, San Francisco, California, USA",
  // Washington / Oregon specifics
  "long-beach-wa": "Long Beach, Washington, USA",
};

async function geocode(query: string, country: string) {
  if (!query) return { lat: "", lng: "" };
  const base = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
  const params = new URLSearchParams({ access_token: MAPBOX_ACCESS_TOKEN as string, limit: "1" });
  // Use US scoping only for domestic beaches
  if (country && country.toUpperCase() === "USA") {
    params.set("country", "us");
  }
  const url = `${base}?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`⚠️ Geocode HTTP ${res.status} for query: ${query}`);
      return { lat: "", lng: "" };
    }
    const data: any = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center as [number, number];
      return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
    }
  } catch (err) {
    console.error("Geocode error:", err);
  }
  return { lat: "", lng: "" };
}

(async () => {
  const raw = fs.readFileSync(INPUT, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Row[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const needsLat = !row.lat || row.lat.trim() === "";
    const needsLng = !row.lng || row.lng.trim() === "";
    if (FORCE_RECODE || needsLat || needsLng) {
      // 1) Overrides by slug
      let effectiveQuery = QUERY_OVERRIDES[row.slug] || row.geocode_query?.trim() || "";
      // 2) For US rows, ensure ", State, USA" is present unless already specified
      if (
        !QUERY_OVERRIDES[row.slug] &&
        row.country && row.country.toUpperCase() === "USA" &&
        row.region && row.region.trim().length > 0
      ) {
        const lower = effectiveQuery.toLowerCase();
        const regionLower = row.region.toLowerCase();
        const hasRegion = lower.includes(regionLower);
        const hasUsa = /,\s*usa$/i.test(lower) || /,\s*united states$/i.test(lower);
        let baseQuery = effectiveQuery.replace(/,\s*(usa|united states)$/i, "");
        if (!hasRegion) baseQuery = `${baseQuery}, ${row.region}`;
        effectiveQuery = `${baseQuery}${hasUsa ? "" : ", USA"}`;
      }

      const { lat, lng } = await geocode(effectiveQuery, row.country);
      row.lat = lat;
      row.lng = lng;
      const note = QUERY_OVERRIDES[row.slug] ? " (override)" : "";
      console.log(`📍 ${row.name} → ${lat},${lng}${note}`);
      await new Promise((r) => setTimeout(r, 200)); // throttle requests (~5/sec)
    }
  }

  const header = Object.keys(rows[0] || {
    name: "",
    region: "",
    country: "",
    lat: "",
    lng: "",
    ndbc_buoy_ids: "",
    forecast_source_id: "",
    camera_url: "",
    alt_names: "",
    slug: "",
    geocode_query: "",
  }).map((key) => ({ id: key, title: key }));

  const csvWriter = createObjectCsvWriter({ path: OUTPUT, header });
  await csvWriter.writeRecords(rows);
  console.log("✅ Wrote geocoded CSV:", OUTPUT);
})().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
