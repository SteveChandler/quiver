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
jest.mock("@/lib/alerts/swell-outlook/state", () => {
  const actual = jest.requireActual<typeof import("@/lib/alerts/swell-outlook/state")>("@/lib/alerts/swell-outlook/state");
  return { ...actual, saveSwellOutlookLists: jest.fn(actual.saveSwellOutlookLists) };
});

async function finishBookkeeping(): Promise<void> {
  for (const task of mockAfterTasks.splice(0)) await task();
}

import { loadSwellOutlookForUser, type SwellOutlookLoaderDeps } from "@/lib/services/discovery/swell-outlook-loader";
import * as outlookState from "@/lib/alerts/swell-outlook/state";
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
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

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
  boardsError?: string;
  profileError?: string;
  boardsThrow?: string;
  profileThrow?: string;
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
    state: tables.state ? copy<Row>({ ...defaults, ...tables.state }) : null as Row | null,
  };
  fake.client = {
    from(table: string): FakeQueryBuilder {
      const filters: Row = {};
      let patch: Row | null = null;
      const builder: FakeQueryBuilder = {
        select: (): FakeQueryBuilder => builder,
        eq: (key: string, value: unknown): FakeQueryBuilder => { filters[key] = value; return builder; },
        update: (row: Row): FakeQueryBuilder => { patch = copy(row); return builder; },
        maybeSingle: async (): Promise<QueryResult> => {
          if (table === "profiles" && tables.profileThrow) throw new Error(tables.profileThrow);
          if (table === "profiles") return { data: tables.profile ?? null, error: tables.profileError ? { message: tables.profileError } : null };
          if (tables.stateError) return { data: null, error: { message: tables.stateError } };
          if (!patch) return { data: fake.state ? copy(fake.state) : null, error: null };
          updates.push(patch);
          if (tables.upsertError) return { data: null, error: { message: tables.upsertError } };
          if (fake.state) tables.beforeUpdate?.(fake.state);
          if (!fake.state || Object.entries(filters).some(([key, value]) => fake.state?.[key] !== value)) {
            return { data: null, error: null };
          }
          fake.state = copy({ ...fake.state, ...patch,
            updated_at: new Date(Date.parse(String(fake.state.updated_at)) + 1).toISOString() });
          return { data: { user_id: USER }, error: null };
        },
        upsert: async (row: Row, options: Row): Promise<{ error: { message: string } | null }> => {
          upserts.push(copy(row));
          if (tables.upsertError) return { error: { message: tables.upsertError } };
          if (!fake.state) fake.state = copy({ ...defaults, ...row });
          else if (!options.ignoreDuplicates) fake.state = copy({ ...fake.state, ...row });
          return { error: null };
        },
        then: (resolve: (value: unknown) => unknown): unknown => {
          if (table === "boards" && tables.boardsThrow) throw new Error(tables.boardsThrow);
          return resolve({ data: tables.boards ?? [], error: tables.boardsError ? { message: tables.boardsError } : null });
        },
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
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
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

  it("uses the default skill band when no boards are recorded", async () => {
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, boards: [] }).client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0].fit).toEqual({ status: "in_range", boards: [] });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["returned error", { boardsError: "boards unavailable" }],
    ["query rejection", { boardsThrow: "boards unavailable" }],
  ])("answers with unknown fit and warns once for a boards %s", async (_name: string, failure: { boardsError?: string; boardsThrow?: string }) => {
    const client = fakeClient({ profile: PROFILE, ...failure });
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0].fit).toEqual({ status: "unknown", boards: [] });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("[swell-outlook] board read failed; fit unknown", "boards unavailable");
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(client.upserts).toEqual([]);
    expect(client.updates).toEqual([]);
  });

  it.each([
    ["returned error", { profileError: "profile unavailable" }],
    ["query rejection", { profileThrow: "profile unavailable" }],
  ])("answers with unknown fit and warns once for a profile/skill %s", async (_name: string, failure: { profileError?: string; profileThrow?: string }) => {
    const loaders = deps({ loadPool: jest.fn(async () => [{ beach: homeBeach, relation: "favorite" as const, distanceMiles: null }]) });
    const client = fakeClient({ profile: PROFILE, ...failure, boards: [{ board_type: "fish" }] });
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: loaders });
    await finishBookkeeping();
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0].fit).toEqual({ status: "unknown", boards: [] });
    expect(response.homeBeach).toBeNull();
    expect(loaders.loadPool).toHaveBeenCalledWith(expect.objectContaining({ homeBeachId: null, location: null, maxDriveMinutes: null }));
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith("[swell-outlook] profile read failed; fit unknown", "profile unavailable");
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(client.upserts).toEqual([]);
    expect(client.updates).toEqual([]);
  });

  it.each([
    ["boards", { boardsError: "boards unavailable" }],
    ["profile", { profileError: "profile unavailable" }],
  ])("keeps the stored list after a %s error, then writes real fit after recovery", async (
    _kind: string, failure: { boardsError?: string; profileError?: string },
  ) => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const tables = { profile: PROFILE, state: first.state, ...failure };
    const client = fakeClient(tables);
    const stored = copy(client.state);
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
    const loaders = deps({ loadSnapshots: jest.fn(async (_client, _ids, _since, version) => version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION ? [pulse({ peakFaceHeightFt: 5 })] : []) });
    const degraded = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: loaders });
    await finishBookkeeping();
    expect(degraded.swells[0].fit).toEqual({ status: "unknown", boards: [] });
    expect(client.state).toEqual(stored);
    expect(client.updates).toEqual([]);
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    delete tables.boardsError;
    delete tables.profileError;
    const recovered = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: loaders });
    await finishBookkeeping();
    expect(recovered.swells[0].fit).toEqual({ status: "in_range", boards: [] });
    expect(client.updates).toHaveLength(1);
    expect(outlookState.saveSwellOutlookLists).toHaveBeenCalledTimes(1);
    expect(client.state?.outlook_list).toEqual({ runDate: recovered.runDate, swells: recovered.swells });
  });

  it.each([
    ["boards", { boardsError: "boards unavailable" }],
    ["profile", { profileError: "profile unavailable" }],
  ])("records an open independently of a degraded %s list", async (
    _kind: string, failure: { boardsError?: string; profileError?: string },
  ) => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const client = fakeClient({ profile: PROFILE, state: { ...first.state, consecutive_unanswered: 2, last_sent_at: "2026-09-24T10:00:00.000Z" }, ...failure });
    const stored = copy(client.state?.outlook_list);
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
    await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    expect(client.updates).toEqual([]);
    await finishBookkeeping();
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(client.updates).toEqual([{ consecutive_unanswered: 0, last_answered_at: NOW.toISOString() }]);
    expect(client.state?.outlook_list).toEqual(stored);
    expect(client.state?.last_sent_at).toBe("2026-09-24T10:00:00.000Z");
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
    const updatedAt = quiet.state?.updated_at;
    await loadSwellOutlookForUser({ client: quiet.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(quiet.updates).toHaveLength(1);
    expect(quiet.state?.updated_at).toBe(updatedAt);
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

  it.each([
    ["boards", "shrinking", { boardsError: "boards unavailable" }, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    ["boards", "faded", { boardsError: "boards unavailable" }, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    ["boards", "arrived", { boardsError: "boards unavailable" }, new Date("2026-09-28T20:00:00.000Z")],
    ["profile", "shrinking", { profileError: "profile unavailable" }, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    ["profile", "faded", { profileError: "profile unavailable" }, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)],
    ["profile", "arrived", { profileError: "profile unavailable" }, new Date("2026-09-28T20:00:00.000Z")],
  ])("returns unknown carried fit without storing it after a %s error for a %s swell", async (
    _kind: string,
    status: string,
    failure: { boardsError?: string; profileError?: string },
    now: Date,
  ) => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect((first.state?.outlook_list as { swells: Array<{ fit: { status: string } }> }).swells[0].fit.status).toBe("in_range");
    const second = fakeClient({ profile: PROFILE, state: first.state, ...failure });
    const stored = copy(second.state);
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
    const rows = status === "shrinking" ? dayRows(3, { heightFt: 2.5, periodS: 14, direction: 270 }) : [];
    const response = await loadSwellOutlookForUser({
      client: second.client, userId: USER, now, recordOpen: true,
      deps: deps({ loadSnapshots: jest.fn(async () => []), loadForecasts: jest.fn(async () => new Map([[HOME, rows]])) }),
    });
    await finishBookkeeping();
    expect(response.swells).toHaveLength(1);
    expect(response.swells[0].status).toBe(status);
    expect(response.swells[0].fit).toEqual({ status: "unknown", boards: [] });
    expect(second.state).toEqual(stored);
    expect(second.upserts).toEqual([]);
    expect(second.updates).toEqual([]);
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("preserves shrinking entries outside a pool shrunken by a profile failure", async () => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const loaders = deps({
      loadPool: jest.fn(async ({ homeBeachId }) => homeBeachId ? [{ beach: homeBeach, relation: "home" as const, distanceMiles: null }] : []),
      loadSnapshots: jest.fn(async () => []),
      loadForecasts: jest.fn(async () => new Map([[HOME, dayRows(3, { heightFt: 4, periodS: 14, direction: 270 })]])),
    });
    const shrinking = await loadSwellOutlookForUser({ client: first.client, userId: USER, now: tomorrow, recordOpen: false, deps: loaders });
    expect(shrinking.swells[0]).toMatchObject({ status: "shrinking", fit: { status: "in_range" } });
    const tables = { profile: PROFILE, state: first.state, profileError: "profile unavailable" as string | undefined };
    const client = fakeClient(tables);
    const stored = copy(client.state);
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
    const nextDay = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
    jest.mocked(loaders.loadForecasts).mockClear();
    const degraded = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: nextDay, recordOpen: true, deps: loaders });
    await finishBookkeeping();
    expect(degraded.swells).toEqual([expect.objectContaining({ id: shrinking.swells[0].id, status: "faded", fit: { status: "unknown", boards: [] } })]);
    expect(loaders.loadForecasts).not.toHaveBeenCalled();
    expect(client.state).toEqual(stored);
    expect(client.updates).toEqual([]);
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    delete tables.profileError;
    const recovered = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: nextDay, recordOpen: true, deps: loaders });
    await finishBookkeeping();
    expect(recovered.swells[0]).toMatchObject({ id: shrinking.swells[0].id, status: "shrinking", fit: { status: "in_range" } });
    expect(client.updates).toHaveLength(1);
    expect(client.state?.outlook_list).toEqual({ runDate: recovered.runDate, swells: recovered.swells });
  });

  it.each([
    ["boards", { boardsError: "boards unavailable" }],
    ["profile", { profileError: "profile unavailable" }],
  ])("does not store a degraded %s list in non-GET mode", async (
    _kind: string, failure: { boardsError?: string; profileError?: string },
  ) => {
    const client = fakeClient({ profile: PROFILE, ...failure });
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(response.swells[0].fit.status).toBe("unknown");
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(client.upserts).toEqual([]);
    expect(client.updates).toEqual([]);
  });

  it("writes only once for two identical outlook GET builds", async () => {
    const client = fakeClient({ profile: PROFILE });
    const first = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(client.updates).toHaveLength(1);
    const updatedAt = client.state?.updated_at;
    const second = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    await finishBookkeeping();
    expect(second).toEqual(first);
    expect(client.updates).toHaveLength(1);
    expect(client.state?.updated_at).toBe(updatedAt);
    expect(console.warn).not.toHaveBeenCalled();
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
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("skips list persistence after a transient state read error but still records the open", async () => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const tables = { profile: PROFILE, state: { ...first.state, consecutive_unanswered: 2, last_sent_at: "2026-09-24T10:00:00.000Z" }, stateError: "state unavailable" as string | undefined };
    const client = fakeClient(tables);
    const stored = copy(client.state?.outlook_list);
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
    const response = await loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    expect(response.swells).toHaveLength(1);
    delete tables.stateError;
    await finishBookkeeping();
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(client.updates).toEqual([{ consecutive_unanswered: 0, last_answered_at: NOW.toISOString() }]);
    expect(client.state?.outlook_list).toEqual(stored);
  });

  it.each(["pool", "pulse snapshots", "notable snapshots", "forecast rows"])("rejects a failed required %s read without persisting an empty list", async (kind: string) => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first.client, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const client = fakeClient({ profile: PROFILE, state: first.state });
    const stored = copy(client.state);
    jest.mocked(outlookState.saveSwellOutlookLists).mockClear();
    const loaders = deps({ loadSnapshots: jest.fn(async () => []) });
    if (kind === "pool") loaders.loadPool = jest.fn(async () => { throw new Error("required read failed"); });
    if (kind === "forecast rows") loaders.loadForecasts = jest.fn(async () => { throw new Error("required read failed"); });
    if (kind.includes("snapshots")) loaders.loadSnapshots = jest.fn(async (_client, _ids, _since, version) => {
      if ((kind === "pulse snapshots") === (version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)) throw new Error("required read failed");
      return [];
    });
    await expect(loadSwellOutlookForUser({ client: client.client, userId: USER, now: new Date(NOW.getTime() + 24 * 60 * 60 * 1000), recordOpen: true, deps: loaders })).rejects.toThrow("required read failed");
    expect(client.state).toEqual(stored);
    expect(client.updates).toEqual([]);
    expect(outlookState.saveSwellOutlookLists).not.toHaveBeenCalled();
    expect(mockAfterTasks).toEqual([]);
  });


  it("rejects non-GET loads when engagement state cannot be read so senders skip the user", async () => {
    const client = fakeClient({ profile: PROFILE, stateError: "state unavailable" });
    await expect(loadSwellOutlookForUser({ client: client.client, userId: USER, now: NOW, recordOpen: false, deps: deps() })).rejects.toThrow("state unavailable");
    expect(client.upserts).toEqual([]);
    expect(mockAfterTasks).toEqual([]);
  });

});
