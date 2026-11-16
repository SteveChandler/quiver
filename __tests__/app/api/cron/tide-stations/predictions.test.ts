/** @jest-environment node */
import { GET } from "@/app/api/cron/tide-stations/predictions/route";
import { NoaaTideRequestError } from "@/lib/services/noaa-coops/datagetter";
import { fetchHighLowTidePredictions, fetchHourlyTidePredictions } from "@/lib/services/noaa-tide-service";
import { createPublicReadClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStationSeries } from "@/lib/tide-stations/predictions";
import type { TideStationPredictionRow, TideStationRow } from "@/lib/tide-stations/types";
import * as Sentry from "@sentry/nextjs";

jest.mock("@/lib/services/noaa-tide-service", () => ({
  fetchHighLowTidePredictions: jest.fn(),
  fetchHourlyTidePredictions: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
  createPublicReadClient: jest.fn(),
}));
jest.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>) => load }));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));
jest.mock("@/lib/cron/observability", () => ({
  observedCronRun: { getStore: () => undefined },
  withObservedCron: (_job: string, handler: (request: Request) => Promise<Response>) => handler,
}));
jest.mock("@/lib/middleware/api-wrappers/error-cache-wrapper", () => ({
  withErrorNoStore: (handler: (request: Request) => Promise<Response>) => handler,
}));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: () => true,
  createSuccessResponse: (data: unknown) => Response.json({ data }),
  createErrorResponse: (message: string, _details: unknown, status: number) => Response.json({ error: message }, { status }),
}));

type Candidate = {
  id: string;
  source_station_id: string;
  station_kind: "reference" | "subordinate";
  coverage_end: string | null;
  attempted_at?: string | null;
  outcome?: string | null;
};
type Attempt = { station_id: string; attempted_at: string; outcome: string };
type CoverageRow = Candidate & { attempted_at: string | null; outcome: string | null; never_attempted: boolean };
const NOW = Date.parse("2026-11-16T12:00:00Z");
const DAY_MS = 86_400_000;
const candidate = (id: string, kind: "reference" | "subordinate", end: string | null = null): Candidate => ({
  id: `noaa:${id}`, source_station_id: id, station_kind: kind, coverage_end: end,
});
const hilo = [{ ts: "2026-12-31T00:00:00Z", tide_height_m: 1.2345, type: "high" as const }];
const hourly = [{ ts: "2026-12-31T01:00:00Z", tide_height_m: 1.1111, tide_phase: null }];

function mockDatabase(stations: Candidate[], upsertError: string | null = null): {
  upserts: TideStationPredictionRow[][];
  deletes: Array<{ stationId: string; cutoff: string }>;
  orders: string[];
  coverageFilters: string[];
  conflictTargets: string[];
  attempts: Map<string, Attempt>;
  onPredictionWrite?: () => void;
  attemptWriteError?: string;
} {
  const upserts: TideStationPredictionRow[][] = [];
  const deletes: Array<{ stationId: string; cutoff: string }> = [];
  const orders: string[] = [];
  const coverageFilters: string[] = [];
  const conflictTargets: string[] = [];
  const attempts = new Map<string, Attempt>(stations.flatMap((station) => station.attempted_at
    ? [[station.id, { station_id: station.id, attempted_at: station.attempted_at, outcome: station.outcome! }]]
    : []));
  const coverage = new Map(stations.map((station) => [station.id, station.coverage_end]));
  const result = {
    upserts, deletes, orders, coverageFilters, conflictTargets, attempts,
    onPredictionWrite: undefined as (() => void) | undefined,
    attemptWriteError: undefined as string | undefined,
  };
  const coverageQuery = {
    select: (_columns: string, options?: { count: string }) => {
      const filters: Array<(row: CoverageRow) => boolean> = [];
      const sorting: Array<{ field: keyof CoverageRow; ascending: boolean; nullsFirst: boolean }> = [];
      const query = {
        or: (filter: string) => {
          coverageFilters.push(filter);
          filters.push((row) => filter.split(",").some((clause) => {
            const [field, operator, ...parts] = clause.split(".");
            const value = parts.join(".");
            const actual = row[field as keyof CoverageRow];
            if (operator === "is") return actual === null && value === "null";
            if (operator === "eq") return actual === value;
            if (operator === "lt") return actual !== null && Date.parse(String(actual)) < Date.parse(value);
            if (operator === "lte") return actual !== null && Date.parse(String(actual)) <= Date.parse(value);
            throw new Error(`Unsupported filter: ${clause}`);
          }));
          return query;
        },
        not: (field: keyof CoverageRow, operator: string, value: null) => {
          expect([operator, value]).toEqual(["is", null]);
          filters.push((row) => row[field] !== null);
          return query;
        },
        lt: (field: keyof CoverageRow, value: string) => {
          filters.push((row) => row[field] !== null && Date.parse(String(row[field])) < Date.parse(value));
          return query;
        },
        order: (field: keyof CoverageRow, sort: { ascending?: boolean; nullsFirst?: boolean }) => {
          if (!options?.count) orders.push(field);
          sorting.push({ field, ascending: sort.ascending ?? true, nullsFirst: sort.nullsFirst ?? false });
          return query;
        },
        limit: async (limit: number) => {
          const rows: CoverageRow[] = stations.map((station) => ({
            ...station,
            coverage_end: coverage.get(station.id) ?? null,
            attempted_at: attempts.get(station.id)?.attempted_at ?? null,
            outcome: attempts.get(station.id)?.outcome ?? null,
            never_attempted: !attempts.has(station.id),
          })).filter((row) => filters.every((filter) => filter(row)));
          rows.sort((a, b) => {
            for (const { field, ascending, nullsFirst } of sorting) {
              const left = a[field];
              const right = b[field];
              if (left === right) continue;
              if (left === null) return nullsFirst ? -1 : 1;
              if (right === null) return nullsFirst ? 1 : -1;
              const compared = field === "coverage_end" || field === "attempted_at"
                ? Date.parse(String(left)) - Date.parse(String(right))
                : String(left).localeCompare(String(right));
              if (compared !== 0) return ascending ? compared : -compared;
            }
            return 0;
          });
          return { data: rows.slice(0, limit), count: options?.count ? rows.length : null, error: null };
        },
      };
      return query;
    },
  };
  (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
    from: (table: string) => {
      if (table === "tide_station_prediction_coverage") return coverageQuery;
      if (table === "cron_runs") return { insert: async () => ({ error: null }) };
      if (table === "tide_station_prediction_attempts") return {
        upsert: async (rows: Attempt[], options: { onConflict: string }) => {
          expect(options.onConflict).toBe("station_id");
          if (result.attemptWriteError) return { error: { message: result.attemptWriteError } };
          for (const row of rows) attempts.set(row.station_id, row);
          return { error: null };
        },
      };
      if (table === "tide_station_predictions") return {
        upsert: async (rows: TideStationPredictionRow[], options: { onConflict: string }) => {
          upserts.push(rows);
          conflictTargets.push(options.onConflict);
          if (!upsertError) for (const row of rows) {
            const previous = coverage.get(row.station_id);
            if (!previous || Date.parse(previous) < Date.parse(row.ts)) coverage.set(row.station_id, row.ts);
          }
          result.onPredictionWrite?.();
          return { error: upsertError ? { message: upsertError } : null };
        },
        delete: () => ({ eq: (field: string, stationId: string) => ({
          lt: async (column: string, cutoff: string) => {
            deletes.push({ stationId, cutoff });
            return { count: 2, error: null };
          },
        }) }),
      };
      throw new Error(`Unexpected table ${table}`);
    },
  });
  return result;
}

async function run(maxStations = 120): Promise<{ data: { stationsAttempted: number; stationsWritten: number; rowsUpserted: number; rowsDeleted: number; upstreamSkipped: Record<string, number>; stoppedReason: string | null; outcome: string; coverageGap: { count: number; earliestCoverageEnd: string | null } } }> {
  const response = await GET(new Request(`http://localhost/api/cron/tide-stations/predictions?maxStations=${maxStations}`));
  expect(response.status).toBe(200);
  return response.json();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  (fetchHighLowTidePredictions as jest.Mock).mockResolvedValue(hilo);
  (fetchHourlyTidePredictions as jest.Mock).mockResolvedValue(hourly);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

it("orders earliest coverage first, fetches hourly only for references, writes raw heights and prunes old rows", async () => {
  jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-16T12:00:00Z"));
  const db = mockDatabase([
    candidate("late", "subordinate", "2026-11-25T00:00:00Z"),
    candidate("first", "reference"),
    candidate("early", "subordinate", "2026-11-20T00:00:00Z"),
  ]);
  const body = await run();
  expect(db.orders).toEqual(["never_attempted", "coverage_end", "id"]);
  expect(db.coverageFilters).toEqual([
    "coverage_end.is.null,coverage_end.lt.2026-12-06T12:00:00.000Z",
    "attempted_at.is.null,outcome.eq.written,attempted_at.lte.2026-11-15T12:00:00.000Z",
  ]);
  expect((fetchHighLowTidePredictions as jest.Mock).mock.calls.map((call) => call[0])).toEqual(["first", "early", "late"]);
  expect((fetchHourlyTidePredictions as jest.Mock).mock.calls.map((call) => call[0])).toEqual(["first"]);
  expect(fetchHighLowTidePredictions).toHaveBeenCalledWith("first", "2026-11-14T00:00:00.000Z", "2026-12-31T12:00:00.000Z", { raw: true });
  expect(fetchHourlyTidePredictions).toHaveBeenCalledWith("first", "2026-11-14T00:00:00.000Z", "2026-12-31T12:00:00.000Z", { raw: true });
  expect(db.conflictTargets).toEqual(["station_id,ts,kind", "station_id,ts,kind", "station_id,ts,kind"]);
  expect(db.upserts.flat()).toEqual(expect.arrayContaining([
    expect.objectContaining({ station_id: "noaa:first", kind: "high", height_m: 1.2345 }),
    expect.objectContaining({ station_id: "noaa:first", kind: "hourly", height_m: 1.1111 }),
  ]));
  expect(db.deletes).toHaveLength(3);
  expect(db.deletes[0].cutoff).toBe("2026-11-13T00:00:00.000Z");
  expect(body.data).toMatchObject({ stationsAttempted: 3, stationsWritten: 3, rowsUpserted: 4, rowsDeleted: 6 });
  expect(body.data.coverageGap).toEqual({ count: 0, earliestCoverageEnd: null });
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});

it.each([
  ["reference", 0], ["reference", 1], ["subordinate", 0], ["subordinate", 1],
] as const)("serves ingested %s predictions from storage with NOAA down %i days later", async (kind, daysLater) => {
  const hourMs = 3_600_000;
  const dayMs = 24 * hourMs;
  const nowMs = Date.parse("2026-11-16T23:30:00Z");
  const clock = jest.spyOn(Date, "now").mockReturnValue(nowMs);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  const selected = candidate(kind === "reference" ? "8658120" : "8659086", kind);
  const db = mockDatabase([selected]);
  const timestamps = (startIso: string, endIso: string, stepMs: number, phaseMs = 0): string[] => {
    const first = Math.ceil((Date.parse(startIso) - phaseMs) / stepMs) * stepMs + phaseMs;
    return Array.from({ length: Math.floor((Date.parse(endIso) - first) / stepMs) + 1 }, (_, index) =>
      new Date(first + index * stepMs).toISOString());
  };
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation(async (_id: string, startIso: string, endIso: string) =>
    timestamps(startIso, endIso, 6 * hourMs, 72 * 60_000).map((ts, index) => ({
      ts, type: index % 2 === 0 ? "high" : "low", tide_height_m: index % 2 === 0 ? 1.2 : 0.2,
    })));
  (fetchHourlyTidePredictions as jest.Mock).mockImplementation(async (_id: string, startIso: string, endIso: string) =>
    timestamps(startIso, endIso, hourMs).map((ts) => ({ ts, tide_height_m: 0.7, tide_phase: null })));

  const body = await run();
  expect(body.data.stationsWritten).toBe(1);
  const rows = db.upserts.flat().filter((row) => Date.parse(row.ts) >= Date.parse(db.deletes[0].cutoff));
  expect(rows.length).toBeGreaterThan(100);
  (createPublicReadClient as jest.Mock).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: (_field: string, stationId: string) => ({
          gte: (_field: string, startIso: string) => ({
            lte: (_field: string, endIso: string) => ({
              order: async () => ({
                data: rows.filter((row) => row.station_id === stationId &&
                  Date.parse(row.ts) >= Date.parse(startIso) && Date.parse(row.ts) <= Date.parse(endIso))
                  .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)),
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  });
  const unavailable = new NoaaTideRequestError("NOAA tide failed: 504", 504);
  (fetchHighLowTidePredictions as jest.Mock).mockClear().mockRejectedValue(unavailable);
  (fetchHourlyTidePredictions as jest.Mock).mockClear().mockRejectedValue(unavailable);
  const station = {
    id: selected.id, source_station_id: selected.source_station_id, source: "noaa",
    station_kind: kind, reference_station_id: null,
  } as TideStationRow;
  const readAtMs = nowMs + daysLater * dayMs;
  clock.mockReturnValue(readAtMs);
  const series = await getStationSeries(station, readAtMs);
  expect(series.status).toBe("ok");
  if (series.status !== "ok") throw new Error("Expected stored predictions");
  expect(series.extremes.length).toBeGreaterThan(30);
  expect(series.hourly.length).toBe(kind === "reference" ? 241 : 0);
  expect(series.windowStart).toBe(new Date(readAtMs - 30 * 60_000 - dayMs).toISOString());
  expect(fetchHighLowTidePredictions).not.toHaveBeenCalled();
  expect(fetchHourlyTidePredictions).not.toHaveBeenCalled();
});

it("skips one NOAA failure and continues without a Sentry error", async () => {
  mockDatabase([candidate("bad", "subordinate"), candidate("good", "reference")]);
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation((id: string) =>
    id === "bad" ? Promise.reject(new NoaaTideRequestError("NOAA tide failed: 504", 504)) : Promise.resolve(hilo));
  const body = await run();
  expect(body.data).toMatchObject({ stationsWritten: 1, upstreamSkipped: { "noaa-request": 1 }, outcome: "degraded" });
  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});

it("stops after three consecutive NOAA failures without a Sentry error", async () => {
  mockDatabase([candidate("a", "subordinate"), candidate("b", "subordinate"), candidate("c", "subordinate"), candidate("d", "subordinate")]);
  (fetchHighLowTidePredictions as jest.Mock).mockRejectedValue(new NoaaTideRequestError("NOAA tide failed: 504", 504));
  const body = await run();
  expect(body.data).toMatchObject({ stationsAttempted: 3, stationsWritten: 0, stoppedReason: "upstream_unavailable", outcome: "degraded" });
  expect(body.data.stationsAttempted).toBe(3);
  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});

it("counts empty NOAA answers separately without advancing the request-error streak", async () => {
  mockDatabase([candidate("a", "subordinate"), candidate("b", "subordinate"), candidate("c", "subordinate"), candidate("d", "subordinate")]);
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation((id: string) =>
    id === "b" ? Promise.resolve([]) : Promise.reject(new NoaaTideRequestError("NOAA tide failed: 504", 504)));
  const body = await run();
  expect(body.data).toMatchObject({
    stationsAttempted: 4, stoppedReason: null, upstreamSkipped: { "noaa-request": 3, "noaa-empty": 1 },
  });
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it("stops on NOAA cooldown without reporting a Sentry error", async () => {
  mockDatabase([candidate("a", "subordinate"), candidate("b", "subordinate")]);
  (fetchHighLowTidePredictions as jest.Mock).mockRejectedValue(new NoaaTideRequestError("NOAA tide failed: 403", 403));
  const body = await run();
  expect(body.data.stoppedReason).toBe("upstream_unavailable");
  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});

it("honors an hourly cooldown even when the same station's high/low request also fails", async () => {
  const db = mockDatabase([candidate("a", "reference")]);
  (fetchHighLowTidePredictions as jest.Mock).mockRejectedValue(new NoaaTideRequestError("NOAA tide failed: 504", 504));
  (fetchHourlyTidePredictions as jest.Mock).mockRejectedValue(new NoaaTideRequestError("NOAA tide failed: 429", 429));
  const body = await run();
  expect(body.data).toMatchObject({ stoppedReason: "upstream_unavailable", upstreamSkipped: { "noaa-cooldown": 1 } });
  expect(db.attempts.get("noaa:a")?.outcome).toBe("noaa-cooldown");
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
});

it("fails the run when a Supabase upsert fails", async () => {
  const db = mockDatabase([candidate("good", "subordinate")], "write failed");
  await expect(run()).rejects.toThrow("Failed to upsert noaa:good: write failed");
  expect(Sentry.captureException).toHaveBeenCalled();
  expect(db.attempts.get("noaa:good")?.outcome).toBe("error");
});

it("fails the run when attempt persistence fails", async () => {
  const db = mockDatabase([candidate("good", "subordinate")]);
  db.attemptWriteError = "attempt write failed";
  await expect(run()).rejects.toThrow("Failed to record tide attempts: attempt write failed");
  expect(Sentry.captureException).toHaveBeenCalled();
});

it("preserves a successful batch result and records attempts before rethrowing a parser error", async () => {
  const db = mockDatabase([candidate("a", "subordinate"), candidate("b", "subordinate")]);
  const bug = new TypeError("broken parser");
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation(async (id: string) => {
    if (id === "a") throw bug;
    return hilo;
  });
  await expect(run()).rejects.toBe(bug);
  expect(db.upserts.flat().map((row) => row.station_id)).toEqual(["noaa:b"]);
  expect(db.attempts.get("noaa:a")?.outcome).toBe("error");
  expect(db.attempts.get("noaa:b")?.outcome).toBe("written");
  expect(Sentry.captureException).toHaveBeenCalledWith(bug, expect.any(Object));
});

it("excludes failures from one hour ago, retries failures from 25 hours ago, and prioritizes never-attempted stations", async () => {
  const db = mockDatabase([
    { ...candidate("recent", "subordinate"), attempted_at: new Date(NOW - 3_600_000).toISOString(), outcome: "noaa-empty" },
    { ...candidate("retry", "subordinate"), attempted_at: new Date(NOW - 25 * 3_600_000).toISOString(), outcome: "noaa-request" },
    candidate("new", "subordinate", "2026-11-30T00:00:00Z"),
    { ...candidate("urgent", "subordinate", "2026-11-18T00:00:00Z"), attempted_at: new Date(NOW).toISOString(), outcome: "written" },
  ]);
  const body = await run();
  expect((fetchHighLowTidePredictions as jest.Mock).mock.calls.map((call) => call[0])).toEqual(["new", "retry", "urgent"]);
  expect(body.data.stationsAttempted).toBe(3);
  expect(db.attempts.get("noaa:retry")).toEqual({ station_id: "noaa:retry", attempted_at: new Date(NOW).toISOString(), outcome: "written" });
  expect(db.attempts.get("noaa:recent")?.outcome).toBe("noaa-empty");
});

it("moves past three failed stations in the next run instead of starving the queue", async () => {
  const db = mockDatabase(["a", "b", "c", "d"].map((id) => candidate(id, "subordinate")));
  (fetchHighLowTidePredictions as jest.Mock).mockRejectedValue(new NoaaTideRequestError("NOAA tide failed: 504", 504));
  expect((await run()).data.stoppedReason).toBe("upstream_unavailable");
  expect([...db.attempts.values()].map((attempt) => attempt.outcome)).toEqual(["noaa-request", "noaa-request", "noaa-request"]);
  jest.spyOn(Date, "now").mockReturnValue(NOW + 3_600_000);
  (fetchHighLowTidePredictions as jest.Mock).mockClear().mockResolvedValue(hilo);
  const body = await run();
  expect((fetchHighLowTidePredictions as jest.Mock).mock.calls.map((call) => call[0])).toEqual(["d"]);
  expect(body.data).toMatchObject({ stationsAttempted: 1, stationsWritten: 1 });
});

it("alerts once for existing stored coverage below seven days, including stations in backoff", async () => {
  mockDatabase([
    { ...candidate("a", "subordinate", "2026-11-18T00:00:00Z"), attempted_at: new Date(NOW).toISOString(), outcome: "noaa-request" },
    { ...candidate("b", "subordinate", "2026-11-20T00:00:00Z"), attempted_at: new Date(NOW).toISOString(), outcome: "noaa-empty" },
    candidate("empty", "subordinate"),
  ]);
  (fetchHighLowTidePredictions as jest.Mock).mockResolvedValue([]);
  const body = await run(1);
  expect(body.data.coverageGap).toEqual({ count: 2, earliestCoverageEnd: "2026-11-18T00:00:00Z" });
  expect(body.data.outcome).toBe("degraded");
  expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    level: "error", extra: expect.objectContaining({ reason: expect.stringMatching(/2.*2026-11-18T00:00:00Z/) }),
  }));
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it("keeps an isolated upstream skip silent when stored coverage is at least seven days", async () => {
  mockDatabase([
    { ...candidate("covered", "subordinate", "2026-11-23T12:00:00.000Z"), attempted_at: new Date(NOW).toISOString(), outcome: "noaa-request" },
    candidate("empty", "subordinate"),
  ]);
  (fetchHighLowTidePredictions as jest.Mock).mockResolvedValue([]);
  const body = await run();
  expect(body.data).toMatchObject({ coverageGap: { count: 0, earliestCoverageEnd: null }, upstreamSkipped: { "noaa-empty": 1 } });
  expect(Sentry.captureMessage).not.toHaveBeenCalled();
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it.each([false, true])("writes the successful batch result before stopping on cooldown (cooldown first: %s)", async (cooldownFirst) => {
  const ok = cooldownFirst ? "b" : "a";
  const db = mockDatabase(["a", "b", "c"].map((id) => candidate(id, "subordinate")));
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation(async (id: string) => {
    if (id === ok) return hilo;
    throw new NoaaTideRequestError("NOAA tide failed: 403", 403);
  });
  const body = await run();
  expect(db.upserts.flat().map((row) => row.station_id)).toEqual([`noaa:${ok}`]);
  expect(body.data).toMatchObject({ stationsAttempted: 2, stationsWritten: 1, stoppedReason: "upstream_unavailable" });
  expect([...db.attempts.values()].map((attempt) => attempt.outcome).sort()).toEqual(["noaa-cooldown", "written"]);
  expect(fetchHighLowTidePredictions).toHaveBeenCalledTimes(2);
});

it("stops before writes when a fetch passes the 75-second deadline", async () => {
  const db = mockDatabase([candidate("slow", "subordinate")]);
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation(async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW + 76_000);
    return hilo;
  });
  const body = await run();
  expect(body.data).toMatchObject({ stationsAttempted: 1, stationsWritten: 0, stoppedReason: "deadline_exceeded" });
  expect(db.upserts).toEqual([]);
  expect(db.attempts.get("noaa:slow")?.outcome).toBe("deadline_exceeded");
});

it("checks the deadline again before the second station's writes", async () => {
  const db = mockDatabase([candidate("a", "subordinate"), candidate("b", "subordinate")]);
  db.onPredictionWrite = () => { jest.spyOn(Date, "now").mockReturnValue(NOW + 76_000); };
  const body = await run();
  expect(body.data).toMatchObject({ stationsAttempted: 2, stationsWritten: 1, stoppedReason: "deadline_exceeded" });
  expect(db.upserts.flat().map((row) => row.station_id)).toEqual(["noaa:a"]);
  expect(db.attempts.get("noaa:b")?.outcome).toBe("deadline_exceeded");
});

it("counts only fetched stations when the deadline arrives while launching a batch", async () => {
  const db = mockDatabase([candidate("a", "subordinate"), candidate("b", "subordinate")]);
  (fetchHighLowTidePredictions as jest.Mock).mockImplementation(async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW + 76_000);
    return hilo;
  });
  const body = await run();
  expect(body.data.stationsAttempted).toBe(1);
  expect(fetchHighLowTidePredictions).toHaveBeenCalledTimes(1);
  expect([...db.attempts.keys()]).toEqual(["noaa:a"]);
});
