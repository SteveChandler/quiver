import fs from "node:fs";
import path from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildBeachRoutes } from "../../app/sitemap";
import {
  buildForecastAuthorityAudit,
  type ForecastAuthorityAuditBeach,
} from "../../lib/seo/forecast-authority-audit";
import {
  buildForecastIndexabilitySnapshot,
  type ForecastCoverageRow,
  type ForecastIndexabilitySnapshot,
} from "../../lib/seo/forecast-indexability";
import { loadSeoEnv } from "./load-env";

loadSeoEnv();

const generatedAt = getFlag("--generated-at") ?? new Date().toISOString();
const outputPath = getFlag("--output") ?? path.join(
  process.cwd(),
  "reports",
  "seo",
  `FORECAST-AUTHORITY-AUDIT-${generatedAt.slice(0, 10)}.json`,
);

interface AuditBeachRow extends ForecastAuthorityAuditBeach {
  created_at: string | null;
}

void main();

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY. This is a read-only inventory audit.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const beaches = await fetchBeaches(supabase);
  const { snapshots, querySucceeded } = await fetchForecastSnapshots(
    supabase,
    beaches,
  );
  const sitemapPaths = await fetchObservedSitemapPaths(beaches, snapshots);
  const audit = buildForecastAuthorityAudit(beaches, snapshots, {
    generatedAt,
    forecastQuerySucceeded: querySucceeded,
    sitemapPaths,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...audit.summary }, null, 2));
}

async function fetchBeaches(supabase: SupabaseClient): Promise<AuditBeachRow[]> {
  const result = await supabase
    .from("beaches")
    .select(
      "id,name,slug,city,state,country,lat,lon,timezone,description,wave_tips,crowd_tips,best_conditions_prose,parking_tips,access_tips,local_etiquette,hazards,created_at",
    )
    .or("is_private.is.null,is_private.eq.false")
    .is("deleted_at", null)
    .order("name")
    .limit(10000);

  if (result.error) throw new Error(`Beach inventory query failed: ${result.error.message}`);
  return (result.data ?? []) as AuditBeachRow[];
}

async function fetchForecastSnapshots(
  supabase: SupabaseClient,
  beaches: AuditBeachRow[],
): Promise<{
  snapshots: Map<string, ForecastIndexabilitySnapshot>;
  querySucceeded: boolean;
}> {
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
  const snapshots = new Map<string, ForecastIndexabilitySnapshot>();
  let querySucceeded = true;

  for (let index = 0; index < beaches.length; index += 20) {
    const batch = beaches.slice(index, index + 20);
    const beachIds = batch.map((beach) => beach.id);
    const result = await supabase
      .from("enhanced_forecasts")
      .select("beach_id,forecast_at,wave_height,updated_at,data_source")
      .in("beach_id", beachIds)
      .gte("forecast_at", start)
      .lt("forecast_at", end)
      .order("forecast_at", { ascending: true })
      .limit(1000);

    if (result.error) {
      querySucceeded = false;
      continue;
    }

    const rowsByBeach = new Map<string, ForecastCoverageRow[]>();
    for (const row of (result.data ?? []) as ForecastCoverageRow[]) {
      if (!row.beach_id) continue;
      const rows = rowsByBeach.get(row.beach_id) ?? [];
      rows.push(row);
      rowsByBeach.set(row.beach_id, rows);
    }

    for (const beach of batch) {
      snapshots.set(
        beach.id,
        buildForecastIndexabilitySnapshot(
          rowsByBeach.get(beach.id) ?? [],
          now,
          beach.timezone,
        ),
      );
    }
  }

  if (!querySucceeded) {
    return { snapshots: new Map(), querySucceeded: false };
  }

  return { snapshots, querySucceeded };
}

async function fetchObservedSitemapPaths(
  beaches: AuditBeachRow[],
  snapshots: ReadonlyMap<string, ForecastIndexabilitySnapshot>,
): Promise<Set<string>> {
  const sitemapBeaches = beaches as Parameters<typeof buildBeachRoutes>[0];
  const routes = buildBeachRoutes(sitemapBeaches, snapshots);
  return new Set(routes.map((route) => new URL(route.url).pathname));
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
