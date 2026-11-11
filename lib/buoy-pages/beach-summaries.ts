/**
 * Current Quiver forecast label for beaches linked to a buoy. Uses the same
 * by-beach-id path as the map (bulk forecast rows -> current row -> display
 * label). It shows the beach's existing forecast; it never derives a beach
 * height from the buoy. Scores and verdicts are left out on purpose: the bulk
 * API applies hold rules to those, and this page links to the beach instead.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currentMapForecastRow,
  fetchBulkForecastRowsWithV51Display,
  resolveForecastFetchWindow,
} from "@/lib/services/forecast/map-current-forecast";
import { resolveSelectedHourDisplay } from "@/lib/services/forecast/today-headline";
import { createPublicReadClient } from "@/lib/supabase/server";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { Database } from "@/types/database.generated";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface BeachForecastSummary {
  /** Canonical beach page, or null when the beach row cannot build one. */
  href: string | null;
  city: string | null;
  /** "3-4ft", from the beach's current Quiver forecast row; null when none is current. */
  forecastLabel: string | null;
}

interface BeachUrlRow {
  id: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

const MAX_BEACHES = 12;

export async function getBeachForecastSummaries(
  beachIds: string[],
  now: Date,
  client?: SupabaseClient<Database>,
): Promise<Map<string, BeachForecastSummary>> {
  const ids = [...new Set(beachIds)].slice(0, MAX_BEACHES);
  const summaries = new Map<string, BeachForecastSummary>();
  if (ids.length === 0) return summaries;
  const db = client ?? createPublicReadClient();

  const { start, end } = resolveForecastFetchWindow(null);
  const [beachResult, forecastResult] = await Promise.all([
    db.from("beaches").select("id, slug, city, state, country").in("id", ids),
    fetchBulkForecastRowsWithV51Display(db, ids, start, end),
  ]);
  if (beachResult.error) throw new Error(`getBeachForecastSummaries: ${beachResult.error.message}`);
  // A missing forecast only removes the label; the beach link still helps.
  if (forecastResult.error) {
    console.warn("[buoy-pages] beach forecast read failed", { message: forecastResult.error.message });
  }

  const rowsByBeach = new Map<string, EnhancedForecastEntity[]>();
  for (const row of forecastResult.data ?? []) {
    const rows = rowsByBeach.get(row.beach_id) ?? [];
    rows.push(row);
    rowsByBeach.set(row.beach_id, rows);
  }

  for (const beach of (beachResult.data ?? []) as BeachUrlRow[]) {
    const href = beach.slug && beach.city && beach.state ? buildBeachUrl(beach) : null;
    const current = currentMapForecastRow(rowsByBeach.get(beach.id) ?? [], now);
    summaries.set(beach.id, {
      href: href && !href.startsWith("/beach/") ? href : null,
      city: beach.city,
      forecastLabel: resolveSelectedHourDisplay(current)?.label ?? null,
    });
  }
  return summaries;
}
