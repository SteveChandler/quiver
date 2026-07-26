import {
  normalizedEmailSha256,
  resolveCanonicalAndroidWaitlist,
} from "@/lib/android-tester-roster/waitlist";

describe("canonical Android waitlist client", () => {
  it("normalizes email before SHA-256 hashing", () => {
    expect(normalizedEmailSha256("  SURFER@Example.COM ")).toBe(
      normalizedEmailSha256("surfer@example.com"),
    );
    expect(normalizedEmailSha256("surfer@example.com")).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("calls the service-role resolver with exact source identifiers", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: "10000000-0000-4000-8000-000000000001",
      error: null,
    });

    await expect(
      resolveCanonicalAndroidWaitlist(
        { rpc },
        {
          userId: "20000000-0000-4000-8000-000000000002",
          email: "surfer@example.com",
          rosterEntryId: null,
          sourceKind: "profile_intent",
          sourceId: "20000000-0000-4000-8000-000000000002",
          source: "features-hero-android-waitlist",
          surface: "features-page",
          placement: "hero_secondary",
          observedAt: "2026-07-26T12:00:00.000Z",
        },
      ),
    ).resolves.toBe("10000000-0000-4000-8000-000000000001");

    expect(rpc).toHaveBeenCalledWith("resolve_android_waitlist_entry", {
      p_user_id: "20000000-0000-4000-8000-000000000002",
      p_normalized_email_sha256: normalizedEmailSha256(
        "surfer@example.com",
      ),
      p_roster_entry_id: null,
      p_source_kind: "profile_intent",
      p_source_id: "20000000-0000-4000-8000-000000000002",
      p_source: "features-hero-android-waitlist",
      p_surface: "features-page",
      p_placement: "hero_secondary",
      p_observed_at: "2026-07-26T12:00:00.000Z",
    });
  });

  it("fails closed without leaking resolver details", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "duplicate identity hash for surfer@example.com" },
    });

    await expect(
      resolveCanonicalAndroidWaitlist(
        { rpc },
        {
          userId: null,
          email: "surfer@example.com",
          rosterEntryId: null,
          sourceKind: "anonymous_lead",
          sourceId: "30000000-0000-4000-8000-000000000003",
          source: "android-beta",
          surface: "android-beta",
          placement: "direct",
          observedAt: "2026-07-26T12:00:00.000Z",
        },
      ),
    ).rejects.toThrow("Canonical Android waitlist resolver unavailable");
  });
});
