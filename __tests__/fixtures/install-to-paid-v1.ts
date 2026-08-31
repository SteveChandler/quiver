import type {
  InstallBehaviorEvent,
  InstallProfile,
  InstallToPaidInput,
  RevenueCatLedgerEvent,
} from "@/lib/analytics/install-to-paid-funnel-v1";

const INSTALLS = {
  happy: "10000000-0000-4000-8000-000000000001",
  unlinked: "10000000-0000-4000-8000-000000000002",
  duplicate: "10000000-0000-4000-8000-000000000003",
  reinstall: "10000000-0000-4000-8000-000000000004",
  emulator: "10000000-0000-4000-8000-000000000005",
  trialSignalOnly: "10000000-0000-4000-8000-000000000006",
  promo: "10000000-0000-4000-8000-000000000007",
  cancelled: "10000000-0000-4000-8000-000000000008",
  renewed: "10000000-0000-4000-8000-000000000009",
  boundaries: "10000000-0000-4000-8000-00000000000a",
  immature: "10000000-0000-4000-8000-00000000000b",
  d1EndOnly: "10000000-0000-4000-8000-00000000000d",
  d7EndOnly: "10000000-0000-4000-8000-00000000000e",
  missingProfile: "10000000-0000-4000-8000-00000000000f",
  unmerged: "10000000-0000-4000-8000-000000000010",
  dlq: "10000000-0000-4000-8000-000000000011",
  immatureExcluded: "10000000-0000-4000-8000-000000000012",
} as const;

const USERS = Object.fromEntries(
  Object.keys(INSTALLS).map((key, index) => [
    key,
    `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ]),
) as Record<keyof typeof INSTALLS, string>;

function event(
  key: keyof typeof INSTALLS,
  name: string,
  timestamp: string,
  properties: Record<string, unknown> = {},
  distinctId: string = USERS[key],
): InstallBehaviorEvent {
  return {
    event: name,
    timestamp,
    distinctId,
    personId: `person-${key}`,
    nativeInstallId: name === "native_app_first_open" ? INSTALLS[key] : null,
    properties,
  };
}

function profile(
  key: keyof typeof INSTALLS,
  createdAt = "2026-01-01T01:00:00.000Z",
): InstallProfile {
  return {
    id: USERS[key],
    createdAt,
    onboardingCompletedAt: "2026-01-01T03:00:00.000Z",
    analyticsIsRealUser: true,
    analyticsExclusionReason: null,
    deletedAt: null,
    isMock: key === "emulator",
    isSystemAccount: key === "emulator",
  };
}

function rcEvent(
  key: keyof typeof INSTALLS,
  id: string,
  eventType: string,
  eventTimestamp: string,
  overrides: Partial<RevenueCatLedgerEvent> = {},
): RevenueCatLedgerEvent {
  return {
    providerEventId: id,
    appUserId: USERS[key],
    appUserIdStatus: "uuid",
    eventType,
    eventTimestamp,
    purchasedAt: eventTimestamp,
    expirationAt: "2026-03-01T00:00:00.000Z",
    productId: "app.quiversurf.surf.pro.annual",
    periodType: "NORMAL",
    environment: "PRODUCTION",
    store: "APP_STORE",
    ...overrides,
  };
}

const baseInstallEvents = (Object.keys(INSTALLS) as Array<keyof typeof INSTALLS>)
  .filter((key) => !["immature", "immatureExcluded"].includes(key))
  .map((key) => event(
    key,
    "native_app_first_open",
    "2026-01-01T00:00:00.000Z",
    key === "emulator" ? { is_emulator: true } : {},
    key === "unlinked" ? "anonymous-unlinked" : key === "unmerged" ? "anonymous-unmerged" : USERS[key],
  ));

export const INSTALL_TO_PAID_V1_FIXTURE: InstallToPaidInput = {
  asOf: "2026-02-15T00:00:00.000Z",
  behaviorEvents: [
    ...baseInstallEvents,
    {
      event: "native_app_first_open",
      timestamp: "2026-01-01T00:00:00.000Z",
      distinctId: "anonymous-invalid-install",
      personId: "person-invalid-install",
      nativeInstallId: "not-a-uuid",
      properties: { environment: "production" },
    },
    event("immature", "native_app_first_open", "2026-02-14T00:00:00.000Z"),
    event("immatureExcluded", "native_app_first_open", "2026-02-14T00:00:00.000Z", { is_emulator: true }),
    event("duplicate", "native_app_first_open", "2026-01-01T00:05:00.000Z"),
    event("duplicate", "paywall_opened", "2026-01-01T00:30:00.000Z"),
    event("duplicate", "paywall_opened", "2026-01-01T00:31:00.000Z"),
    event("happy", "onboarding_paywall_viewed", "2026-01-01T00:10:00.000Z"),
    event("happy", "home_viewed", "2026-01-01T03:00:00.000Z"),
    event("trialSignalOnly", "trial_active", "2026-01-01T02:00:00.000Z"),
    event("boundaries", "forecast_interaction", "2026-01-02T00:00:00.000Z"),
    event("boundaries", "forecast_interaction", "2026-01-03T00:00:00.000Z"),
    event("boundaries", "map_viewed", "2026-01-08T00:00:00.000Z"),
    event("boundaries", "map_viewed", "2026-01-09T00:00:00.000Z"),
    event("d1EndOnly", "forecast_interaction", "2026-01-03T00:00:00.000Z"),
    event("d7EndOnly", "map_viewed", "2026-01-09T00:00:00.000Z"),
  ],
  installLinks: (Object.keys(INSTALLS) as Array<keyof typeof INSTALLS>)
    .filter((key) => key !== "unlinked")
    .map((key) => ({ nativeInstallId: INSTALLS[key], userId: USERS[key] })),
  profiles: (Object.keys(INSTALLS) as Array<keyof typeof INSTALLS>)
    .filter((key) => !["unlinked", "missingProfile"].includes(key))
    .map((key) => profile(
      key,
      key === "reinstall" ? "2025-12-01T00:00:00.000Z" :
        key === "immature" ? "2026-02-14T01:00:00.000Z" : undefined,
    )),
  revenueCatEvents: [
    rcEvent("happy", "rc-happy-trial", "INITIAL_PURCHASE", "2026-01-01T02:00:00.000Z", { periodType: "TRIAL" }),
    rcEvent("happy", "rc-happy-renewal", "RENEWAL", "2026-01-08T00:00:00.000Z"),
    rcEvent("promo", "rc-promo", "NON_RENEWING_PURCHASE", "2026-01-02T00:00:00.000Z", {
      eventType: "NON_RENEWING_PURCHASE",
      expirationAt: null,
      productId: "rc_promo_Quiver Pro_lifetime",
    }),
    rcEvent("cancelled", "rc-cancelled-buy", "INITIAL_PURCHASE", "2026-01-02T00:00:00.000Z", {
      expirationAt: "2026-01-10T00:00:00.000Z",
    }),
    rcEvent("cancelled", "rc-cancelled", "CANCELLATION", "2026-01-05T00:00:00.000Z", {
      eventType: "CANCELLATION",
      expirationAt: "2026-01-10T00:00:00.000Z",
    }),
    rcEvent("cancelled", "rc-expired", "EXPIRATION", "2026-01-10T00:00:00.000Z", {
      eventType: "EXPIRATION",
      expirationAt: "2026-01-10T00:00:00.000Z",
    }),
    rcEvent("renewed", "rc-renewed-buy", "INITIAL_PURCHASE", "2026-01-02T00:00:00.000Z", {
      expirationAt: "2026-01-15T00:00:00.000Z",
    }),
    rcEvent("renewed", "rc-renewed", "RENEWAL", "2026-01-14T00:00:00.000Z", {
      eventType: "RENEWAL",
      expirationAt: "2026-03-01T00:00:00.000Z",
    }),
    rcEvent("boundaries", "rc-boundary", "INITIAL_PURCHASE", "2026-01-31T00:00:00.000Z", {
      expirationAt: "2026-03-01T00:00:00.000Z",
    }),
  ],
  failedWebhooks: [{ userId: USERS.dlq, receivedAt: "2026-01-02T00:00:00.000Z" }],
  sourceFreshness: {
    posthogFetchedAt: "2026-02-15T00:01:00.000Z",
    supabaseFetchedAt: "2026-02-15T00:01:00.000Z",
    revenuecatLedgerLatestAt: "2026-01-31T00:00:00.000Z",
  },
};

export const INSTALL_TO_PAID_V1_EXPECTED_INSTALL_COUNT = 17;
export const POSTHOG_OPTOUT_INSTALL_ID = "10000000-0000-4000-8000-00000000000c";
