import {
  SurfDropServiceError,
  claimSurfDropLink,
  computeQrVenueScanUpdate,
  filterRowsByBbox,
  joinSurfDrop,
} from "@/lib/surf-drops/service";
import type {
  Bbox,
  QrBusinessVenueRecord,
  SurfDropRecord,
  SurfDropsRepository,
} from "@/lib/surf-drops/types";

const now = new Date("2026-07-02T12:00:00.000Z");

function activeDrop(overrides: Partial<SurfDropRecord> = {}): SurfDropRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    user_id: "550e8400-e29b-41d4-a716-446655440002",
    share_slug: "ABC23456DE",
    location_type: "known_spot",
    beach_id: "550e8400-e29b-41d4-a716-446655440003",
    custom_lat: null,
    custom_lon: null,
    general_area: "San Diego",
    exact_label: null,
    starts_at: "2026-07-02T13:00:00.000Z",
    ends_at: "2026-07-02T14:00:00.000Z",
    audience: "mutuals",
    note: null,
    forecast_snapshot: null,
    created_at: "2026-07-02T11:00:00.000Z",
    updated_at: "2026-07-02T11:00:00.000Z",
    cancelled_at: null,
    deleted_at: null,
    beach: { id: "550e8400-e29b-41d4-a716-446655440003", name: "Ocean Beach", lat: 32.75, lon: -117.25 },
    creator: { display_name: "Maya", full_name: null, avatar_url: null },
    participants_count: 0,
    ...overrides,
  };
}

function createRepository(overrides: Partial<SurfDropsRepository> = {}): SurfDropsRepository {
  return {
    findDropById: jest.fn(async () => activeDrop()),
    findDropByShareSlug: jest.fn(async () => activeDrop()),
    upsertLinkGrant: jest.fn(async () => undefined),
    upsertParticipant: jest.fn(async () => undefined),
    countActiveParticipants: jest.fn(async () => 1),
    ...overrides,
  };
}

describe("claimSurfDropLink", () => {
  it("persists a link grant for an active drop and returns the drop id", async () => {
    const repository = createRepository();

    const result = await claimSurfDropLink(repository, {
      shareSlug: "ABC23456DE",
      userId: "550e8400-e29b-41d4-a716-446655440099",
      now,
    });

    expect(result).toEqual({ drop_id: "550e8400-e29b-41d4-a716-446655440001" });
    expect(repository.upsertLinkGrant).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440099",
    );
  });

  it("rejects expired or cancelled drops without creating a grant", async () => {
    const repository = createRepository({
      findDropByShareSlug: jest.fn(async () =>
        activeDrop({ ends_at: "2026-07-02T11:59:59.000Z" }),
      ),
    });

    await expect(
      claimSurfDropLink(repository, {
        shareSlug: "ABC23456DE",
        userId: "550e8400-e29b-41d4-a716-446655440099",
        now,
      }),
    ).rejects.toMatchObject(new SurfDropServiceError(410, "Surf Drop has expired"));
    expect(repository.upsertLinkGrant).not.toHaveBeenCalled();
  });

  it("rejects blocked viewer/creator pairs before creating a grant", async () => {
    const repository = createRepository({
      hasBlockBetween: jest.fn(async () => true),
    });

    await expect(
      claimSurfDropLink(repository, {
        shareSlug: "ABC23456DE",
        userId: "550e8400-e29b-41d4-a716-446655440099",
        now,
      }),
    ).rejects.toMatchObject(new SurfDropServiceError(403, "Surf Drop is not available"));
    expect(repository.upsertLinkGrant).not.toHaveBeenCalled();
  });
});

describe("joinSurfDrop", () => {
  it("adds an active participant and returns the active participant count", async () => {
    const repository = createRepository({
      countActiveParticipants: jest.fn(async () => 3),
    });

    const result = await joinSurfDrop(repository, {
      dropId: "550e8400-e29b-41d4-a716-446655440001",
      userId: "550e8400-e29b-41d4-a716-446655440099",
      now,
    });

    expect(result).toEqual({ ok: true, participants_count: 3 });
    expect(repository.upsertParticipant).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440099",
      "2026-07-02T12:00:00.000Z",
    );
  });

  it("blocks joins after expiration or cancellation", async () => {
    const repository = createRepository({
      findDropById: jest.fn(async () =>
        activeDrop({ cancelled_at: "2026-07-02T11:30:00.000Z" }),
      ),
    });

    await expect(
      joinSurfDrop(repository, {
        dropId: "550e8400-e29b-41d4-a716-446655440001",
        userId: "550e8400-e29b-41d4-a716-446655440099",
        now,
      }),
    ).rejects.toMatchObject(new SurfDropServiceError(410, "Surf Drop is cancelled"));
    expect(repository.upsertParticipant).not.toHaveBeenCalled();
  });
});

describe("filterRowsByBbox", () => {
  const bbox: Bbox = { minLon: -118, minLat: 32, maxLon: -117, maxLat: 33 };

  it("filters mixed custom-pin and known-spot rows by lon/lat bounds", () => {
    const rows = [
      activeDrop(),
      activeDrop({
        id: "550e8400-e29b-41d4-a716-446655440010",
        location_type: "custom_pin",
        beach_id: null,
        beach: null,
        custom_lat: 34,
        custom_lon: -117.5,
      }),
    ];

    expect(filterRowsByBbox(rows, bbox).map((row) => row.id)).toEqual([
      "550e8400-e29b-41d4-a716-446655440001",
    ]);
  });
});

describe("computeQrVenueScanUpdate", () => {
  it("activates a venue when scan count reaches the row threshold", () => {
    const venue: QrBusinessVenueRecord = {
      id: "550e8400-e29b-41d4-a716-446655440050",
      name: "Pacific Surf Co",
      lat: 32.75,
      lon: -117.25,
      qr_scan_count: 2,
      activation_threshold: 3,
      claimed_user_id: null,
      activated_at: null,
      admin_visible: false,
      created_at: "2026-07-02T10:00:00.000Z",
    };

    expect(computeQrVenueScanUpdate(venue, now)).toEqual({
      qr_scan_count: 3,
      activated_at: "2026-07-02T12:00:00.000Z",
    });
  });

  it("keeps activated_at unchanged for already-active venues", () => {
    const venue: QrBusinessVenueRecord = {
      id: "550e8400-e29b-41d4-a716-446655440050",
      name: "Pacific Surf Co",
      lat: 32.75,
      lon: -117.25,
      qr_scan_count: 10,
      activation_threshold: 3,
      claimed_user_id: null,
      activated_at: "2026-07-01T12:00:00.000Z",
      admin_visible: false,
      created_at: "2026-07-02T10:00:00.000Z",
    };

    expect(computeQrVenueScanUpdate(venue, now)).toEqual({
      qr_scan_count: 11,
      activated_at: "2026-07-01T12:00:00.000Z",
    });
  });
});
