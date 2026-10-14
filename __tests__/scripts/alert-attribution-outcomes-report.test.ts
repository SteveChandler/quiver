import { createReportClient, loadAlertAttributionInput, main, markdown, parseCliArgs } from "@/scripts/alert-attribution-outcomes-report";
import { readOnlySupabase } from "@/lib/analytics/report-guards";
import { buildAlertAttributionOutcomesReport } from "@/lib/analytics/alert-attribution-outcomes-v1";
import { loadPushTelemetryInput, parseCliArgs as parsePushCliArgs } from "@/scripts/push-telemetry-report";

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

  it.each([
    ["alert attribution", loadAlertAttributionInput],
    ["push telemetry", loadPushTelemetryInput],
  ] as const)("loads %s user events in batches of 25 using the user/time index", async (_name, loadInput) => {
    const userIds = Array.from({ length: 51 }, (_, index) => `user-${String(index).padStart(2, "0")}`);
    const events = userIds.flatMap((userId) => ["01", "02"].map((hour) => ({
      id: `${userId}-${hour}`, user_id: userId, event_type: "beach_view",
      created_at: `2026-01-01T${hour}:00:00.000Z`, metadata: null,
    })));
    const userQueries: Array<{ ids: string[]; order: jest.Mock }> = [];
    const from = jest.fn((table: string) => {
      const query: Record<string, jest.Mock> = {};
      let ids: string[] | undefined;
      for (const method of ["select", "eq", "gte", "lt", "lte", "order"]) query[method] = jest.fn().mockReturnValue(query);
      query.in = jest.fn((column: string, values: string[]) => {
        if (column === "user_id") ids = values;
        return query;
      });
      query.then = jest.fn((resolve: (value: unknown) => void) => resolve({ data: userIds.map((id) => ({ id })), error: null }));
      query.range = jest.fn(async () => {
        if (table === "user_events" && ids) {
          userQueries.push({ ids, order: query.order });
          return { data: events.filter((event) => ids!.includes(event.user_id)).reverse(), error: null };
        }
        if (table === "alert_delivery_attempts") return { data: userIds.map((user_id) => ({
          id: user_id, user_id, status: "sent", channel: "push", message_instance_id: null,
          attempted_at: "2026-01-01T00:00:00.000Z",
        })), error: null };
        if (table === "notification_delivery_attempts") return { data: userIds.map((id) => ({
          id, notification_event_id: id, status: "sent", channel: "push", created_at: "2026-01-01T00:00:00.000Z",
        })), error: null };
        if (table === "notification_events") return { data: userIds.map((id) => ({
          id, recipient_user_id: id, type: "forecast_alert",
        })), error: null };
        return { data: [], error: null };
      });
      return query;
    });
    const options = parsePushCliArgs(["--start", "2026-01-01", "--end", "2026-01-02", "--tz", "UTC", "--as-of", "2026-01-10T00:00:00Z"]);
    const input = await loadInput(readOnlySupabase({ from }), options);
    expect(userQueries.map((query) => query.ids.length)).toEqual([25, 25, 1]);
    expect(userQueries.flatMap((query) => query.ids)).toEqual(userIds);
    for (const query of userQueries) expect(query.order.mock.calls).toEqual([
      ["user_id"], ["created_at", { ascending: false }], ["id"],
    ]);
    expect(input.userEvents.map((event) => event.id)).toEqual([...events]
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id))
      .map((event) => event.id));
  });
});
