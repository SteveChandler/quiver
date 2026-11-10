/**
 * @jest-environment node
 */

jest.mock("@/lib/alerts/surf-window/tide-aware-window", () => ({ findTideAwareWindow: jest.fn(() => ({})) }));
jest.mock("@/lib/cron/daily-call-runner", () => ({
  ...jest.requireActual("@/lib/cron/daily-call-runner"),
  loadTideSamples: jest.fn(async () => null),
}));

import snapshot from "@/__tests__/fixtures/grandview-crossing-swells-20260911.json";
import { createTableClient } from "@/__tests__/helpers/table-client";
import { findTideAwareWindow } from "@/lib/alerts/surf-window/tide-aware-window";
import { TideCache } from "@/lib/services/noaa-coops/tide-cache";
import { loadSurfWindow, type SwellAlertProfile } from "@/lib/cron/swell-alert-runner";
import type { Beach } from "@/types/database";

const NOW = new Date("2026-09-18T00:00:00.000Z");
const beachRow = {
  ...(snapshot.beach as unknown as Beach),
  short_name: null,
  slug: "grandview",
  state: "CA",
  nws_forecast_zone: null,
} as Beach;
const event = {
  beachId: beachRow.id,
  arrivalAt: null,
  peakAt: "2026-09-18T18:00:00.000Z",
  fadeAt: null,
};
const profile: SwellAlertProfile = {
  id: "73040cff-afe9-4fa0-a874-2016203fc015",
  timezone: "America/Los_Angeles",
  homeBeachId: beachRow.id,
  location: null,
  maxDriveMinutes: null,
  experienceLevel: null,
  notifPushEnabled: true,
  notifSwellAlerts: true,
  notifForecastAlerts: false,
};

async function shapeArgs(user: SwellAlertProfile): Promise<Record<string, unknown>> {
  jest.mocked(findTideAwareWindow).mockClear();
  const stub = createTableClient({ rows: { beaches: [beachRow], enhanced_forecasts: [] } });
  await loadSurfWindow(stub.client, new TideCache(), user, event, NOW);
  // precondition: the loader reached the tide-aware window
  expect(findTideAwareWindow).toHaveBeenCalledTimes(1);
  return jest.mocked(findTideAwareWindow).mock.calls[0][0] as unknown as Record<string, unknown>;
}

describe("loadSurfWindow", () => {
  it("shapes the tide-aware window with the rating skill and boards only on the go-check path (:1457)", async () => {
    const off = await shapeArgs(profile);
    expect(off.skillLevel).toBeNull();
    expect(off).not.toHaveProperty("boardClasses");

    const on = await shapeArgs({ ...profile, boardClasses: ["longboard"] });
    expect(on.skillLevel).toBe("beginner");
    expect(on.boardClasses).toEqual(["longboard"]);
  });
});
