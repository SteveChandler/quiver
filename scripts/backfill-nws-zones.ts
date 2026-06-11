import { createClient } from "@supabase/supabase-js";

type BeachRow = {
  id: string;
  name: string | null;
  lat: number | null;
  lon: number | null;
};

type NwsPointResponse = {
  properties?: {
    forecastZone?: string;
    cwa?: string;
    gridId?: string;
  };
};

const USER_AGENT =
  process.env.NWS_USER_AGENT ??
  "quiver-surf (https://www.quiversurf.app; contact@quiversurf.app)";
const DRY_RUN = process.argv.includes("--dry-run") || !process.argv.includes("--write");
const REQUEST_DELAY_MS = 1_000;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function zoneCodeFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/zones\/forecast\/([A-Z]{2,3}\d{3})$/);
  return match?.[1] ?? null;
}

export async function fetchNwsPoint(
  lat: number,
  lon: number
): Promise<NwsPointResponse | null> {
  const response = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
    {
      headers: {
        Accept: "application/geo+json",
        "User-Agent": USER_AGENT,
      },
    }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`NWS points failed ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as NwsPointResponse;
}

export async function main(): Promise<void> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) throw new Error("Missing required env var: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");

  const supabase = createClient(
    supabaseUrl,
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data, error } = await supabase
    .from("beaches")
    .select("id, name, lat, lon")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const beaches = (data ?? []) as BeachRow[];
  let mapped = 0;
  let skipped = 0;

  for (const beach of beaches) {
    const lat = beach.lat;
    const lon = beach.lon;
    if (lat == null || lon == null) {
      skipped += 1;
      continue;
    }

    const point = await fetchNwsPoint(lat, lon);
    const zone = zoneCodeFromUrl(point?.properties?.forecastZone);
    const office = point?.properties?.cwa ?? point?.properties?.gridId ?? null;

    if (!zone || !office) {
      skipped += 1;
      console.log(`skip ${beach.name ?? beach.id}: no NWS zone`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    mapped += 1;
    console.log(`${DRY_RUN ? "dry-run" : "update"} ${beach.name ?? beach.id}: ${zone} ${office}`);

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from("beaches")
        .update({ nws_forecast_zone: zone, nws_office: office })
        .eq("id", beach.id);

      if (updateError) throw new Error(updateError.message);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`done: mapped=${mapped}, skipped=${skipped}, dryRun=${DRY_RUN}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
