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
});
