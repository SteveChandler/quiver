import {
  GARMIN_BEACH_CUTOFF_METERS,
  buildSkeleton,
  decideTier,
  normalizeGarminActivityComparison,
  resolveBeach,
  type GarminNormalizedActivity,
} from "@/lib/garmin/activity-session-mapper";

const baseActivity: GarminNormalizedActivity = {
  activityId: "garmin-activity-1",
  activityType: "running",
  startTime: "2026-07-03T15:04:05.678Z",
  durationSeconds: 3600,
};

function activity(
  overrides: Partial<GarminNormalizedActivity>,
): GarminNormalizedActivity {
  return {
    ...baseActivity,
    ...overrides,
  };
}

describe("decideTier", () => {
  it("maps surfing activities to silent capture", () => {
    expect(
      decideTier(activity({ activityType: "surfing" }), []),
    ).toBe("silent");
  });

  it("maps designated Open Water Swim activities to confirmation", () => {
    expect(
      decideTier(activity({ activityType: "OPEN_WATER_SWIMMING" }), [
        "open_water_swimming",
      ]),
    ).toBe("confirm");
  });

  it("matches a custom designation against activityName when present", () => {
    expect(
      decideTier(
        activity({
          activityType: "other",
          activityName: "Dawn Surf",
        }),
        ["dawn surf"],
      ),
    ).toBe("confirm");
  });

  it("ignores unlisted activities", () => {
    expect(
      decideTier(activity({ activityType: "cycling" }), [
        "open_water_swimming",
      ]),
    ).toBe("ignore");
  });

  it("compares tiers case-insensitively", () => {
    expect(
      decideTier(activity({ activityType: "SuRfInG" }), []),
    ).toBe("silent");
    expect(
      decideTier(activity({ activityType: "open_water_swimming" }), [
        "OPEN_WATER_SWIMMING",
      ]),
    ).toBe("confirm");
    expect(normalizeGarminActivityComparison(" Surfing ")).toBe("surfing");
  });
});

describe("buildSkeleton", () => {
  it("preserves exact startTime and maps only skeleton fields", () => {
    const skeleton = buildSkeleton(baseActivity, "beach-1");

    expect(skeleton).toEqual({
      startedAt: "2026-07-03T15:04:05.678Z",
      durationSeconds: 3600,
      beachId: "beach-1",
      garminActivityId: "garmin-activity-1",
    });
  });
});

describe("resolveBeach", () => {
  it("returns the nearest beach within the cutoff", () => {
    expect(
      resolveBeach([
        { id: "beach-farther", distance_meters: 9000 },
        { id: "beach-nearest", distance_meters: 1200 },
      ]),
    ).toEqual({ id: "beach-nearest", distance_meters: 1200 });
  });

  it("includes a beach exactly at the cutoff", () => {
    expect(
      resolveBeach([
        { id: "beach-at-cutoff", distance_meters: GARMIN_BEACH_CUTOFF_METERS },
      ]),
    ).toEqual({
      id: "beach-at-cutoff",
      distance_meters: GARMIN_BEACH_CUTOFF_METERS,
    });
  });

  it("returns null when the nearest beach is beyond the cutoff", () => {
    expect(
      resolveBeach([
        {
          id: "beach-beyond-cutoff",
          distance_meters: GARMIN_BEACH_CUTOFF_METERS + 1,
        },
      ]),
    ).toBeNull();
  });

  it("returns null when no GPS lookup produced nearby beaches", () => {
    expect(resolveBeach([])).toBeNull();
  });
});
