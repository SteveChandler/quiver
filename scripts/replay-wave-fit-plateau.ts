#!/usr/bin/env tsx
/** Read-only replay of the displayed score on real forecast slots. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Beach, Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { SKILL_LEVELS, type SkillLevel } from "@/lib/domains/user-preferences/skill-level";
import { scoreWindowConditionDetails } from "@/lib/services/discovery/window-selector/window-scorer";
import { isFallbackForecastRow } from "@/lib/utils/forecast-row-source";
import { getLocalDateStr, getLocalHour } from "@/lib/services/discovery/window-selector/time-slot-utils";
import { DAYLIGHT_START_HOUR, DAYLIGHT_END_HOUR } from "@/lib/services/magic-hour/constants";
import { scoreLabel, type ScoreLabel } from "@/lib/utils/score-color-utils";
import { getRecommendationLabel } from "@/lib/services/discovery/response-formatter";

type Db = SupabaseClient<Database>;
type ProfileScope = Pick<Database["public"]["Tables"]["profiles"]["Row"],
  "home_beach_id" | "deleted_at" | "is_mock" | "is_system_account" | "analytics_is_real_user">;
type ScorePair = { beach: Beach; row: EnhancedForecastEntity; before: number; after: number };
const LABELS: ScoreLabel[] = ["MEH", "RIDEABLE", "FAIR", "GOOD", "EPIC"];
const DAY_MS = 86_400_000;
const PAGE_SIZE = 1000;

function regionKey(beach: Beach): string | null {
  if (beach.region_id) return `id:${beach.region_id}`;
  if (!beach.region) return null;
  return `name:${beach.country}:${beach.state}:${beach.region}`;
}

async function pages<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

function scoreBoth(row: EnhancedForecastEntity, beach: Beach, skill: SkillLevel): ScorePair {
  const saved = process.env.WAVE_FIT_PLATEAU_ENABLED;
  const savedPublic = process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED;
  try {
    delete process.env.WAVE_FIT_PLATEAU_ENABLED;
    delete process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED;
    const before = scoreWindowConditionDetails(row, beach, skill).score;
    process.env.WAVE_FIT_PLATEAU_ENABLED = "true";
    const after = scoreWindowConditionDetails(row, beach, skill).score;
    return { beach, row, before, after };
  } finally {
    if (saved === undefined) delete process.env.WAVE_FIT_PLATEAU_ENABLED;
    else process.env.WAVE_FIT_PLATEAU_ENABLED = saved;
    if (savedPublic === undefined) delete process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED;
    else process.env.NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED = savedPublic;
  }
}

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function pct(numerator: number, denominator: number): string {
  return `${(100 * numerator / Math.max(denominator, 1)).toFixed(1)}%`;
}

function verdict(score: number): string {
  return getRecommendationLabel(score).toLowerCase().replace(" ", "_");
}

function reportSkill(skill: SkillLevel, pairs: ScorePair[]): string[] {
  const changed = pairs.filter(({ before, after }) => scoreLabel(before) !== scoreLabel(after));
  const deltas = pairs.map(({ before, after }) => after - before).sort((a, b) => a - b);
  const mean = deltas.reduce((sum, delta) => sum + delta, 0) / Math.max(deltas.length, 1);
  const tier = (score: number): number => LABELS.indexOf(scoreLabel(score));
  const jumps = pairs.filter(({ before, after }) => Math.abs(tier(after) - tier(before)) > 1).length;
  const dayPicks = new Map<string, { before: number; after: number }>();
  for (const pair of pairs) {
    const key = `${pair.beach.id}:${getLocalDateStr(new Date(pair.row.forecast_at), pair.beach.timezone || "America/Los_Angeles")}`;
    const pick = dayPicks.get(key) ?? { before: 0, after: 0 };
    pick.before = Math.max(pick.before, pair.before);
    pick.after = Math.max(pick.after, pair.after);
    dayPicks.set(key, pick);
  }
  const flips = [...dayPicks.values()].filter(({ before, after }) => verdict(before) !== verdict(after)).length;
  const alertStarts = pairs.filter(({ before, after }) => getRecommendationLabel(before) !== "Worth it"
    && getRecommendationLabel(after) === "Worth it").length;
  const alertStops = pairs.filter(({ before, after }) => getRecommendationLabel(before) === "Worth it"
    && getRecommendationLabel(after) !== "Worth it").length;
  const lines = [
    `| ${skill} | ${pairs.length} | ${changed.length} (${pct(changed.length, pairs.length)}) | ${mean.toFixed(1)} | ${percentile(deltas, 0.9)} | ${jumps} | ${flips}/${dayPicks.size} | ${alertStarts}/${alertStops} |`,
    `| ${skill} transition matrix (before ↓ / after →) | MEH | RIDEABLE | FAIR | GOOD | EPIC |`,
  ];
  for (const from of LABELS) {
    lines.push(`| ${from} | ${LABELS.map((to) => pairs.filter((pair) => scoreLabel(pair.before) === from && scoreLabel(pair.after) === to).length).join(" | ")} |`);
  }
  return lines;
}

function spotChecks(pairs: ScorePair[], asOf: string): string[] {
  const anchor = new Date(`${asOf}T12:00:00Z`);
  const saturday = new Date(anchor);
  saturday.setUTCDate(anchor.getUTCDate() + ((6 - anchor.getUTCDay() + 7) % 7));
  const sunday = new Date(saturday.getTime() + DAY_MS);
  const dates = [saturday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
  const names = ["Terramar Point", "Scripps", "La Jolla Shores", "Blacks"];
  const lines = ["### San Diego advanced spot checks", "", "| Beach | Local day | Best slot before → after |", "|---|---|---|"];
  for (const name of names) {
    for (const day of dates) {
      const candidates = pairs.filter((pair) => pair.beach.name.toLowerCase().includes(name.toLowerCase())
        && getLocalDateStr(new Date(pair.row.forecast_at), pair.beach.timezone || "America/Los_Angeles") === day);
      const before = candidates.reduce<ScorePair | null>((best, pair) => !best || pair.before > best.before ? pair : best, null);
      const after = candidates.reduce<ScorePair | null>((best, pair) => !best || pair.after > best.after ? pair : best, null);
      lines.push(`| ${name} | ${day} | ${before && after ? `${before.before} ${scoreLabel(before.before)} → ${after.after} ${scoreLabel(after.after)}` : "No forecast row"} |`);
    }
  }
  return lines;
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const utcMinute = new Date().getUTCMinutes();
  if (utcMinute >= 57 || utcMinute < 3) throw new Error("Heavy read paused around the :00 cron window; rerun after :03 UTC.");
  const asOfIndex = process.argv.indexOf("--as-of");
  const asOf = asOfIndex >= 0 ? process.argv[asOfIndex + 1] : "2026-10-27";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("--as-of must be YYYY-MM-DD");
  const outIndex = process.argv.indexOf("--out");
  const out = outIndex >= 0 ? process.argv[outIndex + 1] : "docs/scoring/wave-fit-plateau-replay-2026-10-27.md";
  if (!out) throw new Error("--out requires a path");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service credentials");
  const db: Db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const allBeaches = await pages<Beach>((from, to) => db.from("beaches").select("*").order("id").range(from, to));
  const beachById = new Map(allBeaches.map((beach) => [beach.id, beach]));
  const profiles = await pages<ProfileScope>((from, to) => db.from("profiles")
    .select("home_beach_id,deleted_at,is_mock,is_system_account,analytics_is_real_user")
    .not("home_beach_id", "is", null).is("deleted_at", null).order("id").range(from, to));
  const activeHomes = profiles.filter((profile) => !profile.is_mock && !profile.is_system_account && profile.analytics_is_real_user);
  const regions = new Set(activeHomes.flatMap((profile) => {
    const beach = beachById.get(profile.home_beach_id ?? "");
    const key = beach ? regionKey(beach) : null;
    return key ? [key] : [];
  }));
  const beaches = allBeaches.filter((beach) => {
    const key = regionKey(beach);
    return key != null && regions.has(key);
  });
  const start = new Date(`${asOf}T00:00:00Z`);
  const startIso = new Date(start.getTime() - 8 * DAY_MS).toISOString();
  const endIso = new Date(start.getTime() + 8 * DAY_MS).toISOString();
  const pairsBySkill = new Map<SkillLevel, ScorePair[]>(SKILL_LEVELS.map((skill) => [skill, []]));
  let forecastRows = 0;
  for (let index = 0; index < beaches.length; index += 25) {
    const batch = beaches.slice(index, index + 25);
    const ids = batch.map((beach) => beach.id);
    const forecasts = await pages<EnhancedForecastEntity>((from, to) => db.from("enhanced_forecasts")
      .select("*").in("beach_id", ids).gte("forecast_at", startIso).lt("forecast_at", endIso)
      .order("forecast_at").order("id").range(from, to) as never);
    forecastRows += forecasts.length;
    for (const row of forecasts) {
      const beach = beachById.get(row.beach_id);
      if (!beach || isFallbackForecastRow(row)) continue;
      const timezone = beach.timezone || "America/Los_Angeles";
      const localDate = getLocalDateStr(new Date(row.forecast_at), timezone);
      const hour = getLocalHour(new Date(row.forecast_at), timezone);
      if (localDate < new Date(start.getTime() - 7 * DAY_MS).toISOString().slice(0, 10)
        || localDate >= new Date(start.getTime() + 7 * DAY_MS).toISOString().slice(0, 10)
        || hour == null || hour < DAYLIGHT_START_HOUR || hour >= DAYLIGHT_END_HOUR) continue;
      for (const skill of SKILL_LEVELS) pairsBySkill.get(skill)!.push(scoreBoth(row, beach, skill));
    }
  }
  const lines = [
    "# Wave fit plateau replay — 2026-10-27", "",
    `Read-only replay of ${forecastRows} stored forecast rows for ${beaches.length} beaches in ${regions.size} regions containing ${activeHomes.length} nondeleted real-user home-beach profiles. Region key uses region_id when present, otherwise country/state/region. Local dates ${new Date(start.getTime() - 7 * DAY_MS).toISOString().slice(0, 10)} through ${new Date(start.getTime() + 6 * DAY_MS).toISOString().slice(0, 10)}; daylight 06:00–20:00. Each stored forecast slot is a one-hour candidate window. No board inventory was assumed. Full beach decision ceilings and direction scoring were applied by scoreWindowConditionDetails.`,
    "", "| Skill | Windows | Label changed | Mean Δ | p90 Δ | >1 tier | Score-only day-pick verdict flips | Possible swell-alert GO starts/stops |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const skill of SKILL_LEVELS) lines.push(...reportSkill(skill, pairsBySkill.get(skill)!));
  lines.push("", "Day picks are each beach/local day's highest daylight slot, with worth_it ≥70, maybe ≥40, skip <40 via `getRecommendationLabel`. Actual day selection also applies duration, safety, board, and user gates; these counts are score-only estimates. Possible swell-alert GO starts/stops use that same threshold on each slot: an upper bound on changed downstream canonical verdicts, not delivered alerts. Condition-alert rule matching and its best-hour score are independent of this flag: **0** raw-rule changes. Watched-call condition alerts use refreshed discovery scores; their starts/stops cannot be counted without saved watch state and are bounded by score changes here. Swell event detection uses independent swell energy/period/exposure thresholds: **0** event-detection changes.", "");
  lines.push(...spotChecks(pairsBySkill.get("advanced")!, asOf));
  lines.push("", "### Potential over-promotion near ideal minimum", "", "| Skill | Beach / local time | Height | Before → after |", "|---|---|---:|---|");
  const candidates = SKILL_LEVELS.flatMap((skill) => pairsBySkill.get(skill)!.map((pair) => ({ skill, ...pair })))
    .filter(({ skill, row }) => {
      const min = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 }[skill];
      const height = parseFloat(row.wave_height ?? "");
      return height >= min && height <= min + 0.25;
    }).sort((a, b) => (b.after - b.before) - (a.after - a.before));
  const picked = new Set<string>();
  for (const pair of candidates) {
    if (picked.has(pair.skill)) continue;
    picked.add(pair.skill);
    lines.push(`| ${pair.skill} | ${pair.beach.name} / ${pair.row.forecast_at} | ${pair.row.wave_height} | ${pair.before} ${scoreLabel(pair.before)} → ${pair.after} ${scoreLabel(pair.after)} |`);
    if (picked.size === 3) break;
  }
  lines.push("", "Other scorer paths: `window-calculator` and displayed board overrides already call the native scorer and inherit the flag. Beach Detail runs the scorer in the browser; rollout must also set `NEXT_PUBLIC_WAVE_FIT_PLATEAU_ENABLED=true` at build time to match the server. The domain `base-conditions-scorer` uses a separate beach/composite ramp and is intentionally unchanged. Alert `best-hour` scores a user-defined swell-height range, not a skill ideal range; its matching is unchanged.");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${lines.join("\n")}\n`);
  console.log(`Wrote ${out}: ${beaches.length} beaches, ${forecastRows} forecast rows, ${pairsBySkill.get("advanced")!.length} daylight windows per skill`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
