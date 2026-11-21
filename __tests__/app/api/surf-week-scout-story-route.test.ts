/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withAuth: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));
const mockForecast = jest.fn();
jest.mock("@/lib/services/discovery/week-scout", () => ({
  generateWeekScoutForecast: (...args: unknown[]) => mockForecast(...args),
}));
const mockStory = jest.fn();
jest.mock("@/lib/services/discovery/week-scout-story-serve", () => ({
  isWeekScoutStoryEnabled: () => process.env.WEEK_SCOUT_STORY_ENABLED === "true",
  prepareStory: async (args: Record<string, unknown>) => (live: unknown) => mockStory({ ...args, live }),
  bindStory: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({})) }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/surf/week-scout/route";
import { resetWeekScoutAnswerReuseForTests } from "@/lib/services/discovery/week-scout-answer-reuse";
import { WEEK_SCOUT_CONTRACT_BEACH_ID, WEEK_SCOUT_CONTRACT_FIXTURE } from "@/__tests__/fixtures/week-scout-contract";

const request = (headers: Record<string, string> = {}): NextRequest => new NextRequest("http://localhost/api/surf/week-scout", {
  method: "POST", headers, body: JSON.stringify({ candidateBeachIds: [WEEK_SCOUT_CONTRACT_BEACH_ID],
    localTimezone: "Pacific/Honolulu", startLocalDate: "2026-07-15", dayCount: 7 }),
});
const context = (homeBeachId: string | null): unknown => ({
  user: { id: "story-user" }, params: {},
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: { home_beach_id: homeBeachId, max_drive_minutes: null }, error: null,
  }) }) }) }) },
});
const storyDays = (live: typeof WEEK_SCOUT_CONTRACT_FIXTURE) => live.days.slice(0, 7).map((day) => {
  const pick = day.bestDayWindow;
  return { localDate: day.localDate, pick: pick ? {
    windowId: pick.id, beachId: pick.beachId, bucket: pick.bucket, verdict: pick.verdict,
    conditionScore: pick.conditionScore, displayWindowStart: pick.displayWindowStart,
    displayWindowEnd: pick.displayWindowEnd, waveHeight: pick.forecast.waveHeight,
  } : null };
});
const call = async (homeBeachId: string | null): Promise<{ raw: string; data: Record<string, unknown> }> => {
  const response = await POST(request(), context(homeBeachId) as never);
  const raw = await response.text();
  return { raw, data: JSON.parse(raw).data };
};

describe("Week Scout story response", () => {
  beforeEach(() => {
    // Each test asks the same question with different mocks; never reuse across tests.
    resetWeekScoutAnswerReuseForTests();
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-10-27T12:00:00Z"));
    mockForecast.mockResolvedValue(WEEK_SCOUT_CONTRACT_FIXTURE);
    delete process.env.WEEK_SCOUT_STORY_ENABLED;
  });
  afterEach(() => {
    delete process.env.WEEK_SCOUT_STORY_ENABLED;
    delete process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST;
    jest.useRealTimers();
  });

  it("serves the story only to an allowlisted user when an allowlist is set", async () => {
    const absent = await call(WEEK_SCOUT_CONTRACT_BEACH_ID);
    process.env.WEEK_SCOUT_STORY_ENABLED = "true";
    mockStory.mockImplementation(async ({ live }: { live: typeof WEEK_SCOUT_CONTRACT_FIXTURE }) => ({
      schemaVersion: 3, region: "south-shore", availability: "ready",
      cover: { text: "A south swell approaches.", swells: [] }, lead: "The week builds.", turn: null,
      chapters: [], days: storyDays(live),
    }));
    process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = "someone-else, another-user";
    const offList = await call(WEEK_SCOUT_CONTRACT_BEACH_ID);
    expect(offList.raw).toBe(absent.raw);
    expect(mockStory).not.toHaveBeenCalled();

    process.env.WEEK_SCOUT_STORY_USER_ALLOWLIST = "someone-else, story-user";
    const onList = await call(WEEK_SCOUT_CONTRACT_BEACH_ID);
    expect((onList.data.story as { availability: string }).availability).toBe("ready");
  });

  it("keeps the complete response byte-identical when the flag is absent or false", async () => {
    const absent = await call(null);
    process.env.WEEK_SCOUT_STORY_ENABLED = "false";
    const disabled = await call(null);
    expect(disabled.raw).toBe(absent.raw);
    expect(disabled.data).not.toHaveProperty("story");
    expect(absent.raw).not.toMatch(/"glance"/);
    expect(mockStory).not.toHaveBeenCalled();
  });

  it("adds covered prose with live picks when the flag is enabled", async () => {
    process.env.WEEK_SCOUT_STORY_ENABLED = "true";
    mockStory.mockImplementation(async ({ live }: { live: typeof WEEK_SCOUT_CONTRACT_FIXTURE }) => ({
      schemaVersion: 3, region: "south-shore", availability: "ready",
      cover: { text: "A south swell approaches.", swells: [] }, lead: "The week builds.", turn: null,
      chapters: [], days: storyDays(live),
    }));
    const { data } = await call(WEEK_SCOUT_CONTRACT_BEACH_ID);
    expect((data.story as { availability: string }).availability).toBe("ready");
    expect((data.story as { days: Array<{ pick: unknown }> }).days[0].pick).toMatchObject({ windowId: "window-a", beachId: WEEK_SCOUT_CONTRACT_BEACH_ID });
    expect(JSON.stringify(data.story)).not.toMatch(/freshness|generatedAt|validUntil/);
    expect(mockForecast.mock.calls[0][1]).toMatchObject({ includeSwells: true });
  });

  it("keeps picks and null narrative for a user without a home beach", async () => {
    process.env.WEEK_SCOUT_STORY_ENABLED = "true";
    mockStory.mockImplementation(async ({ live }: { live: typeof WEEK_SCOUT_CONTRACT_FIXTURE }) => ({
      schemaVersion: 3, region: null, availability: "outside_region",
      cover: { text: null, swells: [] }, lead: null, turn: null, chapters: [],
      days: storyDays(live),
    }));
    const { data } = await call(null);
    expect(data.story).toMatchObject({ region: null, availability: "outside_region", lead: null, cover: { text: null } });
    expect((data.story as { days: Array<{ pick: unknown }> }).days[0].pick).toMatchObject({ windowId: "window-a", beachId: WEEK_SCOUT_CONTRACT_BEACH_ID });
  });

  it("reports stage timings in a Server-Timing header without changing the body", async () => {
    process.env.WEEK_SCOUT_STORY_ENABLED = "true";
    mockStory.mockImplementation(async ({ live }: { live: typeof WEEK_SCOUT_CONTRACT_FIXTURE }) => ({
      schemaVersion: 3, region: null, availability: "outside_region",
      cover: { text: null, swells: [] }, lead: null, turn: null, chapters: [], days: storyDays(live),
    }));
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(request({ "x-quiver-platform": "ios", "x-quiver-update-id": "f933afba" }), context(null) as never);
    const names = (response.headers.get("Server-Timing") ?? "").split(", ").map((entry) => entry.split(";")[0]);
    expect(names).toEqual(expect.arrayContaining(["profile", "pool", "story-load", "forecast", "story-bind", "serialize", "total"]));
    expect(names[names.length - 1]).toBe("total");
    expect(JSON.parse(await response.text()).data).not.toHaveProperty("timings");
    const line = info.mock.calls.map(([message]) => String(message)).find((message) => message.startsWith("[WeekScoutTiming] "));
    expect(JSON.parse(line!.slice("[WeekScoutTiming] ".length))).toMatchObject({
      status: 200, cold: expect.any(Boolean), inflight: 1, stages: expect.any(Array),
      dayCount: 7, platform: "ios", update: "f933afba", user: expect.stringMatching(/^[0-9a-f]{8}$/), candidates: 1,
    });
    info.mockRestore();
  });
  it("ranks once for two identical requests and again when an input changes", async () => {
    resetWeekScoutAnswerReuseForTests();
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const reuseOf = () => info.mock.calls.map(([message]) => String(message))
      .filter((message) => message.startsWith("[WeekScoutTiming] "))
      .map((message) => JSON.parse(message.slice("[WeekScoutTiming] ".length)).answerReuse);
    const [first, second] = await Promise.all([POST(request(), context(null) as never), POST(request(), context(null) as never)]);
    expect(mockForecast).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await second.text())).toEqual(JSON.parse(await first.text()));
    await POST(request(), context("home-b") as never);
    expect(mockForecast).toHaveBeenCalledTimes(2);
    expect(reuseOf().sort()).toEqual(["joined", "miss", "miss"]);
    info.mockRestore();
  });
  it("logs input keys that change only when that input changes", async () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const keyed = (body: Record<string, unknown>, homeBeachId: string | null, lat: number) => ({
      user: { id: "story-user" }, params: {},
      supabase: { from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: table === "user_location_snapshots"
          ? { lat, lon: -157.8, captured_at: "2026-10-01T00:00:00Z" }
          : { home_beach_id: homeBeachId, max_drive_minutes: 30 },
        error: null,
      }) }) }) }) },
      body,
    });
    const base = { candidateBeachIds: [WEEK_SCOUT_CONTRACT_BEACH_ID], localTimezone: "Pacific/Honolulu", startLocalDate: "2026-07-15", dayCount: 7 };
    const keysFor = async (body: Record<string, unknown>, homeBeachId: string | null, lat: number) => {
      info.mockClear();
      const req = new NextRequest("http://localhost/api/surf/week-scout", { method: "POST", body: JSON.stringify(body) });
      await POST(req, keyed(body, homeBeachId, lat) as never);
      const line = info.mock.calls.map(([message]) => String(message)).find((message) => message.startsWith("[WeekScoutTiming] "));
      const { bodyKey, profileKey, locKey } = JSON.parse(line!.slice("[WeekScoutTiming] ".length));
      return { bodyKey, profileKey, locKey };
    };
    const first = await keysFor(base, "home-a", 21.301);
    expect(first).toEqual({
      bodyKey: expect.stringMatching(/^[0-9a-f]{8}$/),
      profileKey: expect.stringMatching(/^[0-9a-f]{8}$/),
      locKey: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
    // Same inputs, a move inside the same 2-decimal bucket, and a different horizon keep every key.
    expect(await keysFor({ ...base, dayCount: 10 }, "home-a", 21.302)).toEqual(first);
    expect(await keysFor({ ...base, startLocalDate: "2026-07-16" }, "home-a", 21.301))
      .toEqual({ ...first, bodyKey: expect.not.stringMatching(first.bodyKey) });
    expect(await keysFor(base, "home-b", 21.301))
      .toEqual({ ...first, profileKey: expect.not.stringMatching(first.profileKey) });
    expect(await keysFor(base, "home-a", 21.33))
      .toEqual({ ...first, locKey: expect.not.stringMatching(first.locKey) });
    info.mockRestore();
  });
});
