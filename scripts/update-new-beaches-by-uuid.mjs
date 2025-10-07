#!/usr/bin/env node

/**
 * Update newly created beaches using direct UUID mapping
 * Since beach names were simplified during creation, we need to map by UUID
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// UUID mapping from creation output
const beachUpdates = [
  {
    uuid: "929caa5e-c79f-4b60-8fe0-bec75c2df2d6", // Tijuana Sloughs
    updates: {
      hazards: [
        "water pollution",
        "sharks and stingrays",
        "strong rips",
        "reef/rocks at take‑off zone",
      ],
      preference_model: {
        provenance: ["Surf‑Forecast", "Surfspot.app", "Tijuana River location"],
        confidence: 0.71,
        notes:
          "Swell window derived from WSW–W through WNW; center at ~270°. Offshore wind from E‑ENE (67.5°) with ±45° tolerance.",
      },
    },
  },
  {
    uuid: "84d3468b-c1ec-46ad-8621-d8507e5f167a", // Hotel Del Coronado
    updates: {
      preference_model: {
        provenance: ["Go Surfing SD"],
        confidence: 0.66,
        notes:
          "Fickle beach break; during hurricane swells a fast left breaks off the sandbar for advanced surfers.",
      },
    },
  },
  {
    uuid: "63af8c07-1aed-44bd-b03b-9b20abdff56c", // Avalanche
    updates: {
      preference_model: {
        provenance: ["Go Surfing SD", "Worldwide Surf Guide"],
        confidence: 0.76,
        notes:
          "Consistent beach break accessible from Dog Beach parking; works on any swell with west in it.",
      },
    },
  },
];

console.log("Updating newly created beaches...\n");

for (const beach of beachUpdates) {
  const { error } = await supabase
    .from("beaches")
    .update(beach.updates)
    .eq("id", beach.uuid);

  if (error) {
    console.log(`❌ Error updating ${beach.uuid}: ${error.message}`);
  } else {
    console.log(`✅ Updated ${beach.uuid}`);
  }
}

console.log("\n✅ All updates complete!");
