/**
 * @jest-environment node
 */

import { loadDailyCallProfiles } from "@/lib/cron/daily-call-runner";
import {
  SKILL_AWARE_GO_CHECKS_ENABLED_FLAG,
  SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG,
} from "@/lib/flags/skill-aware-go-checks";
import { createTableClient } from "@/__tests__/helpers/table-client";

function profileRow(id: string): Record<string, unknown> {
  return {
    id,
    home_beach_id: null,
    timezone: "America/Los_Angeles",
    daily_call_time: "06:00",
    notif_push_enabled: true,
    notif_forecast_alerts: true,
    experience_level: "beginner",
    max_drive_minutes: 45,
    preferred_session_time: null,
  };
}

const boom = { data: null, error: { message: "boom" } };

describe("loadDailyCallProfiles board classes", () => {
  const enabledBefore = process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];
  const allowlistBefore = process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG];

  function setFlag(allowlist: string | null): void {
    if (allowlist === null) {
      delete process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];
      delete process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG];
      return;
    }
    process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] = "true";
    process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] = allowlist;
  }

  afterEach(() => {
    jest.restoreAllMocks();
    if (enabledBefore === undefined) delete process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG];
    else process.env[SKILL_AWARE_GO_CHECKS_ENABLED_FLAG] = enabledBefore;
    if (allowlistBefore === undefined) delete process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG];
    else process.env[SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG] = allowlistBefore;
  });

  it("adds no key and no boards query with the flag off", async () => {
    setFlag(null);
    const stub = createTableClient({
      rows: { profiles: [profileRow("u1"), profileRow("u2")], user_location_snapshots: [] },
      queue: { boards: [{ data: [{ id: "b1", user_id: "u1", board_type: "longboard" }], error: null }] },
    });

    const profiles = await loadDailyCallProfiles(stub.client);

    expect(Object.keys(profiles[0]).sort()).toEqual([
      "dailyCallTime",
      "experienceLevel",
      "homeBeach",
      "homeBeachId",
      "id",
      "location",
      "maxDriveMinutes",
      "notifForecastAlerts",
      "notifPushEnabled",
      "preferredSessionTime",
      "timezone",
    ]);
    expect(stub.tablesRead).not.toContain("boards");
  });

  it("loads boards in one batch for allowlisted users only", async () => {
    setFlag("u1");
    const stub = createTableClient({
      rows: { profiles: [profileRow("u1"), profileRow("u2")], user_location_snapshots: [] },
      queue: { boards: [{ data: [{ id: "b1", user_id: "u1", board_type: "longboard" }], error: null }] },
    });

    const profiles = await loadDailyCallProfiles(stub.client);
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    expect(byId.get("u1")?.boardClasses).toEqual(["longboard"]);
    expect("boardClasses" in byId.get("u2")!).toBe(false);
    expect(stub.inCallsFor("boards")).toEqual([["u1"]]);
  });

  it("gives an allowlisted user with no board rows an empty list", async () => {
    setFlag("u1,u3");
    const stub = createTableClient({
      rows: {
        profiles: [profileRow("u1"), profileRow("u2"), profileRow("u3")],
        user_location_snapshots: [],
      },
      queue: { boards: [{ data: [{ id: "b1", user_id: "u1", board_type: "longboard" }], error: null }] },
    });

    const profiles = await loadDailyCallProfiles(stub.client);
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    expect(byId.get("u3")?.boardClasses).toEqual([]);
    expect("boardClasses" in byId.get("u2")!).toBe(false);
  });

  it("gives an allowlisted user an empty list when the boards read fails", async () => {
    setFlag("u1");
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const stub = createTableClient({
      rows: { profiles: [profileRow("u1"), profileRow("u2")], user_location_snapshots: [] },
      queue: { boards: [boom] },
    });

    const profiles = await loadDailyCallProfiles(stub.client);

    expect(profiles.find((profile) => profile.id === "u1")?.boardClasses).toEqual([]);
  });
});
