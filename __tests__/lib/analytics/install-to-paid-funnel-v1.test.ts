import {
  INSTALL_TO_PAID_V1_EXPECTED_INSTALL_COUNT,
  INSTALL_TO_PAID_V1_FIXTURE,
  INSTALL_TO_PAID_AGGREGATE_FIXTURE,
  POSTHOG_OPTOUT_INSTALL_ID,
} from "@/__tests__/fixtures/install-to-paid-v1";
import {
  buildInstallDimensions, buildInstallToPaidAggregates, buildInstallToPaidRows,
  INSTALL_TO_PAID_SCHEMA_VERSION, INSTALL_TO_PAID_AGGREGATES_SCHEMA_VERSION,
  type InstallToPaidInput, type InstallToPaidAggregates,
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
  function reportFor(cohort: InstallToPaidInput, trialWindowDays = 7): InstallToPaidAggregates {
    const cohortRows = buildInstallToPaidRows(cohort);
    return buildInstallToPaidAggregates(cohortRows,
      buildInstallDimensions(cohort, cohortRows, { trialWindowDays }), {
        asOf: cohort.asOf, trialWindowDays, revenueCatEvents: cohort.revenueCatEvents,
        window: { startDate: "2026-01-01", endDate: "2026-02-15",
          start: "2026-01-01T00:00:00.000Z", end: "2026-02-15T00:00:00.000Z",
          timeZone: "America/Los_Angeles" },
        sourceFreshness: cohort.sourceFreshness,
      });
  }
  const rows = buildInstallToPaidRows(input);
  const dimensions = buildInstallDimensions(input, rows);
  const aggregates = buildInstallToPaidAggregates(rows, dimensions, {
    asOf: input.asOf,
    window: { startDate: "2026-01-01", endDate: "2026-02-15",
      start: "2026-01-01T00:00:00.000Z", end: "2026-02-15T00:00:00.000Z",
      timeZone: "America/Los_Angeles" },
    sourceFreshness: input.sourceFreshness,
    revenueCatEvents: input.revenueCatEvents,
  });

  it("counts each anchored install and each qualifying conversion once", () => {
    expect(aggregates.schemaVersion).toBe(INSTALL_TO_PAID_AGGREGATES_SCHEMA_VERSION);
    expect(aggregates.overall.installs).toBe(5);
    expect(aggregates.overall.stages.nativeInstall.true).toBe(5);
    expect(aggregates.overall.stages.paywallViewed.true).toBe(1);
    expect(aggregates.overall.stages.verifiedTrial.true).toBe(1);
    expect(aggregates.overall.stages.verifiedTrial.unknown).toBe(1);
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

  it("counts reinstall signup as not applicable and reports a lower bound for unknown joins", () => {
    expect(aggregates.overall.stages.signup).toMatchObject({
      true: 3, false: 0, unknown: 1, notApplicable: 1,
      rate: { numerator: 3, denominator: 3, rate: 1 },
      lowerBoundRate: { numerator: 3, denominator: 4, rate: 0.75 },
    });
  });

  it("keeps excluded installs out of every stage and every rate in all breakdowns", () => {
    const eligibleRow = rows[0];
    const excludedRows = ["founder_or_maestro", "test_email", "bot", "emulator", "test"]
      .map((reason, index) => ({ ...eligibleRow, nativeInstallId: `excluded-${index}`,
        joinStatus: "excluded" as const, exclusionReason: reason, excludedFromInstallToSignup: true }));
    const report = buildInstallToPaidAggregates([...rows, ...excludedRows], dimensions, {
      asOf: input.asOf, window: aggregates.window, sourceFreshness: input.sourceFreshness,
      revenueCatEvents: input.revenueCatEvents,
    });
    expect(report.overall.installs).toBe(rows.length + excludedRows.length);
    expect(report.overall.excluded).toEqual({ founder_or_maestro: 1, test_email: 1, bot: 1, emulator: 1, test: 1 });
    expect(report.overall.stages).toEqual(aggregates.overall.stages);
    for (const groups of [report.cohortWeeks, ...Object.values(report.breakdowns)]) {
      for (const stage of Object.keys(report.overall.stages) as Array<keyof typeof report.overall.stages>) {
        const total = groups.reduce((sum, group) => {
          const count = group.stages[stage];
          return sum + count.true + count.false + count.unknown + count.immature + count.notApplicable;
        }, 0);
        expect(total).toBe(rows.length);
      }
    }
    const originalRows = buildInstallToPaidRows(INSTALL_TO_PAID_V1_FIXTURE);
    const eligibleRows = originalRows.filter((row) => row.joinStatus !== "excluded");
    const originalReport = reportFor(INSTALL_TO_PAID_V1_FIXTURE);
    const eligibleReport = buildInstallToPaidAggregates(eligibleRows,
      buildInstallDimensions(INSTALL_TO_PAID_V1_FIXTURE, eligibleRows), {
        asOf: INSTALL_TO_PAID_V1_FIXTURE.asOf, window: aggregates.window,
        sourceFreshness: input.sourceFreshness,
        revenueCatEvents: INSTALL_TO_PAID_V1_FIXTURE.revenueCatEvents,
      });
    expect(originalReport.overall.excluded.emulator).toBe(2);
    expect(originalReport.overall.stages).toEqual(eligibleReport.overall.stages);
  });

  it("joins acquisition by install ID or person span and falls back to attribution outcomes", () => {
    const anchor = input.behaviorEvents[0];
    const reinstall = input.behaviorEvents.find((event) => event.nativeInstallId === "10000000-0000-4000-8000-000000000004")!;
    const cohort = { ...input, behaviorEvents: [anchor, reinstall,
      { ...anchor, event: "native_install_attribution_joined", personId: "changed-person",
        timestamp: "2026-01-02T00:00:00.000Z", properties: { acquisition_source: "campaign" } },
      { ...reinstall, event: "native_install_attribution_joined", nativeInstallId: null,
        timestamp: "2026-01-06T00:00:00.000Z", properties: { install_attribution_outcome: "unavailable" } },
      { ...reinstall, event: "native_install_attribution_joined", nativeInstallId: "another-install",
        timestamp: "2026-01-05T00:01:00.000Z", properties: { acquisition_source: "wrong" } },
    ] };
    const result = buildInstallDimensions(cohort);
    expect(result[anchor.nativeInstallId!].acquisitionSource).toBe("campaign");
    expect(result[reinstall.nativeInstallId!].acquisitionSource).toBe("outcome:unavailable");
    const fallbackOnly = buildInstallDimensions({ ...cohort,
      behaviorEvents: cohort.behaviorEvents.filter((event) => event.personId !== "changed-person") });
    expect(fallbackOnly[anchor.nativeInstallId!].acquisitionSource).toBe("outcome:joined");
    expect(fallbackOnly[reinstall.nativeInstallId!].acquisitionSource).toBe("outcome:unavailable");
    const withoutJoin = buildInstallDimensions({ ...cohort, behaviorEvents: [anchor] });
    expect(withoutJoin[anchor.nativeInstallId!].acquisitionSource).toBe("outcome:joined");
  });

  it("uses the first in-window production trial even when the row's first trial predates install", () => {
    const anchor = input.behaviorEvents[0];
    const trial = input.revenueCatEvents[0];
    const cohort: InstallToPaidInput = { ...input, asOf: "2026-01-11T00:00:00.000Z",
      behaviorEvents: input.behaviorEvents.filter((event) => event.personId === anchor.personId
        && event.nativeInstallId !== "10000000-0000-4000-8000-000000000004"),
      revenueCatEvents: [
        { ...trial, providerEventId: "before-install", eventTimestamp: "2025-12-30T00:00:00.000Z" },
        { ...trial, providerEventId: "sandbox", eventTimestamp: "2026-01-02T00:00:00.000Z", environment: "SANDBOX" },
        { ...trial, providerEventId: "renewal", eventTimestamp: "2026-01-01T01:00:00.000Z", eventType: "RENEWAL" },
        { ...trial, providerEventId: "non-trial", eventTimestamp: "2026-01-01T01:00:00.000Z", periodType: "NORMAL" },
        { ...trial, providerEventId: "valid", eventTimestamp: "2026-01-03T00:00:00.000Z", productId: "pro.monthly" },
        { ...trial, providerEventId: "late", eventTimestamp: "2026-01-09T00:00:00.000Z" },
      ],
    };
    expect(buildInstallToPaidRows(cohort)[0].firstQualifiedAt.verified_trial).toBe("2025-12-30T00:00:00.000Z");
    const report = reportFor(cohort);
    expect(report.maturityHours.verifiedTrial).toBe(168);
    expect(report.overall.stages.verifiedTrial).toMatchObject({ true: 1, immature: 0 });
    expect(report.breakdowns.trialPlan.map((group) => group.value)).toEqual(["monthly"]);
    expect(buildInstallDimensions(cohort)[anchor.nativeInstallId!].trialPlan).toBe("monthly");
    const longerWindow = reportFor(cohort, 14);
    expect(longerWindow.maturityHours.verifiedTrial).toBe(336);
    expect(longerWindow.overall.stages.verifiedTrial).toMatchObject({ immature: 1, rate: { denominator: 0 } });
    expect(longerWindow.breakdowns.trialPlan.map((group) => group.value)).toEqual(["none"]);
    expect(buildInstallDimensions(cohort, undefined, { trialWindowDays: 14 })[anchor.nativeInstallId!].trialPlan).toBe("none");
    expect(longerWindow.overall.stages.d30Paid.immature).toBe(1);
    const lateOnly = { ...cohort, revenueCatEvents: cohort.revenueCatEvents.filter((event) => event.providerEventId !== "valid") };
    expect(reportFor(lateOnly).overall.stages.verifiedTrial.false).toBe(1);
    expect(reportFor(lateOnly).breakdowns.trialPlan[0].value).toBe("none");
    expect(reportFor({ ...lateOnly, asOf: "2026-01-16T00:00:00.000Z" }, 14).overall.stages.verifiedTrial.true).toBe(1);
    const atDeadline = { ...cohort, revenueCatEvents: [{ ...trial, eventTimestamp: "2026-01-08T00:00:00.000Z" }] };
    expect(reportFor(atDeadline).overall.stages.verifiedTrial.false).toBe(1);
  });

  it("keeps duplicate trial plans at none when overlapping reinstall windows share one purchase", () => {
    const cohort = { ...input, behaviorEvents: input.behaviorEvents.map((event) =>
      event.nativeInstallId === "10000000-0000-4000-8000-000000000004"
        ? { ...event, timestamp: "2026-01-02T00:00:00.000Z" } : event),
      revenueCatEvents: [{ ...input.revenueCatEvents[0], eventTimestamp: "2026-01-03T00:00:00.000Z" }],
    };
    const report = reportFor(cohort);
    expect(report.overall.stages.verifiedTrial.true).toBe(1);
    const result = buildInstallDimensions(cohort);
    expect(result["10000000-0000-4000-8000-000000000004"].trialPlan).toBe("none");
    expect(report.breakdowns.trialPlan.find((group) => group.value === "annual")?.installs).toBe(1);
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
