import fs from "node:fs";
import path from "node:path";

import { learnArticles } from "@/lib/data/learn-articles";

/**
 * Guards the orphaned-article bug found on 2026-08-19.
 *
 * `surf-paddling-for-beginners` shipped without being added to the CATEGORIES
 * list on /learn. The hub renders from that hardcoded list, not from
 * learnArticles, so the page was linked from nowhere on the site. Google
 * reported it "Discovered - currently not indexed" and never crawled it.
 *
 * The article data and the sitemap were both correct, which is why every
 * existing test stayed green. Reachability was the untested invariant.
 */
describe("learn hub coverage", () => {
  const hubSource = fs.readFileSync(
    path.join(process.cwd(), "app/learn/page.tsx"),
    "utf8",
  );
  const categoriesBlock = hubSource
    .split("const CATEGORIES")[1]
    ?.split("export default")[0] ?? "";

  it("links every learn article from the hub", () => {
    const orphans = learnArticles
      .map((article) => article.slug)
      .filter((slug) => !categoriesBlock.includes(`"${slug}"`));

    expect(orphans).toEqual([]);
  });

  it("does not list slugs the hub cannot resolve to an article", () => {
    const known = new Set(learnArticles.map((a) => a.slug));
    const listed = (categoriesBlock.match(/"([a-z0-9-]{6,})"/g) ?? [])
      .map((raw) => raw.slice(1, -1))
      .filter((slug) => slug.includes("-"));

    const unresolvable = listed.filter(
      (slug) => !known.has(slug) && /^(how|what|best|why|surf|beginner|is)-/.test(slug),
    );

    expect(unresolvable).toEqual([]);
  });
});
