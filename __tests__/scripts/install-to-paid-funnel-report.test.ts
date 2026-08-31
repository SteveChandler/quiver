import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchPostHogEvents,
  parseCliArgs,
  parsePostHogRows,
  rowsToCsv,
} from "@/scripts/install-to-paid-funnel-report";
import { buildInstallToPaidRows } from "@/lib/analytics/install-to-paid-funnel-v1";
import { INSTALL_TO_PAID_V1_FIXTURE } from "@/__tests__/fixtures/install-to-paid-v1";

describe("install-to-paid report", () => {
  it("parses bounded CLI dates", () => {
    expect(parseCliArgs(
      ["--start", "2026-01-01", "--end", "2026-02-01"],
      new Date("2026-02-15T00:00:00.000Z"),
    )).toMatchObject({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
      asOf: "2026-02-15T00:00:00.000Z",
    });
  });

  it("rejects timezone-less CLI datetimes", () => {
    expect(() => parseCliArgs([
      "--start", "2026-01-01T00:00:00",
      "--end", "2026-02-01T00:00:00Z",
    ])).toThrow("--start must include UTC");
  });

  it("pages HogQL with a stable event UUID order and bounds first opens to the cohort", async () => {
    const page = Array.from({ length: 1000 }, (_, index) => [
      "home_viewed",
      `2026-01-01T00:00:${String(index % 60).padStart(2, "0")}Z`,
      `distinct-${index}`,
      `person-${index}`,
      null,
      {},
      `event-${index}`,
    ]);
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: page })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] })));
    process.env.POSTHOG_PROJECT_ID = "project";
    process.env.POSTHOG_API_KEY = "key";

    await expect(fetchPostHogEvents({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
      asOf: "2026-03-01T00:00:00.000Z",
      outputJson: null,
      outputCsv: null,
      ascJson: null,
    })).resolves.toHaveLength(1000);

    const queries = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)).query.query as string
    );
    expect(queries[0]).toContain("ORDER BY timestamp ASC, uuid ASC");
    expect(queries[0]).toContain("LIMIT 1000 OFFSET 0");
    expect(queries[1]).toContain("LIMIT 1000 OFFSET 1000");
    expect(queries[0]).toContain("event != 'native_app_first_open'");
    expect(queries[0]).toContain("timestamp < toDateTime('2026-02-01T00:00:00.000Z')");
    expect(queries[0]).toContain("timestamp < toDateTime('2026-03-01T00:00:00.000Z')");
    fetchMock.mockRestore();
  });

  it("maps PostHog HogQL rows without inventing joins", () => {
    expect(parsePostHogRows({ results: [[
      "native_app_first_open",
      "2026-01-01T00:00:00Z",
      "anonymous-id",
      "person-id",
      "10000000-0000-4000-8000-000000000001",
      { environment: "production" },
    ]] })).toEqual([expect.objectContaining({
      distinctId: "anonymous-id",
      personId: "person-id",
      nativeInstallId: "10000000-0000-4000-8000-000000000001",
    })]);
  });

  it("uses historical profile bounds and unique Supabase pagination tie-breakers", () => {
    const source = readFileSync(
      join(__dirname, "../../scripts/install-to-paid-funnel-report.ts"),
      "utf8",
    );
    expect(source).toMatch(/\.select\("id,session_id,user_id,created_at,metadata"\)[\s\S]*?\.order\("created_at"[\s\S]*?\.order\("id"/);
    expect(source).toMatch(/\.from\("profiles"\)[\s\S]*?\.lte\("created_at", options\.asOf\)/);
    expect(source).toMatch(/\.select\("id,user_id,received_at"\)[\s\S]*?\.order\("received_at"[\s\S]*?\.order\("id"/);
  });

  it("writes explicit join, maturity, and freshness fields to CSV", () => {
    const csv = rowsToCsv(buildInstallToPaidRows(INSTALL_TO_PAID_V1_FIXTURE));
    expect(csv).toContain("join_status,unknown_join_reason,maturity_status");
    expect(csv).toContain("posthog_fetched_at,supabase_fetched_at,revenuecat_ledger_latest_at");
    expect(csv).toContain("first_open_never_linked");
  });
});
