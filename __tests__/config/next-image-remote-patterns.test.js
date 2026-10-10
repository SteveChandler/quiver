/**
 * @jest-environment node
 */

const fs = require("node:fs");
const path = require("node:path");

describe("next image remote patterns", () => {
  it("allows private Supabase storage object URLs on the configured storage host", () => {
    const configPath = path.join(process.cwd(), "next.config.mjs");
    const configSource = fs.readFileSync(configPath, "utf8");

    expect(configSource).toMatch(
      /hostname:\s*supabaseHostname,[\s\S]*?pathname:\s*"\/storage\/v1\/object\/\*\*"/,
    );
  });

  it("allows private Supabase storage object URLs on the production auth host", () => {
    const configPath = path.join(process.cwd(), "next.config.mjs");
    const configSource = fs.readFileSync(configPath, "utf8");

    expect(configSource).toMatch(
      /hostname:\s*"auth\.quiversurf\.app",[\s\S]*?pathname:\s*"\/storage\/v1\/object\/\*\*"/,
    );
  });
});

describe("next image optimization volume", () => {
  const configSource = fs.readFileSync(
    path.join(process.cwd(), "next.config.mjs"),
    "utf8",
  );
  const NEXT_DEFAULT_DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

  it("keeps deviceSizes a subset of Next's default ladder that still reaches 1920", () => {
    const match = configSource.match(/deviceSizes:\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();

    const sizes = match[1].split(",").map((s) => Number(s.trim()));
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    for (const size of sizes) {
      expect(NEXT_DEFAULT_DEVICE_SIZES).toContain(size);
    }
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(1920);
  });

  it("serves a single output format so each image has one variant set", () => {
    expect(configSource).toMatch(/formats:\s*\["image\/webp"\]/);
  });

  it("does not raise the global TTL floor above what cam stills can tolerate", () => {
    const match = configSource.match(/minimumCacheTTL:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBeLessThanOrEqual(86400);
  });
});
