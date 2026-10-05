/**
 * @jest-environment node
 */
// __tests__/lib/services/discovery/swell-outlook-loader.test.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const mockAfterTasks: Array<() => Promise<void>> = [];
jest.mock("next/server", () => ({
  after: (task: () => Promise<void>): void => { mockAfterTasks.push(task); },
}));

async function finishBookkeeping(): Promise<void> {
  for (const task of mockAfterTasks.splice(0)) await task();
}

import { loadSwellOutlookForUser, type SwellOutlookLoaderDeps } from "@/lib/services/discovery/swell-outlook-loader";
import { SWELL_OUTLOOK_PULSE_DETECTOR_VERSION, type SwellEventForecastRow, type SwellEventSnapshot } from "@/lib/alerts/swell-events";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { NOW, TIMEZONE, dayRows } from "@/__tests__/helpers/swell-events";

const USER = "eeeeeeee-0000-4000-8000-000000000001";
const HOME = "eeeeeeee-0000-4000-8000-0000000000a1";

const homeBeach = createMockBeach({
  id: HOME, name: "Home Beach", slug: "home-beach", timezone: TIMEZONE, swell_window_center_deg: 270, swell_window_halfwidth_deg: 30,
});

function pulse(overrides: Partial<SwellEventSnapshot> = {}): SwellEventSnapshot {
  return {
    beachId: HOME, eventKey: `${HOME}:W:2026-09-28:p`, detectorVersion: SWELL_OUTLOOK_PULSE_DETECTOR_VERSION, runDate: "2026-09-25",
    detectedAt: "2026-09-25T14:30:00.000Z", directionDeg: 270, directionBand: "W", periodS: 14, peakOffshoreHeightFt: 3,
    peakFaceHeightFt: 4, exposure: 1, energyRatio: 5, arrivalAt: "2026-09-28T07:00:00.000Z", peakAt: "2026-09-28T19:00:00.000Z",
    fadeAt: "2026-09-29T07:00:00.000Z", crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
    ...overrides,
  };
}

type Row = Record<string, unknown>;
type QueryResult = { data: Row | null; error: { message: string } | null };
interface FakeQueryBuilder {
  select: () => FakeQueryBuilder;
  eq: (key: string, value: unknown) => FakeQueryBuilder;
  update: (row: Row) => FakeQueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
  upsert: (row: Row, options: Row) => Promise<{ error: { message: string } | null }>;
  then: (resolve: (value: unknown) => unknown) => unknown;
}

function fakeClient(tables: {
  profile?: Row | null;
  boards?: Array<{ board_type: string }>;
  state?: Row | null;
  upsertError?: string;
  stateError?: string;
  beforeUpdate?: (row: Row) => void;
}): {
  client: SupabaseClient<Database>;
  upserts: Row[];
  updates: Row[];
  state: Row | null;
} {
  const upserts: Row[] = [];
  const updates: Row[] = [];
  const defaults = { user_id: USER, updated_at: "2026-09-25T14:00:00.000Z", consecutive_unanswered: 0 };
  const fake = {
    client: {} as SupabaseClient<Database>, upserts, updates,
    state: tables.state ? { ...defaults, ...tables.state } : null as Row | null,
  };
  fake.client = {
    from(table: string): FakeQueryBuilder {
      const filters: Row = {};
      let patch: Row | null = null;
      const builder: FakeQueryBuilder = {
        select: (): FakeQueryBuilder => builder,
        eq: (key: string, value: unknown): FakeQueryBuilder => { filters[key] = value; return builder; },
        update: (row: Row): FakeQueryBuilder => { patch = row; return builder; },
        maybeSingle: async (): Promise<QueryResult> => {
          if (table === "profiles") return { data: tables.profile ?? null, error: null };
          if (tables.stateError) return { data: null, error: { message: tables.stateError } };
          if (!patch) return { data: fake.state ? { ...fake.state } : null, error: null };
          updates.push(patch);
          if (tables.upsertError) return { data: null, error: { message: tables.upsertError } };
          if (fake.state) tables.beforeUpdate?.(fake.state);
          if (!fake.state || Object.entries(filters).some(([key, value]) => fake.state?.[key] !== value)) {
            return { data: null, error: null };
          }
          fake.state = { ...fake.state, ...patch,
            updated_at: new Date(Date.parse(String(fake.state.updated_at)) + 1).toISOString() };
          return { data: { user_id: USER }, error: null };
        },
        upsert: async (row: Row, options: Row): Promise<{ error: { message: string } | null }> => {
          upserts.push(row);
          if (tables.upsertError) return { error: { message: tables.upsertError } };
          if (!fake.state) fake.state = { ...defaults, ...row };
          else if (!options.ignoreDuplicates) Object.assign(fake.state, row);
          return { error: null };
        },
        then: (resolve: (value: unknown) => unknown): unknown => resolve({ data: tables.boards ?? [], error: null }),
      };
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
  return fake;
}

const PROFILE = { home_beach_id: HOME, max_drive_minutes: 30, experience_level: "advanced", user_location_snapshots: null };

function deps(overrides: Partial<SwellOutlookLoaderDeps> = {}): SwellOutlookLoaderDeps {
  return {
    loadPool: jest.fn(async () => [{ beach: homeBeach, relation: "home" as const, distanceMiles: null }]),
    loadSnapshots: jest.fn(async (_client, _ids, _since, version) => (version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION ? [pulse()] : [])),
    loadForecasts: jest.fn(async () => new Map<string, SwellEventForecastRow[]>()),
    getStorms: jest.fn(async () => []),
    ...overrides,
  };
}

describe("loadSwellOutlookForUser", () => {
  beforeEach(() => {
    mockAfterTasks.length = 0;
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  it("returns an empty list for a user with no pool and reads no snapshots", async () => {
    const client = fakeClient({ profile: { ...PROFILE, home_beach_id: null } });
    const loaders = deps({ loadPool: jest.fn(async () => []) });
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: loaders });
    expect(response).toMatchObject({ homeBeach: null, swells: [], horizonDays: 9 });
    expect(loaders.loadSnapshots).not.toHaveBeenCalled();
    await finishBookkeeping();
    expect(client.upserts).toEqual([]);
    expect(client.updates).toEqual([]);
  });

  it("returns an empty list for a user without a profile row", async () => {
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: null }).client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(response.swells).toEqual([]);
  });

  it("ignores boards that do not map to a class instead of treating them as foamies", async () => {
    const unknown = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, boards: [{ board_type: "gizmo" }] }).client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(unknown.swells[0].fit).toEqual({ status: "in_range", boards: [] });
    const mixed = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, boards: [{ board_type: "Fish" }, { board_type: "shortboard" }, { board_type: "gizmo" }] }).client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(mixed.swells[0].fit).toEqual({ status: "in_range", boards: ["fish", "shortboard"] });
  });

  it("lists a swell without a skill level and marks fit unknown", async () => {
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: { ...PROFILE, experience_level: null } }).client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(response.swells[0].fit.status).toBe("unknown");
  });

  it("responds normally when the storm feed rejects", async () => {
    const tropicalCandidate = pulse({ fadeAt: "2026-10-02T07:00:00.000Z", directionDeg: 170, directionBand: "S", periodS: 12, eventKey: `${HOME}:S:2026-10-01:p`, peakAt: "2026-10-01T19:00:00.000Z", arrivalAt: "2026-10-01T07:00:00.000Z" });
    const response = await loadSwellOutlookForUser({
      client: fakeClient({ profile: PROFILE }).client, userId: USER, now: NOW, recordOpen: false,
      deps: deps({
        loadSnapshots: jest.fn(async (_c, _i, _s, version) => (version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION ? [tropicalCandidate] : [])),
        getStorms: jest.fn(async () => { throw new Error("feed down"); }),
      }),
    });
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0].source).toBe("unknown");
    expect(response.swells[0].stormName).toBeNull();
  });

  it("stores the list, and records the open only when asked", async () => {
    const pending = { user_id: USER, consecutive_unanswered: 2, last_sent_at: "2026-09-24T10:00:00.000Z" };
    const quiet = fakeClient({ profile: PROFILE, state: pending });
    await loadSwellOutlookForUser({ client: quiet.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(quiet.state).toMatchObject({ consecutive_unanswered: 2, outlook_list: { runDate: "2026-09-25" } });
    expect(quiet.updates).toEqual([expect.objectContaining({ outlook_list: expect.any(Object) })]);
    expect(quiet.updates[0]).not.toHaveProperty("consecutive_unanswered");
    expect(quiet.state).not.toHaveProperty("last_answered_at");
    const opened = fakeClient({ profile: PROFILE, state: pending });
    await loadSwellOutlookForUser({ client: opened.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(opened.state).toMatchObject({ consecutive_unanswered: 0, last_answered_at: NOW.toISOString() });
  });

  it("still answers when the state write fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, upsertError: "db down" }).client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(response.swells).toHaveLength(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("keeps yesterday's swell as shrinking when today's run lost it but the rows still show 2 ft or more", async () => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const stored = first.state;

    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const rows = [2, 3, 4].flatMap((day) => dayRows(day, { heightFt: 2.5, periodS: 14, direction: 270 }));
    const second = await loadSwellOutlookForUser({
      client: fakeClient({ profile: PROFILE, state: stored }).client, userId: USER, now: tomorrow, recordOpen: false,
      deps: deps({ loadSnapshots: jest.fn(async () => []), loadForecasts: jest.fn(async () => new Map([[HOME, rows]])) }),
    });
    expect(second.runDate).toBe("2026-09-26");
    expect(second.swells[0]).toMatchObject({ status: "shrinking", change: "downgraded" });
  });

  it("defers GET bookkeeping until after the response", async () => {
    const client = fakeClient({ profile: PROFILE });
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    expect(response.swells).toHaveLength(1);
    expect(client.upserts).toEqual([]);
    expect(client.updates).toEqual([]);
    expect(mockAfterTasks).toHaveLength(1);
    await finishBookkeeping();
    expect(client.state?.outlook_list).toMatchObject({ runDate: "2026-09-25" });
  });

  it("preserves a concurrent send when persisting only the list", async () => {
    let changed = false;
    const client = fakeClient({
      profile: PROFILE,
      state: { consecutive_unanswered: 1, last_sent_at: "2026-09-24T10:00:00.000Z" },
      beforeUpdate: (row: Row): void => {
        if (changed) return;
        changed = true;
        row.consecutive_unanswered = 2;
        row.last_sent_at = NOW.toISOString();
        row.updated_at = NOW.toISOString();
      },
    });
    await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(client.state).toMatchObject({ consecutive_unanswered: 2, last_sent_at: NOW.toISOString(), outlook_list: { runDate: "2026-09-25" } });
    expect(client.updates).toHaveLength(2);
    expect(client.updates.every((patch) => !('consecutive_unanswered' in patch))).toBe(true);
  });

  it("returns the outlook without sticky tracking when state reads fail", async () => {
    const client = fakeClient({ profile: PROFILE, stateError: "state unavailable" });
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(response.swells).toHaveLength(1);
    expect(client.upserts).toEqual([]);
    expect(client.updates).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });


  it("rejects non-GET loads when engagement state cannot be read so senders skip the user", async () => {
    const client = fakeClient({ profile: PROFILE, stateError: "state unavailable" });
    await expect(loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: false, deps: deps() })).rejects.toThrow("state unavailable");
    expect(client.upserts).toEqual([]);
    expect(mockAfterTasks).toEqual([]);
  });

});
