import { buildSurfDropTeaserPayload } from "@/lib/surf-drops/service";
import type { SurfDropRecord } from "@/lib/surf-drops/types";

const baseDrop: SurfDropRecord = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  user_id: "550e8400-e29b-41d4-a716-446655440002",
  share_slug: "ABC23456DE",
  location_type: "custom_pin",
  beach_id: null,
  custom_lat: 32.749,
  custom_lon: -117.253,
  general_area: "North County SD",
  exact_label: "Stairwell by the blue house",
  starts_at: "2026-07-02T14:00:00.000Z",
  ends_at: "2026-07-02T15:00:00.000Z",
  audience: "mutuals",
  note: "bring the fish",
  forecast_snapshot: { wave_height_ft: "3-4", rating: "fun" },
  created_at: "2026-07-02T12:00:00.000Z",
  updated_at: "2026-07-02T12:00:00.000Z",
  cancelled_at: null,
  deleted_at: null,
  beach: null,
  creator: {
    display_name: "Maya",
    full_name: "Maya Rivera",
    avatar_url: "https://example.test/avatar.png",
  },
  participants_count: 2,
};

describe("buildSurfDropTeaserPayload", () => {
  it("does not leak custom-pin coordinates or exact_label to unauthorized viewers", () => {
    const payload = buildSurfDropTeaserPayload(baseDrop, {
      viewerAuthorized: false,
      viewerSignedIn: false,
      now: new Date("2026-07-02T12:30:00.000Z"),
    });

    expect(payload).toMatchObject({
      slug: "ABC23456DE",
      status: "active",
      general_area: "North County SD",
      requires_signin: true,
      requires_claim: true,
      is_known_spot: false,
    });
    expect(JSON.stringify(payload)).not.toContain("32.749");
    expect(JSON.stringify(payload)).not.toContain("-117.253");
    expect(JSON.stringify(payload)).not.toContain("Stairwell");
  });

  it("can include exact custom-pin fields only after the viewer is authorized", () => {
    const payload = buildSurfDropTeaserPayload(baseDrop, {
      viewerAuthorized: true,
      viewerSignedIn: true,
      now: new Date("2026-07-02T12:30:00.000Z"),
    });

    expect(payload).toMatchObject({
      requires_signin: false,
      requires_claim: false,
      custom_pin: {
        lat: 32.749,
        lon: -117.253,
        exact_label: "Stairwell by the blue house",
      },
    });
  });

  it("allows known spot names in safe teaser payloads", () => {
    const payload = buildSurfDropTeaserPayload(
      {
        ...baseDrop,
        location_type: "known_spot",
        beach_id: "550e8400-e29b-41d4-a716-446655440020",
        custom_lat: null,
        custom_lon: null,
        exact_label: null,
        beach: { id: "550e8400-e29b-41d4-a716-446655440020", name: "Ocean Beach", lat: 32.75, lon: -117.25 },
      },
      {
        viewerAuthorized: false,
        viewerSignedIn: false,
        now: new Date("2026-07-02T12:30:00.000Z"),
      },
    );

    expect(payload).toMatchObject({
      is_known_spot: true,
      spot_name: "Ocean Beach",
    });
  });

  it("keeps expired and cancelled custom-pin payloads safe", () => {
    const expired = buildSurfDropTeaserPayload(baseDrop, {
      viewerAuthorized: false,
      viewerSignedIn: true,
      now: new Date("2026-07-02T16:00:00.000Z"),
    });
    const cancelled = buildSurfDropTeaserPayload(
      { ...baseDrop, cancelled_at: "2026-07-02T12:15:00.000Z" },
      {
        viewerAuthorized: false,
        viewerSignedIn: true,
        now: new Date("2026-07-02T12:30:00.000Z"),
      },
    );

    expect(expired.status).toBe("expired");
    expect(cancelled.status).toBe("cancelled");
    expect(JSON.stringify(expired)).not.toContain("Stairwell");
    expect(JSON.stringify(cancelled)).not.toContain("32.749");
  });
});
