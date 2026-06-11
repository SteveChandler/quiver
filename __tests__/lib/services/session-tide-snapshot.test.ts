import {
  fetchSessionTideSnapshot,
  formatSessionTideSnapshot,
} from "@/lib/services/session-tide-snapshot";

describe("session-tide-snapshot", () => {
  it("normalizes the tide snapshot RPC row", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          tide_height_ft: "3.24",
          tide_status: "rising",
          tide_rate_ft_per_hr: "0.82",
          tide_data_source: "noaa",
        },
      ],
      error: null,
    });

    const snapshot = await fetchSessionTideSnapshot(
      { rpc },
      "beach-1",
      "2026-06-10T15:00:00.000Z"
    );

    expect(rpc).toHaveBeenCalledWith("compute_session_tide_snapshot", {
      p_beach_id: "beach-1",
      p_arrival_time: "2026-06-10T15:00:00.000Z",
    });
    expect(snapshot).toEqual({
      tideHeightFt: 3.24,
      tideStatus: "rising",
      tideRateFtPerHr: 0.82,
      source: "noaa",
    });
  });

  it("returns null when the RPC has no cached tide row", async () => {
    const snapshot = await fetchSessionTideSnapshot(
      { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) },
      "beach-1",
      "2026-06-10T15:00:00.000Z"
    );

    expect(snapshot).toBeNull();
  });

  it("throws when the RPC fails", async () => {
    await expect(
      fetchSessionTideSnapshot(
        {
          rpc: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "permission denied" },
          }),
        },
        "beach-1",
        "2026-06-10T15:00:00.000Z"
      )
    ).rejects.toThrow("permission denied");
  });

  it("formats the cross-app tide display string", () => {
    expect(
      formatSessionTideSnapshot({
        tideHeightFt: 3.24,
        tideStatus: "rising",
        tideRateFtPerHr: 0.82,
      })
    ).toBe("3.2 ft · rising · 0.8 ft/hr");
  });
});
