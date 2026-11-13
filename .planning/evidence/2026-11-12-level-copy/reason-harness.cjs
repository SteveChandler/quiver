// Before/after harness: runs scoring, surf windows, Week Scout and discovery on
// the real rows in the LOCAL Supabase stack with a pinned clock, and prints a
// stable JSON dump. Usage: npx tsx --tsconfig <worktree>/tsconfig.json reason-harness.cjs <worktree> <out.json>
// Read only: it never writes to any database.
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const [, , worktree, outFile] = process.argv;
const PIN = Date.parse("2026-11-12T16:00:00.000Z");

// Local stack values only (worktree .env.development.local); never printed.
for (const line of readFileSync(path.join(worktree, ".env.development.local"), "utf8").split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) process.env[line.slice(0, eq)] = line.slice(eq + 1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1")) {
  throw new Error("harness must run against the local stack");
}

const RealDate = Date;
class PinnedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(PIN);
    else super(...args);
  }
  static now() { return PIN; }
}
globalThis.Date = PinnedDate;

// `server-only` throws outside the React server build; the harness is a server process.
const Module = require("node:module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return path.join(__dirname, "server-only-shim.cjs");
  // Import-only ESM package; Node can require() the ESM file directly.
  if (request === "@neaps/tide-predictor") return path.join(worktree, "node_modules/@neaps/tide-predictor/dist/index.js");
  return origResolve.call(this, request, ...rest);
};

async function main() {
  const req = (p) => import(path.join(worktree, p));
  const { createClient } = require(path.join(worktree, "node_modules/@supabase/supabase-js"));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const adapter = await req("lib/domains/scoring/discovery-adapter.ts");
  const { buildSurfWindowRecommendations } = await req("lib/recommendations/surf-window-recommendations.ts");
  const { generateWeekScoutForecast } = await req("lib/services/discovery/week-scout.ts");
  const { discoverSurfSpots } = await req("lib/services/discovery/surf-discovery-orchestrator.ts");
  const { buildDiscoveryMessage } = await req("lib/services/discovery/response-formatter.ts");

  const { data: fRows, error: fErr } = await sb.from("enhanced_forecasts").select("*").order("forecast_at");
  if (fErr) throw fErr;
  const beachIds = [...new Set((fRows ?? []).map((r) => r.beach_id))];
  const { data: beaches, error: bErr } = await sb.from("beaches").select("*").in("id", beachIds).order("id");
  if (bErr) throw bErr;

  const out = { pin: new RealDate(PIN).toISOString(), forecastRows: fRows.length, inputHash: require("node:crypto").createHash("sha256").update(JSON.stringify([fRows, beaches])).digest("hex"), beaches: beaches.map((b) => b.name) };

  const skills = [null, "beginner", "intermediate", "advanced"];
  const composites = [];
  const detailed = [];
  const engine = adapter.getDiscoveryScoringEngine();
  for (const beach of beaches) {
    for (const row of fRows.filter((r) => r.beach_id === beach.id)) {
      const profile = adapter.beachToSpotProfile(beach);
      for (const skill of skills) {
        const c = engine.score({
          profile: skill ? { ...profile, skillLevel: skill } : profile,
          snapshot: adapter.forecastToSnapshot(row),
          window: null,
          preferences: null,
        });
        composites.push({
          beach: beach.name, at: row.forecast_at, skill,
          total: c.total, subscores: Object.fromEntries(c.subscores), matchQuality: c.matchQuality,
          skipReason: c.skipReason, warnings: c.warnings, reasons: c.reasons,
          effects: (c.effects ?? []).map((e) => e.code),
          message: buildDiscoveryMessage(c.total, [...c.reasons], [...c.warnings]),
        });
        if (skill) {
          const d = adapter.scoreBeachWithEngine(engine, beach, row, { userSkillLevel: skill, beachSkillLevel: beach.skill_level });
          detailed.push({ beach: beach.name, at: row.forecast_at, skill, score: d,  });
        }
      }
    }
  }
  out.composites = composites;
  out.detailed = detailed;

  const groups = beaches.map((beach) => ({ beach, forecasts: fRows.filter((r) => r.beach_id === beach.id) }));
  out.surfWindows = {};
  for (const skill of skills) {
    const res = buildSurfWindowRecommendations(groups, { now: new Date(), maxRecommendations: 10, maxWindowsPerBeach: 4, userSkill: skill });
    out.surfWindows[String(skill)] = res.recommendations.map((r) => ({
      id: r.recommendationId, rank: r.rank, score: r.score, verdict: r.verdict, start: r.startIso,
      positives: r.positives, positiveCodes: r.positiveCodes, watchouts: r.watchouts,
    }));
  }

  try {
    const ws = await generateWeekScoutForecast("00000000-0000-4000-8000-000000000001", {
      candidateBeachIds: beachIds,
      localTimezone: "America/Los_Angeles",
      startLocalDate: "2026-11-12",
      dayCount: 7,
    });
    out.weekScout = JSON.parse(JSON.stringify(ws));
  } catch (e) {
    out.weekScout = { error: String(e) };
  }

  try {
    const disc = await discoverSurfSpots(null, { userLocation: { lat: 32.95, lon: -117.27 }, maxResults: 10 });
    out.discovery = JSON.parse(JSON.stringify(disc));
  } catch (e) {
    out.discovery = { error: String(e) };
  }

  writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log("ok", composites.length, "composites");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
