import {
  isPaidLifetimeProductId,
  isPromotionalProductId,
} from "@/lib/subscription/revenuecat-products";

export const INSTALL_TO_PAID_SCHEMA_VERSION = "install_to_paid.v1" as const;
export const HOUR_MS = 3_600_000;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INSTALL_TO_PAID_STAGES = [
  { key: "native_install", source: "posthog", qualifies: ["native_app_first_open"] },
  { key: "signup", source: "supabase", qualifies: ["profiles.created_at"] },
  {
    key: "home_activated",
    source: "supabase+posthog",
    qualifies: [
      "profiles.onboarding_completed_at",
      "home_viewed",
      "home_hero_forecast_viewed",
    ],
  },
  {
    key: "first_decision_loop",
    source: "posthog",
    qualifies: ["decision_loop_completed"],
  },
  { key: "d1_return", source: "posthog", qualifies: ["meaningful_activity"] },
  { key: "d7_return", source: "posthog", qualifies: ["meaningful_activity"] },
  {
    key: "paywall_viewed",
    source: "posthog",
    qualifies: ["paywall_opened", "onboarding_paywall_viewed"],
  },
  {
    key: "verified_trial",
    source: "revenuecat_provider_events",
    qualifies: ["INITIAL_PURCHASE:TRIAL"],
  },
  {
    key: "d30_paid",
    source: "revenuecat_provider_events",
    qualifies: ["active_non_trial_non_promotional_paid_at_install_plus_720h"],
  },
] as const;

export const MEANINGFUL_ACTIVITY_EVENTS = new Set<string>([
  "beach_view",
  "decision_loop_completed",
  "forecast_check",
  "forecast_interaction",
  "home_hero_forecast_viewed",
  "home_surf_call_tap",
  "home_viewed",
  "map_interaction",
  "map_marker_tapped",
  "map_viewed",
  "session_created",
  "session_log_start",
]);

export const EXCLUDED_PROFILE_IDS = new Set<string>([
  "73040cff-afe9-4fa0-a874-2016203fc015",
  "c15c2ab3-275c-49d1-ac4f-dcc493db0653",
]);

export const UNKNOWN_JOIN_REASONS = [
  "first_open_never_linked",
  "posthog_person_not_merged",
  "missing_or_ineligible_profile",
  "webhook_dlq",
  "reinstall_existing_account",
] as const;

export type UnknownJoinReason = (typeof UNKNOWN_JOIN_REASONS)[number];

export const INSTALL_TO_PAID_V1_CONTRACT = {
  schemaVersion: INSTALL_TO_PAID_SCHEMA_VERSION,
  reportKind: "install_cohort_milestone_report",
  grain: "native_install_id",
  anchor: "earliest_valid_production_native_app_first_open",
  stages: INSTALL_TO_PAID_STAGES,
  maturity: {
    d1: { windowStartHours: 24, windowEndHours: 48, matureAtHours: 48 },
    d7: { windowStartHours: 168, windowEndHours: 192, matureAtHours: 192 },
    d30Paid: { exactAtHours: 720, matureAtHours: 720 },
  },
  joinPolicy: "exact_identifiers_only_no_temporal_nearest_match",
  deduplication: "first_qualifying_occurrence_per_install_and_stage",
  reinstallPolicy: "retain_install_exclude_from_install_to_signup",
  exclusions: [
    "bot",
    "emulator",
    "test_or_development",
    "mock_profile",
    "system_account",
    "deleted_profile",
    "non_real_profile",
    "founder_or_maestro",
  ],
  unknownJoinReasons: UNKNOWN_JOIN_REASONS,
} as const;

export type JoinStatus = "exact" | "unknown" | "excluded";
export type MaturityStatus = "immature" | "partially_mature" | "mature";
export type MilestoneStatus = "true" | "false" | "unknown" | "immature";

export interface InstallBehaviorEvent {
  event: string;
  timestamp: string;
  distinctId: string;
  personId: string;
  nativeInstallId?: string | null;
  properties?: Record<string, unknown>;
}

export interface InstallLink {
  nativeInstallId: string;
  userId: string;
}

export interface InstallProfile {
  id: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
  analyticsIsRealUser: boolean | null;
  analyticsExclusionReason: string | null;
  deletedAt: string | null;
  isMock: boolean | null;
  isSystemAccount: boolean | null;
}

export interface RevenueCatLedgerEvent {
  providerEventId: string;
  appUserId: string | null;
  appUserIdStatus: "uuid" | "missing" | "anonymous" | "invalid";
  eventType: string;
  eventTimestamp: string;
  purchasedAt: string | null;
  expirationAt: string | null;
  productId: string | null;
  periodType: string | null;
  environment: "PRODUCTION" | "SANDBOX";
  store: string | null;
}

export interface FailedWebhook {
  userId: string | null;
  receivedAt: string;
}

export interface SourceFreshness {
  posthogFetchedAt: string;
  supabaseFetchedAt: string;
  revenuecatLedgerLatestAt: string | null;
}

export interface InstallMilestones {
  signup: MilestoneStatus;
  homeActivated: MilestoneStatus;
  firstDecisionLoop: MilestoneStatus;
  d1Return: MilestoneStatus;
  d7Return: MilestoneStatus;
  paywallViewed: MilestoneStatus;
  verifiedTrial: MilestoneStatus;
  d30Paid: MilestoneStatus;
}

export interface InstallToPaidRow {
  schemaVersion: typeof INSTALL_TO_PAID_SCHEMA_VERSION;
  nativeInstallId: string;
  installedAt: string;
  userId: string | null;
  joinStatus: JoinStatus;
  unknownJoinReason: UnknownJoinReason | null;
  maturityStatus: MaturityStatus;
  excludedFromInstallToSignup: boolean;
  exclusionReason: string | null;
  milestones: InstallMilestones;
  firstQualifiedAt: Record<string, string | null>;
  sourceFreshness: SourceFreshness;
}

export interface InstallToPaidInput {
  asOf: string;
  behaviorEvents: InstallBehaviorEvent[];
  installLinks: InstallLink[];
  profiles: InstallProfile[];
  revenueCatEvents: RevenueCatLedgerEvent[];
  failedWebhooks: FailedWebhook[];
  sourceFreshness: SourceFreshness;
}

interface EntitlementState {
  isPro: boolean;
  isTrialing: boolean;
  expiresAt: string | null;
  productId: string | null;
}

function firstAt(events: InstallBehaviorEvent[], names: Set<string>): string | null {
  return events
    .filter((event) => names.has(event.event))
    .map((event) => event.timestamp)
    .sort()[0] ?? null;
}

function isExcludedEvent(event: InstallBehaviorEvent): string | null {
  const properties = event.properties ?? {};
  if (properties.bot_flagged === true) return "bot";
  if (properties.is_emulator === true || properties.is_emulator === "true") return "emulator";
  if (properties.is_test === true || properties._is_test === true) return "test";
  const environment = String(properties.environment ?? "production").toLowerCase();
  if (["test", "local", "development", "preview"].includes(environment)) return "non_production";
  return null;
}

function profileExclusion(profile: InstallProfile | undefined): string | null {
  if (!profile) return "missing_profile";
  if (EXCLUDED_PROFILE_IDS.has(profile.id)) return "founder_or_maestro";
  if (profile.deletedAt) return "deleted_profile";
  if (profile.isMock === true) return "mock_profile";
  if (profile.isSystemAccount === true) return "system_account";
  if (profile.analyticsIsRealUser === false) {
    return profile.analyticsExclusionReason ?? "non_real_profile";
  }
  return null;
}

function inWindow(timestamp: string, installedMs: number, startHour: number, endHour: number): boolean {
  const value = Date.parse(timestamp);
  return value >= installedMs + startHour * HOUR_MS && value < installedMs + endHour * HOUR_MS;
}

function replayEntitlementAt(
  events: RevenueCatLedgerEvent[],
  targetMs: number,
): EntitlementState | null {
  // D30 truth is replayed from immutable ledger events; ordering repair belongs here, not in the live projection.
  const eligible = events
    .filter((event) => event.environment === "PRODUCTION")
    .filter((event) => Date.parse(event.eventTimestamp) <= targetMs)
    .sort((a, b) => a.eventTimestamp.localeCompare(b.eventTimestamp));
  if (eligible.length === 0) return null;

  const state: EntitlementState = {
    isPro: false,
    isTrialing: false,
    expiresAt: null,
    productId: null,
  };
  for (const event of eligible) {
    if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION"].includes(event.eventType)) {
      state.isPro = true;
      state.isTrialing = event.periodType === "TRIAL";
      state.expiresAt = event.expirationAt;
      state.productId = event.productId;
      continue;
    }
    if (event.eventType === "NON_RENEWING_PURCHASE") {
      state.isPro = true;
      state.isTrialing = false;
      state.expiresAt = event.expirationAt;
      state.productId = event.productId;
      continue;
    }
    if (event.eventType === "EXPIRATION") {
      state.isPro = false;
      state.isTrialing = false;
      continue;
    }
    if (event.eventType === "CANCELLATION" && isPaidLifetimeProductId(event.productId)) {
      state.isPro = false;
      state.isTrialing = false;
      continue;
    }
    if (event.eventType === "PRODUCT_CHANGE") {
      state.productId = event.productId;
      state.expiresAt = event.expirationAt;
    }
  }
  return state;
}

export function isPaidEntitlementAt(
  events: RevenueCatLedgerEvent[],
  target: string,
): boolean | null {
  const targetMs = Date.parse(target);
  const state = replayEntitlementAt(events, targetMs);
  if (!state) return null;
  if (!state.isPro || state.isTrialing || isPromotionalProductId(state.productId)) return false;
  if (state.expiresAt && Date.parse(state.expiresAt) <= targetMs) return false;
  return Boolean(state.productId) || isPaidLifetimeProductId(state.productId);
}

function maturityStatus(asOfMs: number, installedMs: number): MaturityStatus {
  if (asOfMs >= installedMs + 720 * HOUR_MS) return "mature";
  if (asOfMs >= installedMs + 48 * HOUR_MS) return "partially_mature";
  return "immature";
}

function boolStatus(value: boolean): MilestoneStatus {
  return value ? "true" : "false";
}

export function buildInstallToPaidRows(input: InstallToPaidInput): InstallToPaidRow[] {
  const asOfMs = Date.parse(input.asOf);
  const links = new Map(input.installLinks.map((link) => [link.nativeInstallId, link.userId]));
  const profiles = new Map(input.profiles
    .filter((profile) => Date.parse(profile.createdAt) <= asOfMs)
    .map((profile) => [profile.id, profile]));
  const installs = input.behaviorEvents
    .filter((event) => event.event === "native_app_first_open")
    .filter((event) => UUID_PATTERN.test(event.nativeInstallId ?? ""))
    .filter((event) => Date.parse(event.timestamp) <= asOfMs)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .filter((event, index, all) => {
      const sameInstall = all.filter(
        (candidate) => candidate.nativeInstallId === event.nativeInstallId,
      );
      const firstValid = sameInstall.find((candidate) => !isExcludedEvent(candidate));
      return event === (firstValid ?? sameInstall[0]);
    });

  return installs.map((install): InstallToPaidRow => {
    const nativeInstallId = install.nativeInstallId as string;
    const installedMs = Date.parse(install.timestamp);
    const userId = links.get(nativeInstallId) ?? null;
    const profile = userId ? profiles.get(userId) : undefined;
    const eventExclusion = isExcludedEvent(install);
    const profileExcluded = userId ? profileExclusion(profile) : null;
    const exclusionReason = eventExclusion ?? (profileExcluded === "missing_profile" ? null : profileExcluded);
    const personEvents = input.behaviorEvents.filter(
      (event) => event.personId === install.personId
        && Date.parse(event.timestamp) >= installedMs
        && Date.parse(event.timestamp) <= asOfMs
        && !isExcludedEvent(event),
    );
    const userRevenueCatEvents = userId
      ? input.revenueCatEvents.filter((event) => event.appUserId === userId)
      : [];
    const hasDlq = userId
      ? input.failedWebhooks.some((event) => event.userId === userId)
      : false;
    const reinstall = Boolean(profile && Date.parse(profile.createdAt) < installedMs);
    const posthogMerged = personEvents.some((event) => event.distinctId === userId);
    const unknownJoinReason: UnknownJoinReason | null = exclusionReason
      ? null
      : !userId
        ? "first_open_never_linked"
        : !profile
          ? "missing_or_ineligible_profile"
          : !posthogMerged
            ? "posthog_person_not_merged"
            : hasDlq
              ? "webhook_dlq"
              : reinstall
                ? "reinstall_existing_account"
                : null;
    const joinStatus: JoinStatus = exclusionReason
      ? "excluded"
      : unknownJoinReason && unknownJoinReason !== "reinstall_existing_account"
        ? "unknown"
        : "exact";
    const d1At = personEvents
      .filter((event) => MEANINGFUL_ACTIVITY_EVENTS.has(event.event))
      .filter((event) => inWindow(event.timestamp, installedMs, 24, 48))
      .map((event) => event.timestamp)
      .sort()[0] ?? null;
    const d7At = personEvents
      .filter((event) => MEANINGFUL_ACTIVITY_EVENTS.has(event.event))
      .filter((event) => inWindow(event.timestamp, installedMs, 168, 192))
      .map((event) => event.timestamp)
      .sort()[0] ?? null;
    const paywallAt = firstAt(personEvents, new Set(["paywall_opened", "onboarding_paywall_viewed"]));
    const homeAt = firstAt(personEvents, new Set(["home_viewed", "home_hero_forecast_viewed"]));
    const decisionLoopAt = firstAt(personEvents, new Set(["decision_loop_completed"]));
    const onboardingCompletedAt = profile?.onboardingCompletedAt
      && Date.parse(profile.onboardingCompletedAt) <= asOfMs
      ? profile.onboardingCompletedAt
      : null;
    const trialAt = userRevenueCatEvents
      .filter((event) => event.environment === "PRODUCTION")
      .filter((event) => Date.parse(event.eventTimestamp) <= asOfMs)
      .filter((event) => event.eventType === "INITIAL_PURCHASE" && event.periodType === "TRIAL")
      .map((event) => event.eventTimestamp)
      .sort()[0] ?? null;
    const d30Target = new Date(installedMs + 720 * HOUR_MS).toISOString();
    const maturity = maturityStatus(asOfMs, installedMs);
    const paid = maturity === "mature" ? isPaidEntitlementAt(userRevenueCatEvents, d30Target) : null;
    const reliableJoin = joinStatus === "exact";

    return {
      schemaVersion: INSTALL_TO_PAID_SCHEMA_VERSION,
      nativeInstallId,
      installedAt: install.timestamp,
      userId,
      joinStatus,
      unknownJoinReason,
      maturityStatus: maturity,
      excludedFromInstallToSignup: Boolean(exclusionReason || reinstall),
      exclusionReason,
      milestones: {
        signup: reliableJoin ? boolStatus(Boolean(profile && !reinstall)) : "unknown",
        homeActivated: reliableJoin
          ? boolStatus(Boolean(onboardingCompletedAt || homeAt))
          : "unknown",
        firstDecisionLoop: reliableJoin ? boolStatus(Boolean(decisionLoopAt)) : "unknown",
        d1Return: asOfMs < installedMs + 48 * HOUR_MS
          ? "immature"
          : reliableJoin ? boolStatus(Boolean(d1At)) : "unknown",
        d7Return: asOfMs < installedMs + 192 * HOUR_MS
          ? "immature"
          : reliableJoin ? boolStatus(Boolean(d7At)) : "unknown",
        paywallViewed: reliableJoin ? boolStatus(Boolean(paywallAt)) : "unknown",
        verifiedTrial: reliableJoin && !hasDlq
          ? boolStatus(Boolean(trialAt))
          : "unknown",
        d30Paid: maturity !== "mature"
          ? "immature"
          : reliableJoin && !hasDlq && paid !== null ? boolStatus(paid) : "unknown",
      },
      firstQualifiedAt: {
        native_install: install.timestamp,
        signup: profile && !reinstall ? profile.createdAt : null,
        home_activated: [onboardingCompletedAt, homeAt].filter(Boolean).sort()[0] ?? null,
        first_decision_loop: decisionLoopAt,
        d1_return: d1At,
        d7_return: d7At,
        paywall_viewed: paywallAt,
        verified_trial: trialAt,
        d30_paid: paid === true ? d30Target : null,
      },
      sourceFreshness: input.sourceFreshness,
    };
  });
}

export function countMatureDenominator(
  rows: InstallToPaidRow[],
  milestone: keyof InstallMilestones,
): number {
  return rows.filter((row) => ["true", "false"].includes(row.milestones[milestone])).length;
}
