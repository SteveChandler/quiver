import {
  INSTALL_TO_PAID_V1_EXPECTED_INSTALL_COUNT,
  INSTALL_TO_PAID_V1_FIXTURE,
  INSTALL_TO_PAID_AGGREGATE_FIXTURE,
  POSTHOG_OPTOUT_INSTALL_ID,
} from "@/__tests__/fixtures/install-to-paid-v1";
import {
  buildInstallDimensions, buildInstallToPaidAggregates, buildInstallToPaidRows,
  INSTALL_TO_PAID_SCHEMA_VERSION, INSTALL_TO_PAID_AGGREGATES_SCHEMA_VERSION,
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
});

describe("install-to-paid cohort aggregates", () => {
  const input = INSTALL_TO_PAID_AGGREGATE_FIXTURE;
  const rows = buildInstallToPaidRows(input);
  const dimensions = buildInstallDimensions(input, rows);
  const aggregates = buildInstallToPaidAggregates(rows, dimensions, {
    asOf: input.asOf,
    window: { startDate: "2026-01-01", endDate: "2026-02-15",
      start: "2026-01-01T00:00:00.000Z", end: "2026-02-15T00:00:00.000Z",
      timeZone: "America/Los_Angeles" },
    sourceFreshness: input.sourceFreshness,
  });

  it("counts each anchored install and each qualifying conversion once", () => {
    expect(aggregates.schemaVersion).toBe(INSTALL_TO_PAID_AGGREGATES_SCHEMA_VERSION);
    expect(aggregates.overall.installs).toBe(5);
    expect(aggregates.overall.stages.nativeInstall.true).toBe(5);
    expect(aggregates.overall.stages.paywallViewed.true).toBe(1);
    expect(aggregates.overall.stages.verifiedTrial.true).toBe(1);
    expect(aggregates.overall.stages.verifiedTrial.unknown).toBe(2);
    expect(aggregates.ascDownloads).toEqual({
      joinPolicy: "aggregate_only_never_person_joined", downloads: null,
    });
    expect(aggregates.overall.unknownJoinReason.reinstall_existing_account).toBe(1);
    expect(dimensions["10000000-0000-4000-8000-000000000001"]).toMatchObject({
      platform: "ios", acquisitionSource: "app_store", acquisitionSurface: "search",
      experimentVariant: "A", paywallSource: "onboarding", trialPlan: "annual",
      trialProductId: "app.quiversurf.surf.pro.annual",
    });
    expect(dimensions["10000000-0000-4000-8000-000000000004"].paywallSource).toBe("none");
  });

  it("keeps immature installs out of denominators and missing joins out of false", () => {
    expect(aggregates.overall.stages.d1Return.immature).toBe(1);
    expect(aggregates.overall.stages.d1Return.rate.denominator).toBe(3);
    expect(aggregates.overall.stages.d1Return.unknown).toBe(1);
    expect(aggregates.overall.stages.d1Return.unknownShare).toMatchObject({
      numerator: 1, denominator: 4,
    });
    expect(aggregates.overall.stages.d7Return.immature).toBe(1);
    expect(aggregates.overall.stages.d30Paid.immature).toBe(2);
    const tenDayCohort = aggregates.cohortWeeks.find((group) => group.value === "2026-02-02");
    expect(tenDayCohort?.stages.d7Return).toMatchObject({ false: 1, immature: 0 });
    expect(tenDayCohort?.stages.d30Paid).toMatchObject({ immature: 1, rate: { denominator: 0 } });
    const thirtyHourCohort = aggregates.cohortWeeks.find((group) => group.value === "2026-02-09");
    expect(thirtyHourCohort?.stages.d1Return).toMatchObject({ immature: 1, rate: { denominator: 0 } });
    expect(aggregates.overall.joinStatus.unknown).toBe(1);
    expect(aggregates.overall.unknownJoinReason.first_open_never_linked).toBe(1);
    expect(dimensions["10000000-0000-4000-8000-000000000002"]).toMatchObject({
      platform: "unknown", acquisitionSource: "unknown", experimentVariant: "unknown",
      paywallSource: "none", trialPlan: "none",
    });
    expect(aggregates.breakdowns.platformByExperimentVariant
      .find((group) => group.value === "ios × A")?.installs).toBe(1);
  });

  it("uses shared internal exclusions without changing the emitted reason", () => {
    for (const userId of ["73040cff-afe9-4fa0-a874-2016203fc015", "610a5745-1fac-429c-8f5a-8d085783a5ea"]) {
      const installId = userId;
      const excludedRows = buildInstallToPaidRows({
        ...input,
        behaviorEvents: [{ event: "native_app_first_open", timestamp: "2026-01-01T00:00:00.000Z",
          distinctId: userId, personId: userId, nativeInstallId: installId, properties: {} }],
        installLinks: [{ nativeInstallId: installId, userId }],
        profiles: userId.startsWith("610a5745") ? [] : [{ ...input.profiles[0], id: userId }],
        revenueCatEvents: [],
      });
      expect(excludedRows[0]).toMatchObject({ joinStatus: "excluded", exclusionReason: "founder_or_maestro" });
    }
  });
});
