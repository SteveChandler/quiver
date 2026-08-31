jest.mock("server-only", () => ({}));

const mockServingLogWarn = jest.fn();
jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: (...args: unknown[]) => mockServingLogWarn(...args),
    error: jest.fn(),
  }),
}));

import {
  applyTrustedForecastServing,
  isTrustedForecastCanaryEligible,
  parseTrustedForecastCanaryUserIds,
  type TrustedForecastServingStore,
} from "../trusted-forecast-serving";
import { TRUSTED_FORECAST_POLICY_VERSION } from "../trusted-forecast-policy";

const CANARY_A = "11111111-1111-4111-8111-111111111111";
const CANARY_B = "22222222-2222-4222-8222-222222222222";
const CONTROL = "33333333-3333-4333-8333-333333333333";
const BEACH_ID = "44444444-4444-4444-8444-444444444444";
const FORECAST_AT = "2026-08-30T12:00:00.000Z";

const baseline = [
  {
    beach_id: BEACH_ID,
    forecast_at: FORECAST_AT,
    wave_height: "4 ft",
  },
];

function store(
  data: unknown[] | null = [
    {
      beach_id: BEACH_ID,
      forecast_at: FORECAST_AT,
      applied_delta_ft: 0.5,
      baseline_max_face_ft: 4,
      adjusted_max_face_ft: 4.5,
      trusted_forecast_decisions: {
        policy_version: TRUSTED_FORECAST_POLICY_VERSION,
      },
    },
  ],
  error: { code?: string } | null = null,
): TrustedForecastServingStore {
  return {
    selectApplications: jest.fn(async () => ({ data, error })),
  };
}

describe("trusted forecast canary eligibility", () => {
  it.each([
    [undefined, null],
    ["", null],
    [CANARY_A, null],
    [`${CANARY_A},${CANARY_B},${CONTROL}`, null],
    [`${CANARY_A},${CANARY_A}`, null],
    ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", null],
    [`${CANARY_A},not-a-uuid`, null],
  ])("denies an invalid exactly-two allowlist: %p", (value, expected) => {
    expect(parseTrustedForecastCanaryUserIds(value)).toBe(expected);
  });

  it("accepts exactly two distinct UUIDs", () => {
    expect(parseTrustedForecastCanaryUserIds(` ${CANARY_A}, ${CANARY_B} `)).toEqual([
      CANARY_A,
      CANARY_B,
    ]);
  });

  it.each([undefined, "", "false", "TRUE", "1", "yes", " true "])(
    "requires the flag to equal exact true: %p",
    (flag) => {
      expect(
        isTrustedForecastCanaryEligible(CANARY_A, flag, `${CANARY_A},${CANARY_B}`),
      ).toBe(false);
    },
  );

  it("permits only canary A and B with exact configuration", () => {
    const allowlist = `${CANARY_A},${CANARY_B}`;
    expect(isTrustedForecastCanaryEligible(CANARY_A, "true", allowlist)).toBe(true);
    expect(isTrustedForecastCanaryEligible(CANARY_B, "true", allowlist)).toBe(true);
    expect(isTrustedForecastCanaryEligible(CONTROL, "true", allowlist)).toBe(false);
    expect(isTrustedForecastCanaryEligible(null, "true", allowlist)).toBe(false);
  });
});

describe("trusted forecast response serving", () => {
  const enabledEnv = {
    servingEnabled: "true",
    canaryUserIds: `${CANARY_A},${CANARY_B}`,
  };

  beforeEach(() => {
    mockServingLogWarn.mockClear();
  });

  it("clones and adjusts only the matching slot for either canary", async () => {
    for (const userId of [CANARY_A, CANARY_B]) {
      const input = baseline.map((forecast) => ({ ...forecast }));
      const result = await applyTrustedForecastServing({
        userId,
        beachId: BEACH_ID,
        forecasts: input,
        store: store(),
        env: enabledEnv,
      });

      expect(result).not.toBe(input);
      expect(result[0]?.wave_height).toBe("4-5ft");
      expect(input).toEqual(baseline);
    }
    expect(mockServingLogWarn).toHaveBeenLastCalledWith(
      "trusted_forecast_canary_adjusted",
      {
        policyVersion: TRUSTED_FORECAST_POLICY_VERSION,
        routeIdentifier: "/api/forecasts/update-enhanced",
        adjustedSlotCount: 1,
      },
    );
  });

  it.each([CONTROL, null])("returns baseline without a private read for %p", async (userId) => {
    const readStore = store();
    const result = await applyTrustedForecastServing({
      userId,
      beachId: BEACH_ID,
      forecasts: baseline,
      store: readStore,
      env: enabledEnv,
    });

    expect(result).toBe(baseline);
    expect(readStore.selectApplications).not.toHaveBeenCalled();
  });

  it("does not read private applications when the kill switch is off", async () => {
    const readStore = store();
    const result = await applyTrustedForecastServing({
      userId: CANARY_A,
      beachId: BEACH_ID,
      forecasts: baseline,
      store: readStore,
      env: { servingEnabled: "false", canaryUserIds: `${CANARY_A},${CANARY_B}` },
    });

    expect(result).toBe(baseline);
    expect(readStore.selectApplications).not.toHaveBeenCalled();
  });

  it.each([
    [null, null],
    [[{ invalid: true }], null],
    [
      [
        {
          beach_id: BEACH_ID,
          forecast_at: FORECAST_AT,
          applied_delta_ft: 0.5,
          baseline_max_face_ft: 4,
          adjusted_max_face_ft: 4.5,
          trusted_forecast_decisions: { policy_version: TRUSTED_FORECAST_POLICY_VERSION },
        },
        {
          beach_id: BEACH_ID,
          forecast_at: FORECAST_AT,
          applied_delta_ft: 0.5,
          baseline_max_face_ft: 4,
          adjusted_max_face_ft: 4.5,
          trusted_forecast_decisions: { policy_version: TRUSTED_FORECAST_POLICY_VERSION },
        },
      ],
      null,
    ],
    [
      [
        {
          beach_id: BEACH_ID,
          forecast_at: FORECAST_AT,
          applied_delta_ft: 0.3,
          baseline_max_face_ft: 4,
          adjusted_max_face_ft: 4.3,
          trusted_forecast_decisions: { policy_version: TRUSTED_FORECAST_POLICY_VERSION },
        },
      ],
      null,
    ],
    [
      [
        {
          beach_id: BEACH_ID,
          forecast_at: FORECAST_AT,
          applied_delta_ft: 0.5,
          baseline_max_face_ft: 4,
          adjusted_max_face_ft: 4.5,
          trusted_forecast_decisions: { policy_version: "stale-policy" },
        },
      ],
      null,
    ],
    [[], { code: "transport" }],
    [[], null],
    [
      [
        {
          beach_id: CONTROL,
          forecast_at: FORECAST_AT,
          applied_delta_ft: 0.5,
          baseline_max_face_ft: 4,
          adjusted_max_face_ft: 4.5,
          trusted_forecast_decisions: { policy_version: TRUSTED_FORECAST_POLICY_VERSION },
        },
      ],
      null,
    ],
  ])("fails closed to baseline for invalid repository state %#", async (data, error) => {
    const result = await applyTrustedForecastServing({
      userId: CANARY_A,
      beachId: BEACH_ID,
      forecasts: baseline,
      store: store(data as unknown[] | null, error),
      env: enabledEnv,
    });

    expect(result).toBe(baseline);
  });

  it("returns baseline when the repository throws", async () => {
    const result = await applyTrustedForecastServing({
      userId: CANARY_A,
      beachId: BEACH_ID,
      forecasts: baseline,
      store: {
        selectApplications: jest.fn(async () => {
          throw new Error("transport");
        }),
      },
      env: enabledEnv,
    });

    expect(result).toBe(baseline);
  });

  it("does not expose ids, account data, or private provenance", async () => {
    const result = await applyTrustedForecastServing({
      userId: CANARY_A,
      beachId: BEACH_ID,
      forecasts: baseline,
      store: store(),
      env: enabledEnv,
    });
    const body = JSON.stringify(result);

    for (const forbidden of [
      CANARY_A,
      CANARY_B,
      "application_id",
      "decision_id",
      "issue_id",
      "policy_version",
      "email",
      "name",
    ]) {
      expect(body).not.toContain(forbidden);
    }
  });
});
