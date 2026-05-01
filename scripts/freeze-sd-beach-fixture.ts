/**
 * Freezes Ocean Beach Pier / Pacific Beach / Crystal Pier beach config rows
 * for the hero-ranking scenario fixtures.
 *
 * Usage: npx tsx scripts/freeze-sd-beach-fixture.ts
 *
 * Prints JSON for the three beaches with the columns the scenario matrix needs.
 * Pipe to /tmp/sd-beaches.json and paste into
 * `__tests__/lib/services/discovery/hero-ranking/fixtures/scenario-matrix.ts`.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const FIELDS = [
  "id",
  "slug",
  "name",
  "lat",
  "lon",
  "timezone",
  "swell_window_min_deg",
  "swell_window_max_deg",
  "swell_window_center_deg",
  "swell_window_halfwidth_deg",
  "wind_offshore_deg",
  "wind_offshore_tol_deg",
  "wind_onshore_bad_kt",
  "wind_cross_shore_ok_kt",
  "preferred_tide_ft_min",
  "preferred_tide_ft_max",
  "preferred_tide_direction",
  "tide_direction_sensitivity",
  "skill_level",
  "break_type",
] as const;

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("beaches")
    .select(FIELDS.join(","))
    .in("slug", ["ocean-beach-pier", "pacific-beach", "crystal-pier"])
    .order("slug");

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
