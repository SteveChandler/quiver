/**
 * scripts/hero-rank-replay.ts
 *
 * Conditional smoke test (NOT a coverage gate). Pulls today's
 * `enhanced_forecasts` for OB Pier, Pacific Beach, and Crystal Pier from
 * Supabase, runs the discovery scoring engine + `rerankHero`, and prints
 * old-vs-new ordering with the full diagnostic breakdown.
 *
 * For human eyes only. Whether it produces the OB-vs-PB flip depends entirely
 * on whether today's conditions match the bug scenario (short-period W). On a
 * long-period south day, PB is expected to keep the lead. The coverage gate is
 * the 16-fixture suite under `__tests__/lib/services/discovery/hero-ranking/`,
 * not this replay.
 *
 * Usage: npx tsx scripts/hero-rank-replay.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  beachToSpotProfile,
  createDiscoveryScoringEngine,
  scoreBeachWithEngine,
} from "../lib/domains/scoring";
import { rerankHero } from "../lib/services/discovery/hero-ranking";
import { selectBestWindow } from "../lib/services/discovery/window-selector";
import type { Beach } from "../types/database";
import type { EnhancedForecastEntity } from "../types/forecast";
import type { SurfDiscoveryRecommendation } from "../types/personalization";

config({ path: ".env.local" });

const TARGET_SLUGS = ["ocean-beach-pier", "pacific-beach", "crystal-pier"] as const;

const FOOTER = `
This is a conditional smoke test. If today's conditions don't match the
short-period W scenario, a non-flip is expected and not a failure. Coverage
of the bug behavior comes from the 16-fixture suite at
__tests__/lib/services/discovery/hero-ranking/, not from this replay.
`;

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

/**
 * Score every hourly forecast row in the candidate's selected window using the
 * discovery scoring engine. Mirrors the contract documented in Task 5's
 * `computeWindowSlotScores`. Once Task 5 lands on main, this can be replaced
 * with the orchestrator's exported helper.
 */
function buildSlotScores(
  beach: Beach,
  windowStart: Date,
  windowEnd: Date,
  hourly: EnhancedForecastEntity[],
): number[] {
  const engine = createDiscoveryScoringEngine();
  const startMs = windowStart.getTime();
  const endMs = windowEnd.getTime();
  const inside = hourly
    .filter((f) => {
      const t = Date.parse(f.forecast_at as unknown as string);
      return Number.isFinite(t) && t >= startMs && t < endMs;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.forecast_at as unknown as string);
      const tb = Date.parse(b.forecast_at as unknown as string);
      return ta - tb;
    });
  if (inside.length === 0) return [];
  return inside.map((f) => {
    try {
      const detailed = scoreBeachWithEngine(engine, beach, f);
      return detailed.total;
    } catch {
      return 0;
    }
  });
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.log(
      "hero-rank-replay: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env.local — skipping (exit 0).",
    );
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: beaches, error: beachErr } = await supabase
    .from("beaches")
    .select("*")
    .in("slug", TARGET_SLUGS as unknown as string[])
    .order("name");

  if (beachErr) {
    console.log(`hero-rank-replay: beach query failed (${beachErr.message}) — exit 0.`);
    return;
  }
  if (!beaches || beaches.length === 0) {
    console.log("hero-rank-replay: no matching beaches in DB — exit 0.");
    return;
  }

  const engine = createDiscoveryScoringEngine();
  const nowIso = new Date().toISOString();
  const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const recs: SurfDiscoveryRecommendation[] = [];

  for (const beach of beaches as Beach[]) {
    const { data: forecasts, error: fErr } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beach.id)
      .gte("forecast_at", nowIso)
      .lt("forecast_at", tomorrowIso)
      .order("forecast_at");

    if (fErr) {
      console.log(`hero-rank-replay: forecast query failed for ${beach.slug} (${fErr.message}) — skipping beach.`);
      continue;
    }
    const hourly = (forecasts ?? []) as EnhancedForecastEntity[];
    if (hourly.length === 0) {
      console.log(`hero-rank-replay: no forecasts for ${beach.slug} in next 24h — skipping beach.`);
      continue;
    }

    const window = selectBestWindow(hourly, beach, null);
    if (!window) {
      console.log(`hero-rank-replay: no viable window for ${beach.slug} — skipping beach.`);
      continue;
    }

    const repForecast = window.sourceForecast ?? hourly[0];
    const detailed = scoreBeachWithEngine(engine, beach, repForecast);
    const profile = beachToSpotProfile(beach);
    const slotScores = buildSlotScores(beach, window.start, window.end, hourly);

    recs.push({
      beach,
      window,
      forecast: repForecast,
      score: detailed.total,
      matchQuality: detailed.matchQuality,
      subscores: detailed.subscores,
      summary: "",
      reasons: detailed.reasons,
      warnings: detailed.warnings,
      spotProfile: profile,
      windowSlotScores: slotScores,
      generated_at: new Date().toISOString(),
    });
  }

  if (recs.length === 0) {
    console.log("hero-rank-replay: no recs built — exit 0.");
    return;
  }

  // Engine sort order = "old" ranking
  const merged = [...recs].sort((a, b) => b.score - a.score);
  const { reranked, diagnostics } = rerankHero(merged);

  // Today's swell summary (use the top engine candidate's representative forecast)
  const lead = merged[0];
  const f = lead.forecast;
  const swellHeight = f.swell_1_height ?? f.wave_height ?? null;
  const swellPeriod = f.swell_1_period ?? f.wave_period ?? null;
  const swellDir = f.swell_1_direction ?? null;
  const swellDirDeg = (f as unknown as { wave_direction_deg?: number | null }).wave_direction_deg ?? null;

  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push("HERO-RANK REPLAY — current Supabase snapshot");
  lines.push(`generated_at: ${new Date().toISOString()}`);
  lines.push(`beaches: ${TARGET_SLUGS.join(", ")}`);
  lines.push("=".repeat(72));
  lines.push("");
  lines.push("Today's swell summary (from leading candidate's representative slot):");
  lines.push(`  beach:     ${lead.beach.name} (${lead.beach.slug})`);
  // Note: DB string columns already embed units (e.g., "2 ft", "6s", "10 mph").
  lines.push(`  swell:     ${swellHeight ?? "n/a"} @ ${swellPeriod ?? "n/a"} from ${swellDir ?? "n/a"}${swellDirDeg != null ? ` (${swellDirDeg}°)` : ""}`);
  lines.push(`  wind:      ${f.wind_speed ?? "n/a"} ${f.wind_direction ?? ""}`);
  lines.push(`  tide:      ${f.tide_height ?? "n/a"} (${f.tide_status ?? "n/a"})`);
  lines.push(`  forecast_at: ${f.forecast_at as unknown as string}`);
  lines.push("");

  lines.push("Old order (engine sort by score):");
  merged.forEach((r, i) => {
    lines.push(`  ${i + 1}. ${pad(r.beach.slug, 22)} score=${fmt(r.score)}`);
  });
  lines.push("");

  lines.push("New order (hero rerank by heroWindowScore):");
  diagnostics.forEach((d, i) => {
    lines.push(`  ${i + 1}. ${pad(d.beachSlug, 22)} heroWindowScore=${fmt(d.heroWindowScore)}`);
  });
  lines.push("");

  const oldHero = merged[0]?.beach.slug ?? "";
  const newHero = reranked[0]?.beach.slug ?? "";
  const flipped = oldHero !== newHero;
  lines.push(`Hero flip: ${flipped ? "YES" : "no"}  (${oldHero} -> ${newHero})`);
  lines.push("");

  lines.push("Diagnostic breakdown (top 2 reranked candidates):");
  diagnostics.slice(0, 2).forEach((d) => {
    lines.push(`  ${d.beachSlug}${d.isHero ? "  [HERO]" : ""}`);
    lines.push(`    representativeSlotScore: ${fmt(d.representativeSlotScore)}`);
    lines.push(`    setupSuitability:        ${fmt(d.setupSuitability)}`);
    lines.push(`    windAlignment:           ${fmt(d.windAlignment)}  (subscore 0-20)`);
    lines.push(`    tideFit:                 ${fmt(d.tideFit)}  (subscore 0-15)`);
    lines.push(`    waveHeightFit:           ${fmt(d.waveHeightFit)}  (subscore 0-25)`);
    lines.push(`    periodEnergyScore:       ${fmt(d.periodEnergyScore)}  (subscore 0-20)`);
    lines.push(`    affinityBonus:           ${fmt(d.affinityBonus)}  (subscore 0-15)`);
    lines.push(`    windowDurationHours:     ${fmt(d.windowDurationHours, 2)}`);
    lines.push(`    windowPersistence:       ${fmt(d.windowPersistence)}  (0-100)`);
    lines.push(`    heroWindowScore:         ${fmt(d.heroWindowScore)}  (0-100)`);
    lines.push(`    finalRank:               ${d.finalRank}`);
    lines.push("");
  });

  lines.push("-".repeat(72));
  lines.push(FOOTER.trim());
  lines.push("=".repeat(72));

  console.log(lines.join("\n"));
}

main().catch((err) => {
  // Per plan: graceful — never crash the human-facing replay
  console.log(`hero-rank-replay: unexpected error — ${err instanceof Error ? err.message : String(err)} — exit 0.`);
});
