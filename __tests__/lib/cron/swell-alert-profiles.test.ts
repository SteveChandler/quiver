/**
 * @jest-environment node
 */

import { loadSwellAlertProfiles } from "@/lib/cron/swell-alert-runner";
import {
  SKILL_AWARE_GO_CHECKS_ENABLED_FLAG,
  SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST_FLAG,
} from "@/lib/flags/skill-aware-go-checks";
import { createTableClient } from "@/__tests__/helpers/table-client";

const NOW = new Date("2026-09-18T00:00:00.000Z");

function profileRow(id: string): Record<string, unknown> {
  return {
    id,
    timezone: "America/Los_Angeles",
    home_beach_id: null,
    max_drive_minutes: 45,
    experience_level: "beginner",
    preferred_session_time: null,
    notif_push_enabled: true,
    notif_swell_alerts: true,
    notif_forecast_alerts: false,
    user_location_snapshots: [],
    home_beach: null,
  };
}

const boom = { data: null, error: { message: "boom" } };

describe("loadSwellAlertProfiles board classes", () => {
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

  it("loads boards only for allowlisted users", async () => {
    setFlag("p1");
    const stub = createTableClient({
      rows: { profiles: [profileRow("p1"), profileRow("p2")] },
      queue: { boards: [{ data: [{ id: "b1", user_id: "p1", board_type: "softboard" }], error: null }] },
    });

    const profiles = await loadSwellAlertProfiles(stub.client, NOW);
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    expect(byId.get("p1")?.boardClasses).toEqual(["foamie"]);
    expect(byId.get("p2")).not.toHaveProperty("boardClasses");
    expect(stub.inCallsFor("boards")).toEqual([["p1"]]);
  });

  it("adds no key and no boards query with the flag off", async () => {
    setFlag(null);
    const stub = createTableClient({
      rows: { profiles: [profileRow("p1"), profileRow("p2")] },
      queue: { boards: [{ data: [{ id: "b1", user_id: "p1", board_type: "softboard" }], error: null }] },
    });

    const profiles = await loadSwellAlertProfiles(stub.client, NOW);

    expect(profiles).toHaveLength(2);
    for (const profile of profiles) {
      expect(Object.keys(profile).sort()).toEqual([
        "anchorSource",
        "awayFromHome",
        "experienceLevel",
        "homeBeachId",
        "id",
        "location",
        "maxDriveMinutes",
        "notifForecastAlerts",
        "notifPushEnabled",
        "notifSwellAlerts",
        "preferredSessionTime",
        "timezone",
      ]);
    }
    expect(stub.tablesRead).not.toContain("boards");
  });

  it("gives an allowlisted user with no board rows, or a failed boards read, an empty list", async () => {
    setFlag("p1,p3");
    const noRows = createTableClient({
      rows: { profiles: [profileRow("p1"), profileRow("p2"), profileRow("p3")] },
      queue: { boards: [{ data: [{ id: "b1", user_id: "p1", board_type: "softboard" }], error: null }] },
    });

    const loaded = new Map((await loadSwellAlertProfiles(noRows.client, NOW)).map((profile) => [profile.id, profile]));

    expect(loaded.get("p3")?.boardClasses).toEqual([]);
    expect(loaded.get("p2")).not.toHaveProperty("boardClasses");

    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const failed = createTableClient({
      rows: { profiles: [profileRow("p1"), profileRow("p2")] },
      queue: { boards: [boom] },
    });

    const afterFailure = await loadSwellAlertProfiles(failed.client, NOW);

    expect(afterFailure.find((profile) => profile.id === "p1")?.boardClasses).toEqual([]);
  });
});
