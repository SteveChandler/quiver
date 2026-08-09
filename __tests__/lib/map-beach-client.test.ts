import {
  getBeaches,
  getNearbyBeaches,
} from "@/lib/map-beach-client";

const beach = {
  id: "mission-beach",
  name: "Mission Beach",
  lat: 32.7702,
  lon: -117.2525,
};

describe("map beach client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads the cached beach catalog API envelope", async () => {
    jest.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        data: { beaches: [beach] },
      }), { status: 200 }),
    );

    await expect(getBeaches()).resolves.toEqual({
      success: true,
      data: [beach],
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/beaches", {
      headers: { Accept: "application/json" },
    });
  });

  it("sends a bounded nearby-beach API request", async () => {
    jest.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [beach] }), {
        status: 200,
      }),
    );

    await expect(getNearbyBeaches(32.7, -117.2, 30)).resolves.toEqual({
      success: true,
      data: [beach],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/beaches/nearby?lat=32.7&lon=-117.2&maxDistance=30&limit=50",
      { headers: { Accept: "application/json" } },
    );
  });

  it("returns a stable error instead of throwing on a failed request", async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error("offline"));

    await expect(getBeaches()).resolves.toEqual({
      success: false,
      error: "offline",
    });
  });

  it("passes cancellation through the nearby request", async () => {
    const abortController = new AbortController();
    jest.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
      }),
    );

    await getNearbyBeaches(32.7, -117.2, 30, abortController.signal);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/beaches/nearby?lat=32.7&lon=-117.2&maxDistance=30&limit=50",
      {
        headers: { Accept: "application/json" },
        signal: abortController.signal,
      },
    );
  });
});
