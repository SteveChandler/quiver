import type { SupabaseClient } from "@supabase/supabase-js";
import { findAttachTarget } from "@/lib/sessions/imports/find-attach-target";
import {
  loadImportBeach,
  resolveImportBeach,
  type ImportBeach,
} from "@/lib/sessions/imports/resolve-import-beach";

const beach: ImportBeach = {
  id: "beach-1",
  name: "North Beach",
  lat: 32.8,
  lon: -117.2,
  swellWindowCenterDeg: 270,
};

function mockBeachClient(rpcRows: unknown[], beachRows: unknown[]) {
  const inQuery = jest.fn().mockResolvedValue({ data: beachRows, error: null });
  const maybeSingle = jest.fn().mockResolvedValue({ data: beachRows[0] ?? null, error: null });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ in: inQuery, eq });
  const from = jest.fn().mockReturnValue({ select });
  const rpc = jest.fn().mockResolvedValue({ data: rpcRows, error: null });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, select, inQuery, eq };
}

function mockAttachClient(sessions: unknown[], track: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: track, error: null });
  const trackEq = jest.fn().mockReturnValue({ maybeSingle });
  const trackSelect = jest.fn().mockReturnValue({ eq: trackEq });
  const lte = jest.fn().mockResolvedValue({ data: sessions, error: null });
  const gte = jest.fn().mockReturnValue({ lte });
  const is = jest.fn().mockReturnValue({ gte });
  const sessionEq = jest.fn().mockReturnValue({ is });
  const sessionSelect = jest.fn().mockReturnValue({ eq: sessionEq });
  const from = jest.fn((table: string) => table === "sessions"
    ? { select: sessionSelect }
    : { select: trackSelect });
  return {
    client: { from } as unknown as SupabaseClient,
    from, sessionSelect, sessionEq, is, gte, lte, trackEq, maybeSingle,
  };
}

const start = "2026-10-17T12:00:00.000Z";
const end = "2026-10-17T13:00:00.000Z";

function session(id: string, arrivalTime: string, beachId: string, lat: number, lon: number, deletedAt: string | null = null) {
  return {
    id,
    source: "manual",
    arrival_time: arrivalTime,
    duration_minutes: 30,
    beach_id: beachId,
    custom_spot_id: null,
    deleted_at: deletedAt,
    beaches: { lat, lon },
    custom_spots: null,
  };
}

describe("resolveImportBeach", () => {
  it("uses the first nearby row and loads its swell window", async () => {
    const first = { id: beach.id, name: beach.name, lat: beach.lat, lon: beach.lon, distance_meters: 100 };
    const second = { id: "beach-2", name: "South Beach", lat: 32.81, lon: -117.2, distance_meters: 800 };
    const mock = mockBeachClient([first, second], [
      { id: beach.id, swell_window_center_deg: 270 },
      { id: second.id, swell_window_center_deg: null },
    ]);

    await expect(resolveImportBeach(mock.client, { lat: 32.8, lon: -117.2 })).resolves.toEqual({
      status: "resolved",
      beach,
    });
    expect(mock.rpc).toHaveBeenCalledWith("get_nearby_beaches", {
      input_lat: 32.8,
      input_lng: -117.2,
      max_distance_meters: 3000,
      limit_count: 3,
    });
    expect(mock.from).toHaveBeenCalledWith("beaches");
    expect(mock.inQuery).toHaveBeenCalledWith("id", [beach.id, second.id]);
  });

  it("returns needs_beach without querying beaches when the RPC finds none", async () => {
    const mock = mockBeachClient([], []);

    await expect(resolveImportBeach(mock.client, { lat: 32.8, lon: -117.2 })).resolves.toEqual({
      status: "needs_beach",
      candidates: [],
    });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("surfaces an RPC failure instead of treating it as no nearby beach", async () => {
    const mock = mockBeachClient([], []);
    mock.rpc.mockResolvedValue({ data: null, error: { message: "RPC unavailable" } });

    await expect(resolveImportBeach(mock.client, { lat: 32.8, lon: -117.2 }))
      .rejects.toEqual({ message: "RPC unavailable" });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("loads a manually selected beach", async () => {
    const mock = mockBeachClient([], [{
      id: beach.id, name: beach.name, lat: beach.lat, lon: beach.lon,
      swell_window_center_deg: beach.swellWindowCenterDeg,
    }]);

    await expect(loadImportBeach(mock.client, beach.id)).resolves.toEqual(beach);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.eq).toHaveBeenCalledWith("id", beach.id);
  });

  it("returns null when a manually selected beach does not exist", async () => {
    const mock = mockBeachClient([], []);

    await expect(loadImportBeach(mock.client, "missing")).resolves.toBeNull();
  });
});

describe("findAttachTarget", () => {
  it("chooses the closest start among same and nearby beaches and reports its track", async () => {
    const mock = mockAttachClient([
      session("same", "2026-10-17T11:40:00.000Z", beach.id, beach.lat, beach.lon),
      session("near", "2026-10-17T12:05:00.000Z", "beach-2", 32.81, -117.2),
      session("far", "2026-10-17T12:01:00.000Z", "beach-3", 33.0, -117.2),
    ], { session_id: "near", import_id: "import-1" });

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves.toEqual({
      sessionId: "near",
      hasTrack: true,
      trackImportId: "import-1",
      source: "manual",
    });
    expect(mock.sessionEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mock.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mock.gte).toHaveBeenCalledWith("arrival_time", "2026-10-17T10:30:00.000Z");
    expect(mock.lte).toHaveBeenCalledWith("arrival_time", "2026-10-17T14:30:00.000Z");
    expect(mock.sessionSelect).toHaveBeenCalledWith(expect.stringContaining("beaches!sessions_beach_id_fkey(lat, lon)"));
    expect(mock.trackEq).toHaveBeenCalledWith("session_id", "near");
    expect(mock.from).toHaveBeenCalledWith("session_tracks");
    expect(mock.from).toHaveBeenCalledTimes(2);
  });

  it("ignores deleted sessions and reports an untracked match", async () => {
    const mock = mockAttachClient([
      session("deleted", start, beach.id, beach.lat, beach.lon, "2026-10-17T13:00:00.000Z"),
      session("live", "2026-10-17T12:10:00.000Z", beach.id, beach.lat, beach.lon),
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves.toEqual({
      sessionId: "live",
      hasTrack: false,
      trackImportId: null,
      source: "manual",
    });
    expect(mock.trackEq).toHaveBeenCalledWith("session_id", "live");
  });

  it("returns null without a track lookup when no session is near enough", async () => {
    const mock = mockAttachClient([
      session("far", start, "beach-3", 33.0, -117.2),
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves.toBeNull();
    expect(mock.from).toHaveBeenCalledTimes(1);
  });

  it("matches a phone log saved after the surf ended", async () => {
    const mock = mockAttachClient([
      { ...session("after", "2026-10-17T13:45:00.000Z", beach.id, beach.lat, beach.lon), created_at: "2026-10-17T13:46:00.000Z" },
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves
      .toMatchObject({ sessionId: "after" });
    expect(mock.gte).toHaveBeenCalledWith("arrival_time", "2026-10-17T10:30:00.000Z");
    expect(mock.lte).toHaveBeenCalledWith("arrival_time", "2026-10-17T14:30:00.000Z");
  });

  it("keeps an old-build arrival saved hours later within 90 minutes of the watch start", async () => {
    const mock = mockAttachClient([
      { ...session("old-build", "2026-10-17T13:45:00.000Z", beach.id, beach.lat, beach.lon),
        created_at: "2026-10-17T16:00:00.000Z", timing_user_set: false },
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves.toBeNull();
    expect(mock.sessionSelect).toHaveBeenCalledWith(expect.stringContaining("created_at"));
  });

  it("keeps a user-set time within 90 minutes of the watch start", async () => {
    const mock = mockAttachClient([
      { ...session("user-set", "2026-10-17T13:45:00.000Z", beach.id, beach.lat, beach.lon),
        created_at: "2026-10-17T13:45:00.000Z", timing_user_set: true },
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves.toBeNull();
    expect(mock.sessionSelect).toHaveBeenCalledWith(expect.stringContaining("timing_user_set"));
  });

  it("prefers a session whose span overlaps the watch over a closer start that does not", async () => {
    const mock = mockAttachClient([
      session("before", "2026-10-17T11:20:00.000Z", beach.id, beach.lat, beach.lon),
      session("overlap", "2026-10-17T12:50:00.000Z", beach.id, beach.lat, beach.lon),
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves
      .toMatchObject({ sessionId: "overlap" });
  });

  it("treats a zero duration as 60 minutes when checking overlap", async () => {
    const mock = mockAttachClient([
      { ...session("zero", "2026-10-17T11:10:00.000Z", beach.id, beach.lat, beach.lon), duration_minutes: 0 },
      session("later", "2026-10-17T12:55:00.000Z", beach.id, beach.lat, beach.lon),
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves
      .toMatchObject({ sessionId: "zero" });
  });

  it("never attaches to a conditions report", async () => {
    const mock = mockAttachClient([
      { ...session("report", start, beach.id, beach.lat, beach.lon), source: "conditions_report" },
    ]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves.toBeNull();
    expect(mock.from).toHaveBeenCalledTimes(1);
  });

  it("matches a custom-spot session by the spot's location", async () => {
    const custom = (id: string, lat: number) => ({
      ...session(id, start, "unused", 0, 0), beach_id: null, beaches: null,
      custom_spot_id: `spot-${id}`, custom_spots: { lat: String(lat), lon: "-117.2" },
    });
    const mock = mockAttachClient([custom("far", 33.0), custom("near", 32.81)]);

    await expect(findAttachTarget(mock.client, "user-1", beach, start, end)).resolves
      .toMatchObject({ sessionId: "near" });
    expect(mock.sessionSelect).toHaveBeenCalledWith(
      expect.stringContaining("custom_spots!sessions_custom_spot_id_fkey(lat, lon)"));
  });
});
