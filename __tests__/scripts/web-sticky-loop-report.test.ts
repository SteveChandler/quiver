import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildWebStickyHogQL,
  loadWebStickyRows,
  main,
  parseCliArgs,
  parseWebStickyRows,
  renderWebStickyMarkdown,
} from "@/scripts/web-sticky-loop-report";

describe("web sticky loop report runner", () => {
  const now = new Date("2026-10-14T18:00:00.000Z");

  it("defaults to 28 complete Los Angeles days and parses explicit flags", () => {
    const defaults = parseCliArgs([], now);
    expect(defaults.window.startDate).toBe("2026-09-16");
    expect(defaults.window.endDate).toBe("2026-10-14");
    expect(defaults.window.start.toISOString()).toBe("2026-09-16T07:00:00.000Z");
    expect(defaults.powerDays).toBe(4);
    const options = parseCliArgs(["--start", "2026-03-07", "--end", "2026-03-10", "--tz", "America/Los_Angeles", "--power-days", "5", "--output-json", "out.json", "--output-md", "out.md"], now);
    expect(options.window.end.toISOString()).toBe("2026-03-10T07:00:00.000Z");
    expect(options.powerDays).toBe(5);
    expect(options.outputMd).toBe("out.md");
    expect(() => parseCliArgs(["--start", "2026-03-07"], now)).toThrow();
    expect(() => parseCliArgs(["--days", "0"], now)).toThrow();
    expect(() => parseCliArgs(["--tz", "Bad/Zone"], now)).toThrow();
  });

  it("always queries only eligible production web events with bounds and deterministic pagination", () => {
    const options = parseCliArgs([], now);
    for (const offset of [0, 10000, 20000]) {
      const query = buildWebStickyHogQL(options, offset);
      expect(query).toContain("event = 'page_view'");
      expect(query).not.toContain("'$pageview'");
      expect(query).toContain("properties.$lib = 'web'");
      expect(query).toContain("properties.environment = 'production'");
      expect(query).toContain("properties.$host IN ('www.quiversurf.app', 'quiversurf.app', 'go.quiversurf.app')");
      expect(query).toContain("NOT coalesce(properties.$virt_is_bot, false)");
      expect(query).toContain("coalesce(properties.$is_emulator, false) = false");
      expect(query).toContain("person_id NOT IN COHORT");
      expect(query).toContain("person_distinct_ids");
      expect(query).toContain(`timestamp >= toDateTime('${options.window.start.toISOString()}')`);
      expect(query).toContain(`timestamp < toDateTime('${options.window.end.toISOString()}')`);
      expect(query).toContain("toString(toDate(toTimeZone(timestamp, 'America/Los_Angeles'))) AS d");
      expect(query).toContain("ORDER BY person_id, timestamp, uuid");
      expect(query).toContain(`LIMIT 10000 OFFSET ${offset}`);
      expect(query).not.toContain("SETTINGS");
    }
  });

  it("parses source rows and rejects malformed results", () => {
    const parsed = parseWebStickyRows([["person", "session", "2026-10-01", "2026-10-01T12:00:00Z", "home", "landing-page", true, "page_view", "uuid"]]);
    expect(parsed[0].identified).toBe(true);
    expect(parsed[0].timestamp).toBe("2026-10-01T12:00:00.000Z");
    expect(() => parseWebStickyRows([["person"]])).toThrow("Invalid PostHog row");
  });

  it("keeps requesting bounded pages until a short page", async () => {
    const options = parseCliArgs([], now);
    const page = Array.from({ length: 10000 }, (_, index) => [
      `person-${index}`, "session", "2026-10-01", "2026-10-01T12:00:00Z", "map", "map", false, "page_view", `uuid-${index}`,
    ]);
    const runner = jest.fn().mockResolvedValueOnce({ columns: [], results: page }).mockResolvedValueOnce({ columns: [], results: [] });
    const rows = await loadWebStickyRows(options, runner);
    expect(rows).toHaveLength(10000);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner.mock.calls[1][0]).toContain("LIMIT 10000 OFFSET 10000");
  });

  it("writes JSON and a source-backed Markdown summary without querying production", async () => {
    const directory = mkdtempSync(join(tmpdir(), "web-sticky-loop-"));
    try {
      const jsonPath = join(directory, "report.json");
      const mdPath = join(directory, "report.md");
      const loader = jest.fn(async () => parseWebStickyRows([[
        "person", "session", "2026-10-01", "2026-10-01T12:00:00Z", "map", "map", false, "page_view", "uuid",
      ]]));
      const report = await main(["--days", "28", "--output-json", jsonPath, "--output-md", mdPath], now, loader);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(JSON.parse(readFileSync(jsonPath, "utf8")).schemaVersion).toBe("web_sticky_loop.v1");
      const markdown = readFileSync(mdPath, "utf8");
      expect(markdown).toBe(renderWebStickyMarkdown(report));
      expect(markdown).toContain("map | 1 | 1 | 1");
      expect(markdown).toContain("0/1 (0.0%)");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
