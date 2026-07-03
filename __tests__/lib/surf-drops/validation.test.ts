import {
  normalizeCreateSurfDropInput,
  parseBboxParam,
} from "@/lib/surf-drops/validation";

describe("Surf Drop input validation", () => {
  const now = new Date("2026-07-02T12:00:00.000Z");

  it("defaults audience to mutuals and ends_at to exactly one hour after starts_at", () => {
    const input = normalizeCreateSurfDropInput(
      {
        location_type: "known_spot",
        beach_id: "550e8400-e29b-41d4-a716-446655440010",
        starts_at: "2026-07-02T13:00:00.000Z",
      },
      now,
    );

    expect(input).toMatchObject({
      audience: "mutuals",
      ends_at: "2026-07-02T14:00:00.000Z",
      user_id: undefined,
    });
  });

  it("rejects invalid time windows and schedules more than four days ahead", () => {
    expect(() =>
      normalizeCreateSurfDropInput(
        {
          location_type: "known_spot",
          beach_id: "550e8400-e29b-41d4-a716-446655440010",
          starts_at: "2026-07-02T13:00:00.000Z",
          ends_at: "2026-07-02T13:00:00.000Z",
        },
        now,
      ),
    ).toThrow("ends_at must be after starts_at");

    expect(() =>
      normalizeCreateSurfDropInput(
        {
          location_type: "known_spot",
          beach_id: "550e8400-e29b-41d4-a716-446655440010",
          starts_at: "2026-07-07T12:00:01.000Z",
        },
        now,
      ),
    ).toThrow("starts_at cannot be more than 4 days ahead");
  });

  it("rejects short durations, overlong notes, and mismatched location payloads", () => {
    expect(() =>
      normalizeCreateSurfDropInput(
        {
          location_type: "custom_pin",
          custom_lat: 32.75,
          custom_lon: -117.25,
          starts_at: "2026-07-02T13:00:00.000Z",
          ends_at: "2026-07-02T13:10:00.000Z",
        },
        now,
      ),
    ).toThrow("Surf Drops must last at least 15 minutes");

    expect(() =>
      normalizeCreateSurfDropInput(
        {
          location_type: "known_spot",
          beach_id: "550e8400-e29b-41d4-a716-446655440010",
          starts_at: "2026-07-02T13:00:00.000Z",
          note: "x".repeat(241),
        },
        now,
      ),
    ).toThrow("note cannot exceed 240 characters");

    expect(() =>
      normalizeCreateSurfDropInput(
        {
          location_type: "custom_pin",
          custom_lat: 95,
          custom_lon: -117.25,
          starts_at: "2026-07-02T13:00:00.000Z",
        },
        now,
      ),
    ).toThrow("custom_lat must be between -90 and 90");

    expect(() =>
      normalizeCreateSurfDropInput(
        {
          location_type: "known_spot",
          starts_at: "2026-07-02T13:00:00.000Z",
        },
        now,
      ),
    ).toThrow("beach_id is required for known_spot drops");
  });
});

describe("parseBboxParam", () => {
  it("parses lon1,lat1,lon2,lat2 into min/max bounds", () => {
    expect(parseBboxParam("-118.5,32.5,-117.1,33.3")).toEqual({
      minLon: -118.5,
      minLat: 32.5,
      maxLon: -117.1,
      maxLat: 33.3,
    });
  });

  it("rejects malformed and out-of-range bboxes", () => {
    expect(() => parseBboxParam("-118,32,-117")).toThrow("bbox must contain four comma-separated numbers");
    expect(() => parseBboxParam("-118,95,-117,96")).toThrow("bbox latitude is out of range");
    expect(() => parseBboxParam("-117,32,-118,33")).toThrow("bbox minimums must be less than maximums");
  });
});
