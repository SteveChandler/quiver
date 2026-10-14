import { parseCliArgs, createReportClient, loadPushOpens, loadPushTelemetryInput, main } from "@/scripts/push-telemetry-report";
import { readOnlySupabase } from "@/lib/analytics/report-guards";

describe("push telemetry report runner", () => {
  it("parses complete local days, horizons, and output paths", () => {
    expect(parseCliArgs([
      "--start", "2026-01-01", "--end", "2026-01-03", "--tz", "UTC",
      "--as-of", "2026-01-04T00:00:00Z", "--open-horizon-hours", "12",
      "--decision-horizon-minutes", "30", "--output-json", "out.json", "--output-md", "out.md",
    ])).toMatchObject({
      window: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-03T00:00:00.000Z" },
      openHorizonHours: 12, decisionHorizonMinutes: 30, outputJson: "out.json", outputMd: "out.md",
    });
    expect(() => parseCliArgs(["--start", "2026-01-01"])).toThrow();
    expect(() => parseCliArgs(["--days", "0"])).toThrow();
    expect(() => parseCliArgs(["--days", "1", "--as-of", "2026-01-01T00:00:00"])).toThrow();
  });

  it("uses the guarded read-only client and pages exact opens", async () => {
    const range = jest.fn().mockResolvedValue({ data: [], error: null });
    const order = jest.fn().mockReturnThis();
    const lt = jest.fn().mockReturnThis();
    const gte = jest.fn().mockReturnThis();
    const eq = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnValue({ range, order, lt, gte, eq });
    const from = jest.fn().mockReturnValue({ select, insert: jest.fn() });
    const guarded = readOnlySupabase({ from });
    await expect(loadPushOpens(guarded, { start: "2026-01-01", end: "2026-01-02" })).resolves.toEqual([]);
    expect(eq).toHaveBeenCalledWith("event_type", "native_open_from_push");
    expect(range).toHaveBeenCalledWith(0, 999);
    expect(() => (guarded.from("user_events") as unknown as { insert: (value: unknown) => unknown }).insert({})).toThrow("read-only");
    expect(from).toHaveBeenCalledTimes(1);
    expect(() => createReportClient({ NODE_ENV: "test" })).toThrow("Missing required env var");
  });

  it("loads empty sources through paged selects and fails before connecting for invalid arguments", async () => {
    const range = jest.fn().mockResolvedValue({ data: [], error: null });
    const query: Record<string, jest.Mock> = {};
    for (const method of ["eq", "gte", "lt", "lte", "in", "order"]) {
      query[method] = jest.fn().mockReturnValue(query);
    }
    query.range = range;
    const from = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue(query) });
    const client = readOnlySupabase({ from });
    const options = parseCliArgs(["--start", "2026-01-01", "--end", "2026-01-02", "--tz", "UTC", "--as-of", "2026-01-03T00:00:00Z"]);
    await expect(loadPushTelemetryInput(client, options)).resolves.toMatchObject({
      attempts: [], notificationEvents: [], devices: [], userEvents: [], alertDeliveryAttempts: [],
    });
    expect(range).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("notification_delivery_targets");
    await expect(main(["--invalid", "value"])).rejects.toThrow("Unknown flag");
  });
});
