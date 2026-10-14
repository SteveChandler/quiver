import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as reportGuards from "@/lib/analytics/report-guards";
import {
  buildWebStickyHogQL,
  loadWebStickyRows,
  loadWebStickyProfileExclusions,
  main,
  parseCliArgs,
  parseWebStickyRows,
  renderWebStickyMarkdown,
} from "@/scripts/web-sticky-loop-report";

jest.mock("@/lib/analytics/report-guards", () => ({
  ...jest.requireActual("@/lib/analytics/report-guards"),
  createReadOnlySupabaseFromEnv: jest.fn(),
}));

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
    for (const cursor of [null, { timestamp: "2026-10-01T12:00:00.123456Z", uuid: "uuid-09999" }]) {
      const query = buildWebStickyHogQL(options, cursor);
      expect(query).toContain("event = 'page_view'");
      expect(query).toContain("toString(uuid) AS uuid,\n      distinct_id");
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
      expect(query).toContain("ORDER BY timestamp, uuid");
      expect(query).toContain("LIMIT 10000");
      expect(query).not.toContain("OFFSET");
      expect(query).not.toContain("SETTINGS");
    }
  });

  it("parses source rows and rejects malformed results", () => {
    const parsed = parseWebStickyRows([["person", "session", "2026-10-01", "2026-10-01T12:00:00Z", "home", "landing-page", true, "page_view", "uuid", "cookie-person"]]);
    expect(parsed[0].distinctId).toBe("cookie-person");
    expect(parsed[0].identified).toBe(true);
    expect(parsed[0].timestamp).toBe("2026-10-01T12:00:00.000Z");
    expect(() => parseWebStickyRows([["person"]])).toThrow("Invalid PostHog row");
  });

  it("keeps requesting bounded pages until a short page", async () => {
    const options = parseCliArgs([], now);
    const page = Array.from({ length: 10000 }, (_, index) => [
      `person-${index}`, "session", "2026-10-01", "2026-10-01T12:00:00.123456Z", "map", "map", false, "page_view", `uuid-${String(index).padStart(5, "0")}`, `cookie-${index}`,
    ]);
    const lastPage = [["person-10000", "session", "2026-10-01", "2026-10-01T12:00:00.123456Z", "map", "map", false, "page_view", "uuid-10000", "cookie-10000"]];
    const runner = jest.fn().mockResolvedValueOnce({ columns: [], results: page }).mockResolvedValueOnce({ columns: [], results: lastPage });
    const rows = await loadWebStickyRows(options, runner);
    expect(rows).toHaveLength(10001);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner.mock.calls[0][0]).not.toContain("timestamp > toDateTime64");
    expect(runner.mock.calls[1][0]).toContain("timestamp > toDateTime64('2026-10-01T12:00:00.123456Z', 6, 'UTC')");
    expect(runner.mock.calls[1][0]).toContain("timestamp = toDateTime64('2026-10-01T12:00:00.123456Z', 6, 'UTC') AND toString(uuid) > 'uuid-09999'");
    for (const [query] of runner.mock.calls) {
      expect(query).toContain("ORDER BY timestamp, uuid");
      expect(query).toContain("LIMIT 10000");
      expect(query).not.toContain("OFFSET");
    }
  });

  it("looks up only identified UUID distinct IDs using the guarded read-only client", async () => {
    const mockId = "11111111-1111-4111-8111-111111111111";
    const missingId = "22222222-2222-4222-8222-222222222222";
    const anonymousId = "33333333-3333-4333-8333-333333333333";
    const rows = parseWebStickyRows([
      ["mock", "s", "2026-10-01", "2026-10-01T12:00:00Z", "home", "home", true, "page_view", "u1", mockId],
      ["mock", "s", "2026-10-01", "2026-10-01T12:01:00Z", "map", "map", true, "page_view", "u2", mockId],
      ["missing", "s", "2026-10-01", "2026-10-01T12:00:00Z", "home", "home", true, "page_view", "u3", missingId],
      ["cookie", "s", "2026-10-01", "2026-10-01T12:00:00Z", "home", "home", true, "page_view", "u4", "not-a-uuid"],
      ["anonymous", "s", "2026-10-01", "2026-10-01T12:00:00Z", "landing", "landing-page", false, "page_view", "u5", anonymousId],
    ]);
    const lookup = jest.fn().mockResolvedValue({ data: [{ id: mockId, is_mock: true }], error: null });
    const select = jest.fn(() => ({ in: lookup }));
    const from = jest.fn(() => ({ select }));
    const client = reportGuards.readOnlySupabase({ from });
    const factory = jest.mocked(reportGuards.createReadOnlySupabaseFromEnv).mockReturnValue(client);
    try {
      const exclusions = await loadWebStickyProfileExclusions(rows);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(from).toHaveBeenCalledWith("profiles");
      expect(select).toHaveBeenCalledWith("id,deleted_at,is_mock,is_system_account,analytics_is_real_user");
      expect(lookup).toHaveBeenCalledWith("id", [mockId, missingId]);
      expect(exclusions).toEqual(new Map([[mockId, "mock_profile"], [missingId, "missing_profile"]]));
    } finally {
      factory.mockReset();
    }
  });

  it("writes JSON and a source-backed Markdown summary without querying production", async () => {
    const directory = mkdtempSync(join(tmpdir(), "web-sticky-loop-"));
    try {
      const jsonPath = join(directory, "report.json");
      const mdPath = join(directory, "report.md");
      const loader = jest.fn(async () => parseWebStickyRows([[
        "person", "session", "2026-10-01", "2026-10-01T12:00:00Z", "map", "map", false, "page_view", "uuid", "cookie-person",
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
