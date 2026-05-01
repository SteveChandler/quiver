/**
 * scripts/hero-rank-smoke.ts
 *
 * Smoke against the deployed Preview environment. Loads the Playwright
 * stored auth state for dev.quiversurf.app, hits /api/surf/discover
 * authenticated, and prints the response shape so we can confirm the
 * deployed code path runs. Cookies stay sealed inside the Playwright
 * request context — never printed.
 *
 * Usage: npx tsx scripts/hero-rank-smoke.ts
 *        npx tsx scripts/hero-rank-smoke.ts https://dev.quiversurf.app
 */
import { request } from "@playwright/test";

const BASE = process.argv[2] ?? "https://dev.quiversurf.app";
const STATE = "e2e/.auth/state.json";

async function main(): Promise<void> {
  const ctx = await request.newContext({
    baseURL: BASE,
    storageState: STATE,
  });

  const url = `/api/surf/discover?lat=32.74&lon=-117.25&maxResults=5`;
  const t0 = Date.now();
  const res = await ctx.get(url);
  const ms = Date.now() - t0;

  console.log(`GET ${BASE}${url}  → HTTP ${res.status()}  (${ms}ms)`);

  if (!res.ok()) {
    console.log("body:", (await res.text()).slice(0, 300));
    await ctx.dispose();
    process.exit(res.status() === 401 ? 2 : 1);
  }

  const body = (await res.json()) as {
    recommendations?: Array<{
      beach?: { slug?: string; name?: string };
      score?: number;
    }>;
  };
  const recs = body.recommendations ?? [];
  console.log(`recs: ${recs.length}`);
  recs.slice(0, 5).forEach((r, i) => {
    const slug = r.beach?.slug ?? "?";
    const score = r.score?.toFixed?.(1) ?? "?";
    console.log(`  ${i + 1}. ${slug}  score=${score}`);
  });

  console.log(
    "\nNote: hero_rank_candidate diagnostic emits server-side; check Vercel logs " +
      "concurrently to see the sharedSetupSignal field.",
  );

  await ctx.dispose();
}

main().catch((e) => {
  console.log(`smoke: error — ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
