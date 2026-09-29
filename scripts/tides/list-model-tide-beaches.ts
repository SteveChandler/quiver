import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getNearestTideStation } from "../../lib/services/noaa-tide-service";

type BeachRow = { id: string; slug: string; name: string; lat: number | null; lon: number | null; country: string | null };
type Point = { id: string; kind: "beach" | "reference"; slug?: string; name: string; lat: number; lon: number; country?: string | null; stationId?: string };

const references = [
  { stationId: "9410170", name: "San Diego", lat: 32.7156, lon: -117.1767 },
  { stationId: "9410230", name: "La Jolla", lat: 32.8669, lon: -117.2571 },
  { stationId: "TWC0403", name: "Ensenada", lat: 31.85, lon: -116.63 },
  { stationId: "TWC0401", name: "Isla Guadalupe", lat: 28.88, lon: -116.3 },
  { stationId: "9507601", name: "Guaymas", lat: 27.92, lon: -110.91 },
];

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log("npx tsx scripts/tides/list-model-tide-beaches.ts --out points.json [--include-reference]");
    return;
  }
  const out = option("--out");
  if (!out) throw new Error("--out is required");
  config({ path: path.resolve(process.cwd(), ".env.local") });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const points: Point[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("beaches").select("id,slug,name,lat,lon,country")
      .is("deleted_at", null).not("lat", "is", null).not("lon", "is", null)
      .order("id").range(offset, offset + 499);
    if (error) throw new Error(`Failed to read beaches: ${error.message}`);
    const rows = (data ?? []) as BeachRow[];
    for (const beach of rows) {
      if (beach.lat === null || beach.lon === null || !Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) continue;
      if (await getNearestTideStation(beach.lat, beach.lon)) continue;
      points.push({ id: beach.id, kind: "beach", slug: beach.slug, name: beach.name, lat: beach.lat, lon: beach.lon, country: beach.country });
    }
    if (rows.length < 500) break;
  }
  if (process.argv.includes("--include-reference")) {
    points.push(...references.map((point) => ({ ...point, id: point.stationId, kind: "reference" as const })));
  }
  await writeFile(out, JSON.stringify({ points }, null, 2) + "\n");
  console.log(`Wrote ${points.length} points to ${out}`);
}

if (require.main === module) main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
