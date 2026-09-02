/**
 * @jest-environment node
 */

const fs = require("node:fs");
const path = require("node:path");

function expectPermanentRedirect(configSource, source, destination) {
  expect(configSource).toContain(`{
        source: "${source}",
        destination: "${destination}",
        permanent: true,
      }`);
}

function expectTemporaryRedirect(configSource, source, destination) {
  expect(configSource).toContain(`{
        source: "${source}",
        destination: "${destination}",
        permanent: false,
      }`);
}

describe("SEO legacy redirects", () => {
  it("temporarily redirects the TikTok bio short link", () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

    expectTemporaryRedirect(
      configSource,
      "/tiktok",
      "/pbsc?utm_source=tiktok&utm_medium=bio",
    );
  });

  it("permanently redirects retired embed outreach URLs", () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

    expectPermanentRedirect(
      configSource,
      "/embed-for-surf-schools",
      "/for-surf-schools",
    );
    expectPermanentRedirect(
      configSource,
      "/embed-for-surf-schools&source=:source",
      "/for-surf-schools?source=:source",
    );
    expectPermanentRedirect(
      configSource,
      "/embed-for-businesses",
      "/for-businesses",
    );
    expectPermanentRedirect(
      configSource,
      "/embed-for-businesses&source=:source",
      "/for-businesses?source=:source",
    );
  });

  it("permanently redirects legacy SEO parent routes to live hubs", () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

    expectPermanentRedirect(configSource, "/water-temp", "/beaches/usa");
    expectPermanentRedirect(configSource, "/surf-cams", "/cams");
  });

  it("permanently redirects duplicate cam region pages to their curated owners", () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

    expectPermanentRedirect(configSource, "/cams/florida", "/surf-cams/florida");
    // Hawaii runs the other way: the /cams directory page is the GSC winner.
    expectPermanentRedirect(configSource, "/surf-cams/hawaii", "/cams/hawaii");
    expect(configSource).not.toContain('source: "/cams/hawaii"');
  });

  it("permanently redirects the retired Cocoa Beach Pier URL family", () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

    expectPermanentRedirect(
      configSource,
      "/fl/cocoa-beach/cocoa-beach-pier",
      "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl",
    );
    expectPermanentRedirect(
      configSource,
      "/fl/cocoa-beach/cocoa-beach-pier/tides",
      "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl/tides",
    );
    expectPermanentRedirect(
      configSource,
      "/fl/cocoa-beach/cocoa-beach-pier/water-temp",
      "/fl/cocoa-beach/cocoa-beach-pier-cocoa-beach-fl/water-temp",
    );
  });

  it("permanently redirects the invalid El Morro URL to the canonical beach page", () => {
    const configSource = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");

    expectPermanentRedirect(
      configSource,
      "/mexico/baja-california/rosarito/el-morro",
      "/mexico/baja-california/rosarito/el-morro-point-k375",
    );
  });
});
