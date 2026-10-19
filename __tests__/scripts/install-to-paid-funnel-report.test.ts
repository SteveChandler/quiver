import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchPostHogEvents,
  parseCliArgs,
  parsePostHogRows,
  rowsToCsv,
  createReportClient,
  aggregatesToMarkdown,
} from "@/scripts/install-to-paid-funnel-report";
import { buildInstallToPaidRows, buildInstallDimensions, buildInstallToPaidAggregates } from "@/lib/analytics/install-to-paid-funnel-v1";
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

  it("resolves local complete days and markdown output", () => {
    const options = parseCliArgs(["--start", "2026-01-01", "--end", "2026-01-08",
      "--tz", "America/Los_Angeles", "--output-md", "report.md"]);
    expect(options).toMatchObject({
      start: "2026-01-01T08:00:00.000Z", end: "2026-01-08T08:00:00.000Z",
      outputMd: "report.md", window: { timeZone: "America/Los_Angeles" },
    });
    const rows = buildInstallToPaidRows(INSTALL_TO_PAID_V1_FIXTURE);
    const report = buildInstallToPaidAggregates(rows,
      buildInstallDimensions(INSTALL_TO_PAID_V1_FIXTURE, rows), {
        asOf: INSTALL_TO_PAID_V1_FIXTURE.asOf,
        window: options.window,
        sourceFreshness: INSTALL_TO_PAID_V1_FIXTURE.sourceFreshness,
        revenueCatEvents: INSTALL_TO_PAID_V1_FIXTURE.revenueCatEvents,
      });
    const markdown = aggregatesToMarkdown(report);
    expect(markdown).toContain("| Verified trial |");
    expect(markdown).toContain("## platform: unknown");
    expect(markdown).toContain("unknown n=");
    expect(markdown).toContain("known-join rate");
    expect(markdown).toContain("lower bound (unknown counted as no)");
    expect(markdown).toContain("Not applicable n");
    expect(markdown).toContain("within 7 days");
    expect(markdown).toContain("| Signup | 10 | 0 | 4 | 0 | 1 | n=10/10 (100.0%) | n=10/14 (71.4%) | n=4/14 (28.6%) |");
  });

  it("validates a configurable trial window with a seven-day default", () => {
    expect(parseCliArgs([]).trialWindowDays).toBe(7);
    expect(parseCliArgs(["--trial-window-days", "14"]).trialWindowDays).toBe(14);
    for (const value of ["0", "-1", "1.5", "bad"]) {
      expect(() => parseCliArgs(["--trial-window-days", value])).toThrow("--trial-window-days");
    }
    expect(() => parseCliArgs(["--trial-window-days"])).toThrow("--trial-window-days");
  });

  it("uses --days for the default Los Angeles complete-day window", () => {
    expect(parseCliArgs(["--days", "7"], new Date("2026-02-15T18:00:00.000Z")))
      .toMatchObject({
        start: "2026-02-08T08:00:00.000Z", end: "2026-02-15T08:00:00.000Z",
        window: { startDate: "2026-02-08", endDate: "2026-02-15",
          timeZone: "America/Los_Angeles" },
      });
  });

  it("creates a read-only Supabase client whose writes throw", () => {
    const oldUrl = process.env.SUPABASE_URL;
    const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const oldPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
      const client = createReportClient();
      expect(typeof client.from("profiles").select).toBe("function");
      expect(() => (client.from("profiles") as any).insert({ id: "x" })).toThrow("read-only");
      expect(() => (client as any).rpc("write")).toThrow("read-only");
    } finally {
      if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
      if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
      if (oldPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = oldPublicUrl;
    }
  });

  it("keyset-pages HogQL by timestamp and UUID and bounds first opens to the cohort", async () => {
    const page = Array.from({ length: 1000 }, (_, index) => [
      "home_viewed",
      "2026-01-01T00:00:00Z",
      `distinct-${index}`,
      `person-${index}`,
      null,
      {},
      `00000000-0000-7000-8000-${index.toString(16).padStart(12, "0")}`,
    ]);
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: page })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] })));
    process.env.POSTHOG_PROJECT_ID = "project";
    process.env.POSTHOG_API_KEY = "key";

    await expect(fetchPostHogEvents({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-02T00:00:00.000Z",
      asOf: "2026-01-02T00:00:00.000Z",
    })).resolves.toHaveLength(1000);

    const queries = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init?.body)).query.query as string
    );
    expect(queries[0]).toContain("ORDER BY timestamp ASC, uuid ASC");
    expect(queries[0]).toContain("LIMIT 1000");
    expect(queries[0]).toContain("'native_install_attribution_joined'");
    expect(queries[0]).not.toContain("OFFSET");
    expect(queries[0]).toContain("timestamp >= toDateTime('2026-01-01T00:00:00.000Z')");
    expect(queries[0]).toContain("timestamp < toDateTime('2026-01-02T00:00:00.000Z')");
    expect(queries[1]).toBe(queries[0]);
    expect(queries[2]).toContain("timestamp > '2026-01-01T00:00:00Z'");
    expect(queries[2]).toContain("uuid > toUUID('00000000-0000-7000-8000-0000000003e7')");
    expect(queries[2]).not.toContain("OFFSET");
    expect(queries[0]).toContain("event != 'native_app_first_open'");
    expect(queries[0]).toContain("timestamp < toDateTime('2026-01-02T00:00:00.000Z')");
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

  it("preserves string-encoded HogQL properties for dimensions and exclusions", () => {
    const properties = { platform: "native-ios", install_attribution_outcome: "organic",
      onboarding_variant: "A", is_emulator: true };
    const events = parsePostHogRows({ results: [[
      "native_app_first_open", "2026-01-01T00:00:00Z", "anonymous-id", "person-id",
      "10000000-0000-4000-8000-000000000001", JSON.stringify(properties),
    ]] });
    expect(events[0].properties).toEqual(properties);
    const input = { ...INSTALL_TO_PAID_V1_FIXTURE, behaviorEvents: events, installLinks: [] };
    expect(buildInstallDimensions(input)[events[0].nativeInstallId!]).toMatchObject({
      platform: "ios", acquisitionSource: "outcome:organic",
    });
    expect(buildInstallToPaidRows(input)[0].exclusionReason).toBe("emulator");
  });

  it.each(["not json", "[]", "null", "42", "\"text\"", [], null])(
    "ignores invalid or non-object properties: %p", (properties) => {
      expect(parsePostHogRows({ results: [[
        "native_app_first_open", "2026-01-01T00:00:00Z", "anonymous-id", "person-id",
        "10000000-0000-4000-8000-000000000001", properties,
      ]] })[0].properties).toBeUndefined();
    },
  );

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
