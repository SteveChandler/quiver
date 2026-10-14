import { createReportClient, loadAlertAttributionInput, main, markdown, parseCliArgs } from "@/scripts/alert-attribution-outcomes-report";
import { readOnlySupabase } from "@/lib/analytics/report-guards";
import { buildAlertAttributionOutcomesReport } from "@/lib/analytics/alert-attribution-outcomes-v1";

describe("alert attribution outcomes runner", () => {
  it("parses complete days and the 72-hour default", () => {
    expect(parseCliArgs(["--start", "2026-01-01", "--end", "2026-01-02", "--tz", "UTC", "--as-of", "2026-01-10T00:00:00Z"])).toMatchObject({
      openHorizonHours: 72, window: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" },
    });
    expect(() => parseCliArgs(["--start", "2026-01-01"])).toThrow();
    expect(() => parseCliArgs(["--days", "0"])).toThrow();
    expect(() => parseCliArgs(["--open-horizon-hours", "0"])).toThrow();
    expect(() => createReportClient({ NODE_ENV: "test" })).toThrow("Missing required env var");
  });

  it("uses paged read-only queries and the shared push-open loader", async () => {
    const query: Record<string, jest.Mock> = {};
    for (const method of ["eq", "gte", "lt", "lte", "in", "order"]) query[method] = jest.fn().mockReturnValue(query);
    query.range = jest.fn().mockResolvedValue({ data: [], error: null });
    const from = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(query), insert: jest.fn() });
    const client = readOnlySupabase({ from });
    const options = parseCliArgs(["--start", "2026-01-01", "--end", "2026-01-02", "--tz", "UTC", "--as-of", "2026-01-10T00:00:00Z"]);
    const input = await loadAlertAttributionInput(client, options);
    expect(input.instances).toEqual([]);
    expect(from).toHaveBeenCalledWith("alert_delivery_attempts");
    expect(query.eq).toHaveBeenCalledWith("event_type", "native_open_from_push");
    expect(query.range).toHaveBeenCalled();
    expect(() => (client.from("user_events") as unknown as { insert: (value: unknown) => unknown }).insert({})).toThrow("read-only");
    expect(() => markdown(buildAlertAttributionOutcomesReport(input))).not.toThrow();
    await expect(main(["--invalid", "value"])).rejects.toThrow("Unknown flag");
  });
});
