import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata } from "@/app/personal-surf-forecast/page";

describe("Personal surf forecast SEO page", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "app/personal-surf-forecast/page.tsx"),
    "utf8",
  );

  it("keeps metadata within search result limits", () => {
    expect(String(metadata.title).length).toBeLessThanOrEqual(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
  });

  it("is included in the static sitemap routes", () => {
    const sitemapSource = readFileSync(
      join(process.cwd(), "app/sitemap.ts"),
      "utf8",
    );

    expect(sitemapSource).toContain('"/personal-surf-forecast"');
  });

  it("does not emit ineligible application structured data", () => {
    expect(pageSource).not.toContain('"@type": "SoftwareApplication"');
  });

  it("does not use prohibited accuracy-superiority copy", () => {
    const normalizedSource = pageSource.toLowerCase();

    expect(normalizedSource).not.toContain("most accurate");
    expect(normalizedSource).not.toContain("more accurate than");
  });

  it("states the learning threshold and Pro boundary", () => {
    const normalizedSource = pageSource.toLowerCase();

    expect(normalizedSource).toContain("five eligible rated sessions");
    expect(normalizedSource).toContain("personal match requires quiver pro");
  });

  /**
   * Every Quiver page that currently ranks carries its target query in the H1
   * near-verbatim (/vs/surfline -> "Surfline Alternative...", /learn/best-tide-for-surfing
   * -> "What Is the Best Tide for Surfing?"). This page originally shipped with a
   * clever H1 that omitted the query entirely. Guarding the convention.
   */
  it("carries the target query in the H1", () => {
    const h1 = pageSource.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);

    expect(h1).not.toBeNull();
    expect(h1?.[1]).toBe("Personal Surf Forecast App");
    expect(h1?.[1].toLowerCase()).toContain("personal surf forecast app");
  });
});
