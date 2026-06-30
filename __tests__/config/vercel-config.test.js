/**
 * @jest-environment node
 */

const fs = require("node:fs");
const path = require("node:path");

describe("vercel.json", () => {
  it("does not use an ignored build step", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config).not.toHaveProperty("ignoreCommand");
    expect(Array.isArray(config.crons)).toBe(true);
    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/api/monitoring/forecast-health" }),
        expect.objectContaining({ path: "/api/cron/similarity-alerts" }),
      ]),
    );
  });

  it("refreshes tide predictions twice weekly to stay inside warning freshness", () => {
    const configPath = path.join(process.cwd(), "vercel.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config.crons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/api/cron/forecasts/refresh?source=tide&maxBeaches=261",
          schedule: "0 4 * * 0,3",
        }),
      ]),
    );
  });
});
