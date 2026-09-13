import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadSwellWatchAudience,
  selectSwellWatchAudience,
  type SwellWatchAudienceRows,
} from "@/lib/alerts/swell-watch/audience";
import type { Database } from "@/types/database.generated";

type Relation = "profiles" | "favorite_beaches" | "alert_rules" | "user_devices";

interface FakeOptions {
  countOverrides?: Partial<Record<Relation, number>>;
  truncateRelations?: Relation[];
  errors?: Partial<Record<Relation, string>>;
  missingCounts?: Relation[];
  changedCounts?: Relation[];
}

function createSupabaseFixture(
  rows: Record<Relation, Array<Record<string, unknown>>>,
  options: FakeOptions = {},
): { supabase: SupabaseClient<Database>; ranges: Record<Relation, Array<[number, number]>>; calls: Array<{ relation: Relation; method: string; args: unknown[] }> } {
  const ranges: Record<Relation, Array<[number, number]>> = {
    profiles: [],
    favorite_beaches: [],
    alert_rules: [],
    user_devices: [],
  };
  const calls: Array<{ relation: Relation; method: string; args: unknown[] }> = [];
  const supabase = {
    from(relation: Relation) {
      let activeDevicesOnly = false;
      let excludesCustomSpots = false;
      const builder = {
        select(...args: unknown[]) {
          calls.push({ relation, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ relation, method: "eq", args });
          return builder;
        },
        is(...args: unknown[]) {
          calls.push({ relation, method: "is", args });
          if (relation === "user_devices" && args[0] === "retired_at") {
            activeDevicesOnly = args[1] === null;
          }
          if (relation === "favorite_beaches" && args[0] === "custom_spot_id") {
            excludesCustomSpots = args[1] === null;
          }
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ relation, method: "in", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ relation, method: "order", args });
          return builder;
        },
        range(from: number, to: number) {
          ranges[relation].push([from, to]);
          const relationRows = rows[relation].filter((row) => {
            if (relation === "user_devices" && activeDevicesOnly) {
              return row.retired_at === null;
            }
            if (relation === "favorite_beaches" && excludesCustomSpots) {
              return row.custom_spot_id === null;
            }
            return true;
          });
          const truncated = options.truncateRelations?.includes(relation);
          return Promise.resolve({
            data: truncated && from > 0 ? [] : relationRows.slice(from, to + 1),
            count: options.missingCounts?.includes(relation)
              ? null
              : (options.countOverrides?.[relation] ?? relationRows.length) +
                (options.changedCounts?.includes(relation) && from > 0 ? 1 : 0),
            error: options.errors?.[relation]
              ? { message: options.errors[relation]! }
              : null,
          });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, ranges, calls };
}

const rows: SwellWatchAudienceRows = {
  profiles: [
    { id: "home", homeBeachId: "beach-a", notifPushEnabled: true, notifForecastAlerts: true },
    { id: "favorite", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
    { id: "rule", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
    { id: "disabled-push", homeBeachId: "beach-a", notifPushEnabled: false, notifForecastAlerts: true },
    { id: "disabled-forecast", homeBeachId: "beach-a", notifPushEnabled: true, notifForecastAlerts: false },
    { id: "no-device", homeBeachId: "beach-a", notifPushEnabled: true, notifForecastAlerts: true },
    { id: "precedence", homeBeachId: "beach-a", notifPushEnabled: true, notifForecastAlerts: true },
    { id: "favorite-disabled", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
    { id: "rule-disabled", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
    { id: "rule-muted", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
    { id: "custom", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
    { id: "unrelated", homeBeachId: null, notifPushEnabled: true, notifForecastAlerts: true },
  ],
  favorites: [
    { userId: "favorite", beachId: "beach-a", alertsEnabled: true },
    { userId: "disabled-push", beachId: "beach-a", alertsEnabled: true },
    { userId: "favorite-disabled", beachId: "beach-a", alertsEnabled: false },
    { userId: "custom", beachId: null, alertsEnabled: true },
    { userId: "precedence", beachId: "beach-a", alertsEnabled: true },
  ],
  rules: [
    { userId: "rule", beachId: "beach-a", enabled: true, notifyPush: true },
    { userId: "rule-disabled", beachId: "beach-a", enabled: false, notifyPush: true },
    { userId: "rule-muted", beachId: "beach-a", enabled: true, notifyPush: false },
    { userId: "precedence", beachId: "beach-a", enabled: true, notifyPush: true },
  ],
  devices: [
    { userId: "home" },
    { userId: "favorite" },
    { userId: "rule" },
    { userId: "disabled-push" },
    { userId: "disabled-forecast" },
    { userId: "precedence" },
    { userId: "favorite-disabled" },
    { userId: "rule-disabled" },
    { userId: "rule-muted" },
    { userId: "custom" },
    { userId: "unrelated" },
  ],
};

describe("Swell Watch explicit-interest audience", () => {
  it("selects only explicit relationships with both opt-ins and an active device", () => {
    expect(selectSwellWatchAudience(["beach-a", "beach-b"], rows)).toEqual([
      { recipientUserId: "favorite", beachId: "beach-a", reason: "favorite" },
      { recipientUserId: "home", beachId: "beach-a", reason: "home" },
      { recipientUserId: "precedence", beachId: "beach-a", reason: "home" },
      { recipientUserId: "rule", beachId: "beach-a", reason: "rule" },
    ]);
  });

  it("does not add entitlement, trial, TestFlight, experiment, or ramp gates", () => {
    const entitledRows = {
      ...rows,
      profiles: [
        {
          ...rows.profiles[0],
          paid: false,
          trial: false,
          testflight: false,
          experiment: "excluded",
          ramp: 0,
        },
      ],
      devices: [{ userId: "home" }],
      favorites: [],
      rules: [],
    } as unknown as SwellWatchAudienceRows;

    expect(selectSwellWatchAudience(["beach-a"], entitledRows)).toEqual([
      { recipientUserId: "home", beachId: "beach-a", reason: "home" },
    ]);
  });

  it("pages every current-schema relationship read and filters retired devices server-side", async () => {
    const fixture = createSupabaseFixture({
      profiles: [
        { id: "p1", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
        { id: "p2", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
        { id: "p3", home_beach_id: null, notif_push_enabled: true, notif_forecast_alerts: true },
        { id: "retired-only", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
        { id: "custom", home_beach_id: null, notif_push_enabled: true, notif_forecast_alerts: true },
      ],
      favorite_beaches: [
        { user_id: "p2", beach_id: "beach-a", alerts_enabled: true, custom_spot_id: null },
        { user_id: "p3", beach_id: "beach-a", alerts_enabled: true, custom_spot_id: null },
        { user_id: "custom", beach_id: "beach-a", alerts_enabled: true, custom_spot_id: "spot" },
      ],
      alert_rules: [
        { user_id: "p1", beach_id: "beach-a", enabled: true, notify_push: true },
        { user_id: "p3", beach_id: "beach-a", enabled: true, notify_push: true },
      ],
      user_devices: [
        { user_id: "p1", retired_at: null },
        { user_id: "p2", retired_at: null },
        { user_id: "p3", retired_at: null },
        { user_id: "retired-only", retired_at: "2026-09-03T00:00:00.000Z" },
        { user_id: "custom", retired_at: null },
      ],
    });

    await expect(loadSwellWatchAudience(fixture.supabase, ["beach-a"], { pageSize: 1 })).resolves.toEqual([
      { recipientUserId: "p1", beachId: "beach-a", reason: "home" },
      { recipientUserId: "p2", beachId: "beach-a", reason: "home" },
      { recipientUserId: "p3", beachId: "beach-a", reason: "favorite" },
    ]);
    expect(fixture.ranges.profiles).toEqual([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]);
    expect(fixture.ranges.favorite_beaches).toEqual([[0, 0], [1, 1]]);
    expect(fixture.ranges.alert_rules).toEqual([[0, 0], [1, 1]]);
    expect(fixture.ranges.user_devices).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
    expect(fixture.calls).toContainEqual({ relation: "user_devices", method: "is", args: ["retired_at", null] });
    expect(fixture.calls).toContainEqual({ relation: "favorite_beaches", method: "is", args: ["custom_spot_id", null] });
    expect(fixture.calls).toContainEqual({ relation: "profiles", method: "eq", args: ["notif_push_enabled", true] });
    expect(fixture.calls).toContainEqual({ relation: "profiles", method: "eq", args: ["notif_forecast_alerts", true] });
    expect(fixture.calls).toContainEqual({ relation: "favorite_beaches", method: "eq", args: ["alerts_enabled", true] });
    expect(fixture.calls).toContainEqual({ relation: "alert_rules", method: "eq", args: ["enabled", true] });
    expect(fixture.calls).toContainEqual({ relation: "alert_rules", method: "eq", args: ["notify_push", true] });
    expect(fixture.calls).toContainEqual({ relation: "favorite_beaches", method: "in", args: ["beach_id", ["beach-a"]] });
    expect(fixture.calls).toContainEqual({ relation: "alert_rules", method: "in", args: ["beach_id", ["beach-a"]] });
  });

  it("fails closed when a count-backed relation page is incomplete", async () => {
    const fixture = createSupabaseFixture(
      {
        profiles: [
          { id: "p1", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
          { id: "p2", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
        ],
        favorite_beaches: [],
        alert_rules: [],
        user_devices: [{ user_id: "p1" }, { user_id: "p2" }],
      },
      { truncateRelations: ["profiles"] },
    );

    await expect(loadSwellWatchAudience(fixture.supabase, ["beach-a"], { pageSize: 1 })).rejects.toThrow(
      "Incomplete profiles read",
    );
  });

  const completeRows: Record<Relation, Array<Record<string, unknown>>> = {
    profiles: [
      { id: "p1", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
      { id: "p2", home_beach_id: "beach-a", notif_push_enabled: true, notif_forecast_alerts: true },
    ],
    favorite_beaches: [
      { user_id: "p1", beach_id: "beach-a", alerts_enabled: true, custom_spot_id: null },
      { user_id: "p2", beach_id: "beach-a", alerts_enabled: true, custom_spot_id: null },
    ],
    alert_rules: [
      { user_id: "p1", beach_id: "beach-a", enabled: true, notify_push: true },
      { user_id: "p2", beach_id: "beach-a", enabled: true, notify_push: true },
    ],
    user_devices: [
      { user_id: "p1", retired_at: null },
      { user_id: "p2", retired_at: null },
    ],
  };

  it.each<Relation>(["profiles", "favorite_beaches", "alert_rules", "user_devices"])(
    "fails closed when %s returns an error",
    async (relation) => {
      const fixture = createSupabaseFixture(completeRows, { errors: { [relation]: "fixture failure" } });
      await expect(loadSwellWatchAudience(fixture.supabase, ["beach-a"], { pageSize: 1 })).rejects.toThrow(
        `Failed to load ${relation}: fixture failure`,
      );
    },
  );

  it.each<Relation>(["profiles", "favorite_beaches", "alert_rules", "user_devices"])(
    "fails closed when %s omits its exact count",
    async (relation) => {
      const fixture = createSupabaseFixture(completeRows, { missingCounts: [relation] });
      await expect(loadSwellWatchAudience(fixture.supabase, ["beach-a"], { pageSize: 1 })).rejects.toThrow(
        `Incomplete ${relation} read: missing exact count`,
      );
    },
  );

  it.each<Relation>(["profiles", "favorite_beaches", "alert_rules", "user_devices"])(
    "fails closed when %s changes its exact count while paging",
    async (relation) => {
      const fixture = createSupabaseFixture(completeRows, { changedCounts: [relation] });
      await expect(loadSwellWatchAudience(fixture.supabase, ["beach-a"], { pageSize: 1 })).rejects.toThrow(
        `Incomplete ${relation} read: count changed while paging`,
      );
    },
  );

  it("returns only the recipient, beach, and relationship tier allowlist", () => {
    const [member] = selectSwellWatchAudience(["beach-a"], rows);
    expect(Object.keys(member).sort()).toEqual(["beachId", "reason", "recipientUserId"]);
    expect(member).not.toHaveProperty("deviceToken");
    expect(member).not.toHaveProperty("alertsEnabled");
  });
});
