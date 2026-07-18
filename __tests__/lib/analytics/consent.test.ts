import {
  buildAnalyticsConsentProfileUpdate,
  getOwnAnalyticsTrackingAllowed,
} from "@/lib/analytics/consent";

describe("getOwnAnalyticsTrackingAllowed", () => {
  it("reads consent only through the owner-scoped RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });

    await expect(
      getOwnAnalyticsTrackingAllowed({ rpc } as any, "user-123"),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "get_my_analytics_tracking_allowed",
      { p_expected_user_id: "user-123" },
    );
  });

  it("fails closed when the RPC does not affirm consent", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });

    await expect(
      getOwnAnalyticsTrackingAllowed({ rpc } as any, "user-123"),
    ).resolves.toBe(false);
  });

  it("surfaces RPC failures to callers", async () => {
    const error = { message: "unavailable" };
    const rpc = jest.fn().mockResolvedValue({ data: null, error });

    await expect(
      getOwnAnalyticsTrackingAllowed({ rpc } as any, "user-123"),
    ).rejects.toBe(error);
  });

  it("does not overwrite consent when the owner preference failed to load", () => {
    expect(buildAnalyticsConsentProfileUpdate(false, false)).toEqual({});
    expect(buildAnalyticsConsentProfileUpdate(false, true)).toEqual({});
    expect(buildAnalyticsConsentProfileUpdate(true, false)).toEqual({
      allow_implicit_tracking: false,
    });
  });
});
