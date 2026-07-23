import fs from "node:fs";
import path from "node:path";

import {
  cityEditorialKey,
  evaluateBeachEditorialQuality,
  evaluateCityEditorialQuality,
  toBeachEditorialInput,
  toCityEditorialInput,
  type EditorialSource,
} from "../../lib/seo/indexability";
import { loadSeoEnv } from "./load-env";
import { buildCitySlug } from "../../lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "../../lib/seo/city-collision-list";

loadSeoEnv();

const outputPath = getFlag("--output") ?? path.join(
  process.cwd(),
  "reports",
  "seo",
  `EDITORIAL-CONTENT-GAPS-${new Date().toISOString().slice(0, 10)}.json`,
);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface BeachRow {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
  crowd_tips: string | null;
  wave_tips: string | null;
  best_conditions_prose: string | null;
  seo_indexable: boolean | null;
  editorial_reviewed_at: string | null;
  editorial_sources: EditorialSource[] | null;
}

interface CityEditorialRow {
  city_slug: string;
  state_slug: string;
  country_slug: string;
  intent: string | null;
  description: string[] | null;
  seo_indexable: boolean | null;
  editorial_reviewed_at: string | null;
  editorial_sources: EditorialSource[] | null;
  seo_intro: string | null;
  seo_local_guidance: string | null;
}

interface ContentGap {
  kind: "beach" | "city-intent" | "best-time" | "location" | "state-intent";
  canonicalPath: string;
  priority: number;
  reason: string;
  entity: string;
}

void main();

async function main(): Promise<void> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or key. This read-only report needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const [beaches, cityEditorial] = await Promise.all([
    fetchRows<BeachRow>("beaches", "id,name,slug,city,state,country,description,crowd_tips,wave_tips,best_conditions_prose,seo_indexable,editorial_reviewed_at,editorial_sources"),
    fetchRows<CityEditorialRow>("city_editorial_content", "city_slug,state_slug,country_slug,intent,description,seo_indexable,editorial_reviewed_at,editorial_sources,seo_intro,seo_local_guidance"),
  ]);

  const gaps: ContentGap[] = [];
  for (const beach of beaches) {
    if (!beach.slug || !beach.city || !beach.state) continue;
    const result = evaluateBeachEditorialQuality(
      toBeachEditorialInput(beach),
    );
    if (result.approved) continue;
    gaps.push({
      kind: "beach",
      canonicalPath: slug(beach.country || "usa") === "usa"
        ? `/${slug(beach.state)}/${slug(beach.city)}/${beach.slug}`
        : `/${slug(beach.country || "mexico")}/${slug(beach.state)}/${slug(beach.city)}/${beach.slug}`,
      priority: 100,
      reason: result.reason ?? "unknown",
      entity: beach.name,
    });
  }

  const editorialByKey = new Map(
    cityEditorial.map((editorial) => [
      cityEditorialKey(
        editorial.country_slug,
        editorial.state_slug,
        editorial.city_slug,
        editorial.intent === "general" ? null : editorial.intent,
      ),
      editorial,
    ]),
  );
  const cities = new Map<string, { country: string; state: string; city: string; canonicalCitySlug: string }>();
  for (const beach of beaches) {
    if (!beach.city || !beach.state) continue;
    const country = slug(beach.country || "usa");
    const state = slug(beach.state);
    const city = slug(beach.city);
    const canonicalCitySlug = country === "usa"
      ? buildCitySlug(beach.city, beach.state, COLLISION_CITY_MAP) ?? city
      : city;
    cities.set(`${country}/${state}/${city}`, { country, state, city, canonicalCitySlug });
  }

  const cityIntents = [
    "beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset",
  ];
  for (const city of cities.values()) {
    const candidates: Array<string | null> = [null, "best-time", ...cityIntents];
    for (const intent of candidates) {
      if (city.country !== "usa" && intent !== null) continue;
      const editorial = editorialByKey.get(
        cityEditorialKey(city.country, city.state, city.city, intent),
      );
      const kind = intent === null ? "location" : intent === "best-time" ? "best-time" : "city-intent";
      const canonicalPath = kind === "location"
        ? city.country === "usa" ? `/beaches/usa/${city.state}/${city.canonicalCitySlug}` : `/beaches/${city.country}/${city.state}/${city.city}`
        : kind === "best-time" ? `/best-time-to-surf/${city.canonicalCitySlug}` : `/${intent}/${city.canonicalCitySlug}`;
      if (!editorial) {
        gaps.push({ kind, canonicalPath, priority: kind === "location" ? 80 : 70, reason: "missing-intent-editorial", entity: city.city });
        continue;
      }
      const result = evaluateCityEditorialQuality(
        toCityEditorialInput(editorial),
        intent,
      );
      if (!result.approved) {
        gaps.push({ kind, canonicalPath, priority: kind === "location" ? 80 : 70, reason: result.reason ?? "unknown", entity: city.city });
      }
    }
  }

  // State intents remain blocked until independent state-level reviewed content exists.
  const states = [...new Set([...cities.values()].filter((city) => city.country === "usa").map((city) => city.state))];
  for (const state of states) {
    for (const intent of cityIntents) {
      gaps.push({
        kind: "state-intent",
        canonicalPath: `/${intent}/${state}`,
        priority: 10,
        reason: "state-level-editorial-not-supported",
        entity: state,
      });
    }
  }

  gaps.sort((a, b) => b.priority - a.priority || a.canonicalPath.localeCompare(b.canonicalPath));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), gaps }, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, gaps: gaps.length }, null, 2));
}

async function fetchRows<T>(table: string, select: string): Promise<T[]> {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: { apikey: supabaseKey!, Authorization: `Bearer ${supabaseKey!}` },
  });
  if (!response.ok) throw new Error(`${table} query failed: ${response.status} ${await response.text()}`);
  return await response.json() as T[];
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
