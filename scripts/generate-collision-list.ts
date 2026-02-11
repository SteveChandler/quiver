/**
 * Generate the static city collision list from production beach data.
 *
 * Usage: npx tsx scripts/generate-collision-list.ts
 *
 * This queries the production database for all city/state pairs,
 * runs detectCityCollisions(), and prints the result as a TypeScript Set.
 *
 * Copy the output into lib/seo/city-collision-list.ts when the beach
 * dataset changes significantly (new cities added, cities removed, etc.)
 */

import { createClient } from "@supabase/supabase-js";
import { detectCityCollisions } from "../lib/seo/city-slug-utils";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("beaches")
    .select("city, state")
    .not("city", "is", null)
    .not("state", "is", null)
    .neq("city", "")
    .neq("state", "");

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const collisions = detectCityCollisions(data as { city: string; state: string }[]);
  const sorted = [...collisions.keys()].sort();

  console.log(`Found ${sorted.length} collision slugs:\n`);
  console.log(`export const COLLISION_CITY_SLUGS = new Set([`);
  for (const slug of sorted) {
    console.log(`  "${slug}",`);
  }
  console.log(`]);\n`);

  console.log(`export const COLLISION_CITY_MAP = new Map<string, number>([`);
  for (const slug of sorted) {
    console.log(`  ["${slug}", ${collisions.get(slug)}],`);
  }
  console.log(`]);`);
}

main();
