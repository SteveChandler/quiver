import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { learnArticles } from "@/lib/data/learn-articles";

/**
 * Guards the 2026-08-19 cannibalization consolidations.
 *
 * Two pairs of pages were competing for the same queries in Google Search Console:
 *
 *  1. /best-free-surf-forecast-app vs /best-surf-forecast-app — the latter already
 *     outranked the former for "best free surf forecast app" (pos 9.5 vs absent),
 *     so the former was merged in and 308-redirected.
 *  2. /learn/why-waves-better-in-morning vs /learn/best-time-of-day-to-surf — same
 *     thermal-wind topic and section structure; the indexed page survived.
 *
 * A consolidation is only complete if the retired URL redirects permanently AND is
 * gone from the sitemap. Leaving it in the sitemap re-submits a redirecting URL and
 * undoes the consolidation, which is the specific regression this guards.
 */
const RETIRED = [
  {
    from: "/best-free-surf-forecast-app",
    to: "/best-surf-forecast-app",
    dir: "app/best-free-surf-forecast-app",
  },
  {
    from: "/learn/why-waves-better-in-morning",
    to: "/learn/best-time-of-day-to-surf",
    dir: null,
  },
  // 2026-09-01: /cams/hawaii (152 GSC impressions, pos 15) beat the curated
  // /surf-cams/hawaii page (1 impression), so the curated page retired into it.
  {
    from: "/surf-cams/hawaii",
    to: "/cams/hawaii",
    dir: null,
  },
];

describe("SEO consolidation", () => {
  const nextConfig = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
  const sitemap = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf8");

  it.each(RETIRED)("permanently redirects $from -> $to", ({ from, to }) => {
    const block = nextConfig
      .split("{")
      .find((chunk) => chunk.includes(`source: "${from}"`));

    expect(block).toBeDefined();
    expect(block).toContain(`destination: "${to}"`);
    expect(block).toContain("permanent: true");
  });

  it.each(RETIRED)("drops $from from the sitemap", ({ from }) => {
    expect(sitemap).not.toContain(`"${from}"`);
  });

  it.each(RETIRED.filter((r) => r.dir))(
    "removes the consolidated route directory for $from",
    ({ dir }) => {
      expect(existsSync(join(process.cwd(), dir as string))).toBe(false);
    },
  );

  it("no longer ships the merged learn article", () => {
    const slugs = learnArticles.map((a) => a.slug);
    expect(slugs).not.toContain("why-waves-better-in-morning");
    expect(slugs).toContain("best-time-of-day-to-surf");
  });

  it("keeps the merged article's query intent on the surviving page", () => {
    const survivor = learnArticles.find((a) => a.slug === "best-time-of-day-to-surf");
    const keywords = (survivor?.keywords ?? []).join(" ").toLowerCase();
    expect(keywords).toMatch(/morning/);
  });
});
