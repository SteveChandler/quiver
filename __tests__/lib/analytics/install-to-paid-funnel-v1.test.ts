import golden from "@/__tests__/fixtures/install-to-paid-v1-golden.json";
import {
  INSTALL_TO_PAID_V1_EXPECTED_INSTALL_COUNT,
  INSTALL_TO_PAID_V1_FIXTURE,
  POSTHOG_OPTOUT_INSTALL_ID,
} from "@/__tests__/fixtures/install-to-paid-v1";
import {
  buildInstallToPaidRows,
  countMatureDenominator,
  INSTALL_TO_PAID_SCHEMA_VERSION,
  UNKNOWN_JOIN_REASONS,
} from "@/lib/analytics/install-to-paid-funnel-v1";

describe("install-to-paid v1 milestone contract", () => {
  const rows = buildInstallToPaidRows(INSTALL_TO_PAID_V1_FIXTURE);
  const byInstall = new Map(rows.map((row) => [row.nativeInstallId, row]));

  it("anchors once per valid production install and keeps milestone order independent", () => {
    expect(rows).toHaveLength(INSTALL_TO_PAID_V1_EXPECTED_INSTALL_COUNT);
    expect(rows.every((row) => row.schemaVersion === INSTALL_TO_PAID_SCHEMA_VERSION)).toBe(true);
    expect(byInstall.has("not-a-uuid")).toBe(false);
    expect(byInstall.has(POSTHOG_OPTOUT_INSTALL_ID)).toBe(false);
    expect(byInstall.get("10000000-0000-4000-8000-000000000003")?.firstQualifiedAt.paywall_viewed)
      .toBe("2026-01-01T00:30:00.000Z");
    expect(byInstall.get("10000000-0000-4000-8000-000000000001")?.milestones.paywallViewed)
      .toBe("true");
  });

  it("records the first canonical decision-loop completion", () => {
    const input = {
      ...INSTALL_TO_PAID_V1_FIXTURE,
      behaviorEvents: [
        ...INSTALL_TO_PAID_V1_FIXTURE.behaviorEvents,
        {
          event: "decision_loop_completed",
          timestamp: "2026-01-01T04:00:00.000Z",
          distinctId: "20000000-0000-4000-8000-000000000001",
          personId: "person-happy",
          nativeInstallId: "10000000-0000-4000-8000-000000000001",
          properties: {},
        },
      ],
    };

    expect(buildInstallToPaidRows(input)[0]).toMatchObject({
      milestones: { firstDecisionLoop: "true" },
      firstQualifiedAt: { first_decision_loop: "2026-01-01T04:00:00.000Z" },
    });
  });

  it("chooses the earliest valid production first open before deduping and excludes test behavior", () => {
    const installId = "30000000-0000-4000-8000-000000000001";
    const userId = "40000000-0000-4000-8000-000000000001";
    const input = {
      ...INSTALL_TO_PAID_V1_FIXTURE,
      asOf: "2026-02-15T00:00:00.000Z",
      behaviorEvents: [
        { event: "native_app_first_open", timestamp: "2026-01-01T00:00:00.000Z", distinctId: userId, personId: "person-valid", nativeInstallId: installId, properties: { is_emulator: true } },
        { event: "native_app_first_open", timestamp: "2026-01-01T01:00:00.000Z", distinctId: userId, personId: "person-valid", nativeInstallId: installId, properties: { environment: "production" } },
        { event: "forecast_interaction", timestamp: "2026-01-02T01:00:00.000Z", distinctId: userId, personId: "person-valid", properties: { is_test: true } },
      ],
      installLinks: [{ nativeInstallId: installId, userId }],
      profiles: [{ id: userId, createdAt: "2026-01-01T02:00:00.000Z", onboardingCompletedAt: null, analyticsIsRealUser: true, analyticsExclusionReason: null, deletedAt: null, isMock: false, isSystemAccount: false }],
      revenueCatEvents: [],
      failedWebhooks: [],
    };

    expect(buildInstallToPaidRows(input)).toEqual([
      expect.objectContaining({
        installedAt: "2026-01-01T01:00:00.000Z",
        exclusionReason: null,
        milestones: expect.objectContaining({ d1Return: "false" }),
      }),
    ]);
  });

  it("does not use profile state from after as-of", () => {
    const row = buildInstallToPaidRows({
      ...INSTALL_TO_PAID_V1_FIXTURE,
      asOf: "2026-01-01T01:30:00.000Z",
      behaviorEvents: INSTALL_TO_PAID_V1_FIXTURE.behaviorEvents.slice(0, 1),
      installLinks: INSTALL_TO_PAID_V1_FIXTURE.installLinks.slice(0, 1),
      profiles: [{
        ...INSTALL_TO_PAID_V1_FIXTURE.profiles[0],
        createdAt: "2026-01-01T01:00:00.000Z",
        onboardingCompletedAt: "2026-01-01T02:00:00.000Z",
      }],
      revenueCatEvents: [],
      failedWebhooks: [],
    })[0];

    expect(row.milestones).toMatchObject({ signup: "true", homeActivated: "false" });
    expect(row.firstQualifiedAt.home_activated).toBeNull();

    const beforeSignup = buildInstallToPaidRows({
      ...INSTALL_TO_PAID_V1_FIXTURE,
      asOf: "2026-01-01T00:30:00.000Z",
      behaviorEvents: INSTALL_TO_PAID_V1_FIXTURE.behaviorEvents.slice(0, 1),
      installLinks: INSTALL_TO_PAID_V1_FIXTURE.installLinks.slice(0, 1),
      profiles: [{
        ...INSTALL_TO_PAID_V1_FIXTURE.profiles[0],
        createdAt: "2026-01-01T01:00:00.000Z",
      }],
      revenueCatEvents: [],
      failedWebhooks: [],
    })[0];
    expect(beforeSignup).toMatchObject({
      joinStatus: "unknown",
      unknownJoinReason: "missing_or_ineligible_profile",
      milestones: expect.objectContaining({ signup: "unknown" }),
    });
  });

  it("keeps unlinked installs unknown and excludes reinstall/internal cohorts correctly", () => {
    const unlinked = byInstall.get("10000000-0000-4000-8000-000000000002");
    expect(unlinked).toMatchObject({ joinStatus: "unknown", unknownJoinReason: "first_open_never_linked" });
    expect(byInstall.get("10000000-0000-4000-8000-000000000004")).toMatchObject({
      excludedFromInstallToSignup: true,
      unknownJoinReason: "reinstall_existing_account",
    });
    expect(byInstall.get("10000000-0000-4000-8000-000000000005")).toMatchObject({
      joinStatus: "excluded",
      exclusionReason: "emulator",
    });
  });

  it("requires RevenueCat proof and classifies trial, promo, cancellation, renewal, and boundaries", () => {
    expect(byInstall.get("10000000-0000-4000-8000-000000000006")?.milestones)
      .toMatchObject({ verifiedTrial: "false", d30Paid: "unknown" });
    expect(byInstall.get("10000000-0000-4000-8000-000000000007")?.milestones.d30Paid).toBe("false");
    expect(byInstall.get("10000000-0000-4000-8000-000000000008")?.milestones.d30Paid).toBe("false");
    expect(byInstall.get("10000000-0000-4000-8000-000000000009")?.milestones.d30Paid).toBe("true");
    expect(byInstall.get("10000000-0000-4000-8000-00000000000a")?.milestones)
      .toMatchObject({ d1Return: "true", d7Return: "true", d30Paid: "true" });
    expect(byInstall.get("10000000-0000-4000-8000-00000000000a")?.firstQualifiedAt)
      .toMatchObject({
        d1_return: "2026-01-02T00:00:00.000Z",
        d7_return: "2026-01-08T00:00:00.000Z",
        d30_paid: "2026-01-31T00:00:00.000Z",
      });
    expect(byInstall.get("10000000-0000-4000-8000-00000000000d")?.milestones.d1Return).toBe("false");
    expect(byInstall.get("10000000-0000-4000-8000-00000000000e")?.milestones.d7Return).toBe("false");
  });

  it("matches the golden unknown, immaturity, and denominator contract", () => {
    const unknownRows = rows.filter((row) => row.joinStatus === "unknown").map((row) => ({
      native_install_id: row.nativeInstallId,
      join_status: row.joinStatus,
      unknown_join_reason: row.unknownJoinReason,
    }));
    const immatureRows = rows.filter((row) => row.maturityStatus === "immature").map((row) => ({
      native_install_id: row.nativeInstallId,
      d1_return: row.milestones.d1Return,
      d7_return: row.milestones.d7Return,
      d30_paid: row.milestones.d30Paid,
    }));
    const excludedImmatureRows = rows
      .filter((row) => row.maturityStatus === "immature" && row.joinStatus === "excluded")
      .map((row) => row.nativeInstallId);
    expect(unknownRows).toEqual(golden.unknown_join_rows);
    expect(new Set(rows.flatMap((row) => row.unknownJoinReason ?? [])))
      .toEqual(new Set(UNKNOWN_JOIN_REASONS));
    expect(immatureRows).toEqual(golden.immature_rows);
    expect(excludedImmatureRows).toEqual(golden.excluded_immature_install_ids);
    expect({
      d1_return: countMatureDenominator(rows, "d1Return"),
      d7_return: countMatureDenominator(rows, "d7Return"),
      d30_paid: countMatureDenominator(rows, "d30Paid"),
    }).toEqual(golden.denominators);
  });
});
