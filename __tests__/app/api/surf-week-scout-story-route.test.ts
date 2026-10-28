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
  loadAndBindStory: (...args: unknown[]) => mockStory(...args),
  bindStory: jest.fn(),
}));
jest.mock("@/lib/services/discovery/week-scout-notes-serve", () => ({
  isWeekScoutNotesUser: () => false,
  liveWeekScoutNotes: jest.fn(),
  loadWeekScoutNotesEdition: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({})) }));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/surf/week-scout/route";
import { WEEK_SCOUT_CONTRACT_BEACH_ID, WEEK_SCOUT_CONTRACT_FIXTURE } from "@/__tests__/fixtures/week-scout-contract";

const request = (): NextRequest => new NextRequest("http://localhost/api/surf/week-scout", {
  method: "POST", body: JSON.stringify({ candidateBeachIds: [WEEK_SCOUT_CONTRACT_BEACH_ID],
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
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-10-27T12:00:00Z"));
    mockForecast.mockResolvedValue(WEEK_SCOUT_CONTRACT_FIXTURE);
    delete process.env.WEEK_SCOUT_STORY_ENABLED;
  });
  afterEach(() => { delete process.env.WEEK_SCOUT_STORY_ENABLED; jest.useRealTimers(); });

  it("keeps the complete response byte-identical when the flag is absent or false", async () => {
    const absent = await call(null);
    process.env.WEEK_SCOUT_STORY_ENABLED = "false";
    const disabled = await call(null);
    expect(disabled.raw).toBe(absent.raw);
    expect(disabled.data).not.toHaveProperty("story");
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
});
