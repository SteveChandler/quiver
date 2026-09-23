/** @jest-environment node */
import { bulkForecastHandler } from "@/app/api/forecasts/bulk/route";
import {
  bulkRecommendationLabel,
  fetchBulkDecisionContext,
  type BulkDecisionContext,
} from "@/lib/services/forecast/bulk-decision-context";
import { buildCanonicalDecisionFromSurfDiscovery } from "@/lib/recommendations/canonical-decision/discovery-adapter";
import { recommendationLabelForVerdict } from "@/lib/recommendations/canonical-decision/engine";
import { resolveRecommendationLabel } from "@/lib/services/discovery/recommendation-label";
import {
  forecastRowIntervalEnd,
  isDaylightInterval,
} from "@/lib/services/discovery/daylight-eligibility";
import { resolveWaterQualityHolds } from "@/lib/recommendations/major-event-hold/water-quality";
import { createMockRequest } from "@/test-utils/api-test-helpers";
import { getCachedRateLimiter } from "@/lib/utils/enhanced-rate-limiter";
import { RATE_LIMITS } from "@/lib/api/rate-limit-config";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type {
  SimilarityRecommendation,
  SurfDiscoveryRecommendation,
} from "@/types/personalization";

const NOW = new Date("2026-09-23T18:00:00Z");
const id = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const beach = (n: number): Beach =>
  ({
    id: id(n),
    name: `Beach ${n}`,
    timezone: "America/Los_Angeles",
    skill_level: "beginner",
    break_type: "beach",
    lat: 32.8,
    lon: -117.2,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 45,
    swell_window_min_deg: 200,
    swell_window_max_deg: 300,
    shoaling_factors: null,
  }) as Beach;
const forecast = (n: number, at = NOW.toISOString()): EnhancedForecastEntity =>
  ({
    id: id(n + 100),
    beach_id: id(n),
    forecast_at: at,
    wave_height: "3 ft",
    wave_period: "12s",
    wave_direction: "W",
    wind_speed: "5 mph",
    wind_direction: "E",
    wind_direction_deg: 90,
    tide_height: "2.5 ft",
    tide_status: "Rising",
    confidence_score: 90,
  }) as EnhancedForecastEntity;
const learned = (label: string): SimilarityRecommendation => ({
  state: "ready",
  score: 5,
  label,
  confidence: "high",
  sessionCount: 25,
  reason: "Session history",
  reasons: ["Session history"],
  bonusApplied: 0,
});
const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));
jest.mock("@/lib/services/forecast/v5-display-gate", () => ({
  applyV51DisplayOverrideToForecasts: async (rows: unknown[]) => rows,
}));
jest.mock("@/lib/recommendations/major-event-hold/config", () => ({
  MAJOR_EVENT_HOLD_MODE: "off",
}));

function query(data: unknown): unknown {
  const chain: unknown = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "then"
          ? (resolve: (result: unknown) => unknown) =>
              Promise.resolve(resolve({ data, error: null }))
          : () => chain,
    },
  );
  return chain;
}
function rpcData(count: number, at: string): Record<string, unknown> {
  return {
    beaches: Array.from({ length: count }, (_, i) => beach(i + 1)),
    profile: { experience_level: "Advanced" },
    boards: [{ board_type: "longboard" }],
    sun_times: Array.from({ length: count }, (_, i) => ({
      beach_id: id(i + 1),
      sunrise_utc: "2026-09-23T13:40:00Z",
      sunset_utc: "2026-09-24T01:45:00Z",
    })),
    personalization: {
      entitlement: {
        is_pro: true,
        is_trialing: false,
        billing_issue: false,
        expires_at: null,
      },
      matches: Array.from({ length: count }, (_, i) => ({
        beach_id: id(i + 1),
        forecast_at: at,
        result: {
          state: "ready",
          score: 3,
          label: "MEH",
          confidence: "high",
          sessions_in_profile: 25,
          reason_bullets: ["Session history"],
        },
      })),
    },
    water_quality: {
      county_beach_advisory_runs: [
        {
          id: id(900),
          fetched_at: NOW.toISOString(),
          status: "completed",
          source_identifier: "county-san-diego-dehq-sdbeachinfo",
        },
      ],
    },
  };
}
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());
afterAll(() =>
  getCachedRateLimiter("forecast-bulk", RATE_LIMITS["forecast-bulk"]).destroy(),
);

// Exercises the real route, context loader, canonical engine and safety resolver.
// Only the PostgREST transport and unrelated display calibration are mocked.
it.each(
  [1, 20, 50].flatMap((count) =>
    [false, true].flatMap((signedIn) =>
      [false, true].map((selected) => ({ count, signedIn, selected })),
    ),
  ),
)(
  "uses no more reads than the baseline: %j",
  async ({ count, signedIn, selected }) => {
    const rows = Array.from({ length: count }, (_, i) => forecast(i + 1));
    mockFrom.mockImplementation((table) => {
      expect(table).toBe("enhanced_forecasts");
      return query(rows);
    });
    const data = rpcData(count, NOW.toISOString());
    if (!signedIn) {
      data.profile = null;
      data.boards = [];
      data.personalization = null;
    }
    mockRpc.mockResolvedValue({ data, error: null });
    const response = await bulkForecastHandler(
      createMockRequest(
        "GET",
        `http://localhost/api/forecasts/bulk?beachIds=${rows.map((r) => r.beach_id)}${selected ? `&forecastAt=${NOW.toISOString()}` : ""}`,
      ),
      {
        params: {},
        user: signedIn ? { id: id(800) } : null,
        supabase: { from: mockFrom },
      } as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()).data;
    expect(body.conditionScores[id(1)]).toEqual(expect.any(Number));
    expect(body.recommendationLabels[id(1)]).toBe(
      resolveRecommendationLabel({
            beach: beach(1),
            forecast: rows[0],
            score: body.conditionScores[id(1)],
          }).label,
    );
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      "get_bulk_forecast_decision_context",
      expect.objectContaining({
        p_user_id: signedIn ? id(800) : null,
        p_slots: expect.any(Array),
      }),
    );
    const baseline = 2 + (signedIn ? 2 : 0) + (selected ? 0 : 1);
    expect(
      mockFrom.mock.calls.length + mockRpc.mock.calls.length,
    ).toBeLessThanOrEqual(baseline);
  },
);

it.each(["2026-09-23T10:00:00Z", "2026-09-23T06:00:00Z"])(
  "scores the reported 3 AM / 11 PM previews without a daylight veto: %s",
  async (at) => {
    mockFrom.mockReturnValue(query([forecast(1, at)]));
    const data = rpcData(1, at);
    data.personalization = null; // Darkness is metadata, not a verdict veto.
    mockRpc.mockResolvedValue({ data, error: null });
    const response = await bulkForecastHandler(
      createMockRequest(
        "GET",
        `http://localhost/api/forecasts/bulk?beachIds=${id(1)}&forecastAt=${at}`,
      ),
      {
        params: {},
        user: { id: id(800) },
        supabase: { from: mockFrom },
      } as never,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.recommendationLabels[id(1)]).toBe(
      "Worth it",
    );
    expect(mockRpc).toHaveBeenCalledTimes(1);
  },
);

const profiles = [
  null,
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;
it.each(
  profiles.flatMap((skill) =>
    [0, 39, 40, 54, 55, 64, 69, 70, 79, 80, 100].flatMap((score) =>
      [null, "GOOD", "FAIR", "MEH"].map((label) => ({ skill, score, label })),
    ),
  ),
)(
  "matches the surf-call adapter for score, skill and learned evidence: %j",
  ({ skill, score, label }) => {
    const row = forecast(1);
    const spot = beach(1);
    const similarity = label ? learned(label) : null;
    const context = {
      skillLevel: skill,
      boardClasses: ["longboard"],
      sunTimes: new Map(),
      matches: new Map([[`${row.beach_id}:${row.forecast_at}`, similarity]]),
      rowDurationsMs: new Map([[`${row.beach_id}:${row.forecast_at}`, 60 * 60_000]]),
    } as BulkDecisionContext;
    const end = new Date(NOW.getTime() + 60 * 60_000);
    const call = buildCanonicalDecisionFromSurfDiscovery({
      anchorTime: NOW.toISOString(),
      scope: {
        kind: "plan_next_session",
        windowStart: NOW.toISOString(),
        windowEnd: end.toISOString(),
        timezone: spot.timezone!,
      },
      profileExperience: skill,
      recommendationAvailability: { state: "available", holdEpoch: "test" },
      recommendations: [
        {
          recommendationId: "test",
          beach: spot,
          forecast: row,
          score,
          similarity,
          window: { start: NOW, end, timezone: spot.timezone },
          recommendationLabel: resolveRecommendationLabel({
            beach: spot,
            forecast: row,
            score,
          }).label,
        } as SurfDiscoveryRecommendation,
      ],
    });
    expect(bulkRecommendationLabel(context, spot, row, score, NOW)).toBe(
      recommendationLabelForVerdict(call.verdict),
    );
  },
);

it.each([
  ["2026-09-23T10:00:00Z", false],
  ["2026-09-23T10:15:00Z", false],
  ["2026-09-23T06:00:00Z", false],
  ["2026-09-23T13:00:00Z", true],
  ["2026-09-23T13:10:00Z", true],
  ["2026-09-24T01:45:00Z", true],
  ["2026-09-24T02:05:00Z", false],
  ["2026-09-24T02:06:00Z", false],
] as const)(
  "uses the shared interval daylight boundary at %s",
  async (at, allowed) => {
    mockRpc.mockResolvedValue({ data: rpcData(1, at), error: null });
    const context = await fetchBulkDecisionContext(
      id(800),
      [id(1)],
      [forecast(1, at)],
      NOW,
      NOW,
    );
    context.matches.clear();
    const start = new Date(at);
    const end = forecastRowIntervalEnd(start);
    expect(
      isDaylightInterval(start, end, beach(1).timezone!, context.sunTimes.get(id(1))),
    ).toBe(allowed);
    expect(
      bulkRecommendationLabel(
        context,
        beach(1),
        forecast(1, at),
        90,
        new Date(at),
      ),
    ).toBe("Worth it");
  },
);

it("applies loaded water-quality holds with no network reads", async () => {
  const data = rpcData(1, NOW.toISOString());
  (data.water_quality as Record<string, unknown>).water_quality_held_beaches = [
    { beach_id: id(1) },
  ];
  mockRpc.mockResolvedValue({ data, error: null });
  const context = await fetchBulkDecisionContext(
    id(800),
    [id(1)],
    [forecast(1)],
    NOW,
    NOW,
  );
  const result = await resolveWaterQualityHolds(
    [
      {
        candidateId: "test",
        beachId: id(1),
        startsAt: NOW.toISOString(),
        endsAt: new Date(NOW.getTime() + 3600000).toISOString(),
      },
    ],
    { client: context.waterQuality, now: NOW },
  );
  expect(result.heldBeachIds).toContain(id(1));
  expect(mockFrom).not.toHaveBeenCalled();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  "shares one context RPC across current and hourly conditions (timeline only: %s)",
  async (only) => {
    mockFrom.mockReturnValue(query([forecast(1)]));
    mockRpc.mockResolvedValue({
      data: rpcData(1, NOW.toISOString()),
      error: null,
    });
    const response = await bulkForecastHandler(
      createMockRequest(
        "GET",
        `http://localhost/api/forecasts/bulk?beachIds=${id(1)}&timeline=hourly&timelineOnly=${only}&timelineStart=${NOW.toISOString()}&timelineHours=1&includeConditions=true`,
      ),
      {
        params: {},
        user: { id: id(800) },
        supabase: { from: mockFrom },
      } as never,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()).data;
    expect(
      body.hourlySwellTimeline.partitionsByBeach[id(1)][0].recommendationLabel,
    ).toBe("Worth it");
    expect(mockFrom).toHaveBeenCalledTimes(only ? 2 : 3);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(
      mockFrom.mock.calls.length + mockRpc.mock.calls.length,
    ).toBeLessThanOrEqual(only ? 5 : 8);
  },
);

it.each([
  { skill: "beginner", wave: "8 ft", beachSkill: "beginner" },
  { skill: "beginner", wave: "3 ft", beachSkill: "expert" },
  { skill: "advanced", wave: "3 ft", beachSkill: null },
  { skill: "advanced", wave: null, beachSkill: "beginner" },
] as const)(
  "applies canonical safety vetoes: %j",
  ({ skill, wave, beachSkill }) => {
    const spot = { ...beach(1), skill_level: beachSkill };
    const row = { ...forecast(1), wave_height: wave };
    const context = {
      skillLevel: skill,
      sunTimes: new Map(),
      matches: new Map(),
      rowDurationsMs: new Map(),
    } as BulkDecisionContext;
    expect(bulkRecommendationLabel(context, spot, row, 90, NOW)).toBe("Skip");
  },
);

it("ignores learned matches for expired paid access", async () => {
  const data = rpcData(1, NOW.toISOString());
  (
    data.personalization as { entitlement: Record<string, unknown> }
  ).entitlement.expires_at = "2026-09-01T00:00:00Z";
  mockRpc.mockResolvedValue({ data, error: null });
  const context = await fetchBulkDecisionContext(
    id(800),
    [id(1)],
    [forecast(1)],
    NOW,
    NOW,
  );
  expect(context.matches.get(`${id(1)}:${NOW.getTime()}`)).toBeNull();
  expect(context.boardClasses).toEqual(["longboard"]);
  expect(context.skillLevel).toBe("advanced");
  expect(bulkRecommendationLabel(context, beach(1), forecast(1), 90, NOW)).toBe(
    "Worth it",
  );
});

it("reproduces score 64 for Advanced / Southpoint longboard 2+1 as MAYBE", () => {
  const row = forecast(1);
  const context = {
    skillLevel: "advanced",
    boardClasses: ["longboard"],
    sunTimes: new Map(),
    matches: new Map([[`${row.beach_id}:${row.forecast_at}`, learned("FAIR")]]),
    rowDurationsMs: new Map(),
  } as BulkDecisionContext;
  expect(bulkRecommendationLabel(context, beach(1), row, 64, NOW)).toBe(
    "Maybe",
  );
});


it.each([false, true])('feature-detects board history with one RPC (present: %s)', async (hasHistory) => {
  const data = rpcData(1, NOW.toISOString());
  const board = { id: id(500), name: 'Twin pin', board_type: 'thruster', sessions: [] };
  if (hasHistory) (data.personalization as Record<string, unknown>).boards = [board];
  mockRpc.mockResolvedValue({ data, error: null });
  const context = await fetchBulkDecisionContext(id(800), [id(1)], [forecast(1)], NOW, NOW);
  expect(context.boards).toEqual(hasHistory ? [board] : []);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockFrom).not.toHaveBeenCalled();
});

describe("bulk timeline daylight gate", () => {
  // 2026-09-23 San Diego: sunrise 06:39 PT, sunset 18:44 PT.
  const sun = {
    sunrises: [new Date("2026-09-23T13:39:00Z")],
    sunsets: [new Date("2026-09-24T01:44:00Z")],
  };
  const contextFor = (row: EnhancedForecastEntity): BulkDecisionContext => ({
    skillLevel: "advanced",
    boardClasses: ["longboard"],
    sunTimes: new Map([[row.beach_id, sun]]),
    matches: new Map(),
    rowDurationsMs: new Map([[`${row.beach_id}:${row.forecast_at}`, 60 * 60_000]]),
  }) as BulkDecisionContext;

  it("gives a dark future timeline hour no call but keeps the current hour ungated", () => {
    const at = new Date("2026-09-23T09:00:00Z"); // 02:00 PT
    const row = { ...forecast(1), forecast_at: at.toISOString() };
    const context = contextFor(row);
    expect(bulkRecommendationLabel(context, beach(1), row, 94, at, { daylightOnly: true })).toBe("Skip");
    expect(bulkRecommendationLabel(context, beach(1), row, 94, at)).not.toBe("Skip");
  });

  it("keeps a dawn timeline hour that overlaps first light", () => {
    const at = new Date("2026-09-23T13:00:00Z"); // 06:00 PT, first light 06:09
    const row = { ...forecast(1), forecast_at: at.toISOString() };
    const context = contextFor(row);
    expect(bulkRecommendationLabel(context, beach(1), row, 94, at, { daylightOnly: true }))
      .toBe(bulkRecommendationLabel(context, beach(1), row, 94, at));
  });
});
