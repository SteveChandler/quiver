/** @jest-environment node */
import { loadActivationCall, mostViewedBeachId, type ActivationCallDeps } from "@/lib/email/activation-call";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { CanonicalWeekScoutResponse, WeekScoutDaysRequest, WeekScoutWindowResponse } from "@/lib/services/discovery/week-scout";

const mockCreateServiceClient = jest.fn<unknown, []>(() => { throw new Error("no database in unit tests"); });
const mockGenerate = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => mockCreateServiceClient(),
}));
jest.mock("@/lib/services/discovery/week-scout", () => ({
  generateWeekScoutForecastForDays: (userId: string, request: WeekScoutDaysRequest) => mockGenerate(userId, request),
}));

const USER = "11111111-1111-4111-8111-111111111111";
const HOME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VIEWED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-11-19T17:00:00Z"); // Thursday 9 AM in Los Angeles

const beachRow = (id: string, name: string) => ({ id, name, short_name: null, slug: name.toLowerCase(), timezone: "America/Los_Angeles", wind_offshore_deg: 45, aspect_deg: null });

function windowFixture(overrides: Partial<WeekScoutWindowResponse> = {}): WeekScoutWindowResponse {
  return {
    id: "w-sat", bucket: "morning", start: "2026-11-21T15:00:00Z", end: "2026-11-21T18:00:00Z",
    displayWindowStart: "2026-11-21T15:00:00Z", displayWindowEnd: "2026-11-21T18:00:00Z", peakTime: "2026-11-21T16:00:00Z",
    beachId: VIEWED, isBeachDayBest: true, conditionScore: 78, rankingScore: 78, verdict: "worth_it", rideable: true, safe: true, confidence: 0.8,
    personalVerdict: "go", personalLabel: "GOOD",
    forecast: { waveHeight: "3.4", period: "12", swellDirection: "SSW", windSpeed: "4", windDirection: "NE", tideHeightFt: 2, tidePhase: "rising", freshnessAt: "2026-11-19T16:00:00Z" },
    takeaway: null, rankedSpots: [], ...overrides,
  } as WeekScoutWindowResponse;
}

function response(window: WeekScoutWindowResponse | null, verdict: "go" | "maybe" | "no" = "go"): CanonicalWeekScoutResponse {
  return {
    generatedAt: NOW.toISOString(), scorerVersion: "test", candidateFingerprint: "x",
    days: [{ localDate: window?.start.slice(0, 10) ?? "2026-11-21", windows: window ? [window] : [], bestWindowId: window?.id ?? null, bestDayWindow: window, exclusionReasons: [] }],
    sessionDecision: { verdict, selection: window ? { candidateId: window.id } : null },
  } as unknown as CanonicalWeekScoutResponse;
}

function deps(overrides: Partial<ActivationCallDeps> = {}): ActivationCallDeps & { generate: jest.Mock } {
  return {
    readViewedBeachIds: jest.fn(async () => [VIEWED, HOME, VIEWED]),
    readBeach: jest.fn(async (id: string) => id === VIEWED ? beachRow(VIEWED, "Capitola") : id === HOME ? beachRow(HOME, "Pleasure Point") : null),
    readSessionTime: jest.fn(async () => null),
    hasForecastFeatureAccess: jest.fn(async () => true),
    generate: jest.fn(async () => response(windowFixture())),
    ...overrides,
  } as ActivationCallDeps & { generate: jest.Mock };
}

it("ranks beaches by views, newest first on a tie", () => {
  expect(mostViewedBeachId([HOME, VIEWED, VIEWED])).toBe(VIEWED);
  expect(mostViewedBeachId([HOME, VIEWED])).toBe(HOME);
  expect(mostViewedBeachId([])).toBeNull();
});

it("reads the week's session pick for the most viewed beach over three beach-local days", async () => {
  const d = deps();
  const call = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: d });
  expect(call).toMatchObject({ kind: "window", label: "GOOD", beach: { id: VIEWED, name: "Capitola", slug: "capitola" } });
  expect(d.generate.mock.calls).toEqual([[USER, { candidateBeachIds: [VIEWED], localTimezone: "America/Los_Angeles", startLocalDate: "2026-11-19", dayCount: 3 }]]);
  expect(d.readViewedBeachIds).toHaveBeenCalledWith(USER, new Date("2026-11-12T17:00:00Z"));
});

describe("activation forecast access", () => {
  const tomorrow = windowFixture({
    id: "w-fri",
    start: "2026-11-20T15:00:00Z",
    end: "2026-11-20T18:00:00Z",
    displayWindowStart: "2026-11-20T15:00:00Z",
    displayWindowEnd: "2026-11-20T18:00:00Z",
    peakTime: "2026-11-20T16:00:00Z",
  });
  const dayThree = windowFixture();

  beforeEach(() => {
    jest.replaceProperty(process, "env", {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockCreateServiceClient.mockReset().mockImplementation(() => { throw new Error("no database in unit tests"); });
    mockGenerate.mockReset();
  });

  it.each([
    { recipient: "free with founding access off", row: null, switchOn: false, days: 2, pick: tomorrow },
    { recipient: "free with founding access on", row: null, switchOn: true, days: 3, pick: dayThree },
    { recipient: "Pro", row: { is_pro: true }, switchOn: false, days: 3, pick: dayThree },
    { recipient: "trialing", row: { is_trialing: true }, switchOn: false, days: 3, pick: dayThree },
    { recipient: "free with a billing issue", row: { billing_issue: true }, switchOn: true, days: 2, pick: tomorrow },
  ])("requests $days beach-local days for $recipient", async ({ row, switchOn, days, pick }) => {
    const rows: Record<string, unknown> = {
      beaches: beachRow(VIEWED, "Capitola"),
      profiles: { preferred_session_time: null },
      user_entitlements: row,
    };
    mockCreateServiceClient.mockImplementation(() => ({
      from: (table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: async () => ({ data: [{ beach_id: VIEWED }], error: null }),
        maybeSingle: async () => ({ data: rows[table], error: null }),
      }),
      rpc: async () => ({ data: switchOn, error: null }),
    }));
    mockGenerate.mockImplementation((_userId: string, request: WeekScoutDaysRequest) =>
      response(request.dayCount === 2 ? tomorrow : dayThree),
    );

    await jest.isolateModulesAsync(async () => {
      const { loadActivationCall: load } = await import("@/lib/email/activation-call");
      await expect(load({ userId: USER, homeBeachId: HOME, now: NOW })).resolves.toMatchObject({
        kind: "window", window: { id: pick.id, displayWindowStart: pick.displayWindowStart },
      });
    });
    expect(mockGenerate).toHaveBeenCalledWith(USER, {
      candidateBeachIds: [VIEWED], localTimezone: "America/Los_Angeles", startLocalDate: "2026-11-19", dayCount: days,
    });
  });
});

it("uses the home beach when the user viewed none", async () => {
  const d = deps({ readViewedBeachIds: jest.fn(async () => []) });
  const call = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: d });
  expect(call).toMatchObject({ kind: "window", beach: { id: HOME } });
});

it.each([
  ["EPIC", "GOOD"], ["GOOD", "GOOD"], ["FAIR", "FAIR"],
] as const)("prints %s as %s", async (personalLabel, label) => {
  const call = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: deps({ generate: jest.fn(async () => response(windowFixture({ personalLabel }))) }) });
  expect(call).toMatchObject({ kind: "window", label });
});

it.each([
  ["a call below FAIR", response(windowFixture({ personalLabel: "RIDEABLE" })), "no_call"],
  ["a no verdict", response(windowFixture(), "no"), "no_call"],
  ["no window", response(null), "no_call"],
  ["a call older than 6 h", response(windowFixture({ forecast: { ...windowFixture().forecast, freshnessAt: "2026-11-19T10:59:00Z" } })), "stale_call"],
  ["a window that closes in 20 min", response(windowFixture({ displayWindowEnd: "2026-11-19T17:20:00Z" })), "no_call"],
  ["no wave height", response(windowFixture({ forecast: { ...windowFixture().forecast, waveHeight: null } })), "no_call"],
])("falls back on %s", async (_, value, reason) => {
  const call = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: deps({ generate: jest.fn(async () => value) }) });
  expect(call).toMatchObject({ kind: "fallback", reason, beach: { id: VIEWED } });
});

it("keeps a call that is 5 h old", async () => {
  const value = response(windowFixture({ forecast: { ...windowFixture().forecast, freshnessAt: "2026-11-19T12:00:00Z" } }));
  const call = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: deps({ generate: jest.fn(async () => value) }) });
  expect(call).toMatchObject({ kind: "window" });
});

it("falls back when the forecast read fails or runs past its budget", async () => {
  const failed = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: deps({ generate: jest.fn(async () => { throw new Error("statement timeout"); }) }) });
  expect(failed).toMatchObject({ kind: "fallback", reason: "read_failed", beach: { id: VIEWED } });
  const slow = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, budgetMs: 5, deps: deps({ generate: jest.fn(() => new Promise<never>(() => {})) }) });
  expect(slow).toMatchObject({ kind: "fallback", reason: "read_failed" });
  expectConsoleWarnings([/Activation email forecast read failed/]);
});

it("names the home beach in the fallback when the view read fails", async () => {
  const d = deps({ readViewedBeachIds: jest.fn(async () => { throw new Error("connection reset"); }) });
  const call = await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: d });
  expect(call).toMatchObject({ kind: "fallback", reason: "read_failed", beach: { id: HOME } });
  expect(d.generate).not.toHaveBeenCalled();
  expectConsoleWarnings([/Activation email view read failed/]);
});

it("uses no_beach only for a user with no beach, and beach_unreadable when the beach read fails", async () => {
  expect(await loadActivationCall({ userId: USER, homeBeachId: null, now: NOW, deps: deps({ readViewedBeachIds: jest.fn(async () => []) }) })).toEqual({ kind: "no_beach", now: NOW.toISOString() });
  const unreadable = deps({ readBeach: jest.fn(async () => { throw new Error("beaches down"); }) });
  expect(await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: unreadable })).toEqual({ kind: "beach_unreadable", now: NOW.toISOString() });
  expectConsoleWarnings([/Activation email beach read failed; using the v3 copy/]);
});

it("does not turn a bug after the reads into fallback copy", async () => {
  const malformed = { days: [] } as unknown as CanonicalWeekScoutResponse;
  await expect(loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: deps({ generate: jest.fn(async () => malformed) }) })).rejects.toThrow(TypeError);
});

it("passes the user's preferred session time to Week Scout, as the Week Scout route and the Daily Call do", async () => {
  const d = deps({ readSessionTime: jest.fn(async () => "dawn_patrol" as const) });
  await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: d });
  expect(d.generate.mock.calls[0][1]).toEqual({ candidateBeachIds: [VIEWED], localTimezone: "America/Los_Angeles", startLocalDate: "2026-11-19", dayCount: 3, sessionTime: "dawn_patrol" });
});

it("falls back, without a forecast read, when the session time read fails", async () => {
  const d = deps({ readSessionTime: jest.fn(async () => { throw new Error("profiles down"); }) });
  expect(await loadActivationCall({ userId: USER, homeBeachId: HOME, now: NOW, deps: d })).toMatchObject({ kind: "fallback", reason: "read_failed", beach: { id: VIEWED } });
  expect(d.generate).not.toHaveBeenCalled();
  expectConsoleWarnings([/Activation email forecast read failed/]);
});
