/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";

import {
  BEACH_DETAIL_CDN_MAX_AGE_SECONDS,
  beachDetailCdnCacheTag,
} from "@/lib/seo/beach-detail-cdn-cache";
import { getValidStateSlugs } from "@/lib/utils/beach-url-utils";

// next.config.mjs can't import TypeScript, so it repeats these values.
const nextConfig = readFileSync("next.config.mjs", "utf8");

describe("beach detail CDN cache contract", () => {
  it("shares beach detail HTML for exactly the declared bound, with no stale serving", () => {
    expect(nextConfig).toContain(
      `{ key: "Vercel-CDN-Cache-Control", value: "public, max-age=${BEACH_DETAIL_CDN_MAX_AGE_SECONDS}" }`,
    );
    expect(nextConfig).not.toMatch(/Vercel-CDN-Cache-Control[^\n]*stale-while-revalidate/);
  });

  it("covers every valid state slug the beach detail route accepts", () => {
    const match = nextConfig.match(/"\/:state\(([a-z|]+)\)\/:city\/:beachSlug"/);
    expect(match).not.toBeNull();
    expect(match?.[1].split("|").sort()).toEqual([...getValidStateSlugs()].sort());
  });

  it("tags each page with the tag hold invalidation expires", () => {
    expect(nextConfig).toContain(
      `tag: "${beachDetailCdnCacheTag("/:state/:city/:beachSlug")}"`,
    );
    expect(nextConfig).toContain(
      `tag: "${beachDetailCdnCacheTag("/mexico/:region/:city/:beachSlug")}"`,
    );
  });

  it("keeps RSC and prefetch requests out of the shared cache", () => {
    expect(nextConfig).toContain('{ type: "header", key: "rsc" }');
    expect(nextConfig).toContain('{ type: "header", key: "next-router-prefetch" }');
  });

  it("does not read the request user agent in the shared beach detail page", () => {
    const page = readFileSync("app/[intent]/[city]/[beachSlug]/page.tsx", "utf8");
    expect(page).not.toContain('from "next/headers"');
  });
});
