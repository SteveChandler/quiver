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

type Candidate = { id: string; source_station_id: string; station_kind: "reference" | "subordinate"; coverage_end: string | null };
const candidate = (id: string, kind: "reference" | "subordinate", end: string | null = null): Candidate => ({
  id: `noaa:${id}`, source_station_id: id, station_kind: kind, coverage_end: end,
});
const hilo = [{ ts: "2026-11-17T00:00:00Z", tide_height_m: 1.2345, type: "high" as const }];
const hourly = [{ ts: "2026-11-17T01:00:00Z", tide_height_m: 1.1111, tide_phase: null }];

function mockDatabase(stations: Candidate[], upsertError: string | null = null): {
  upserts: TideStationPredictionRow[][];
  deletes: Array<{ stationId: string; cutoff: string }>;
  orders: string[];
  coverageFilters: string[];
  conflictTargets: string[];
} {
  const upserts: TideStationPredictionRow[][] = [];
  const deletes: Array<{ stationId: string; cutoff: string }> = [];
  const orders: string[] = [];
  const coverageFilters: string[] = [];
  const conflictTargets: string[] = [];
  const coverageQuery = {
    select: () => ({
      or: (filter: string) => {
        coverageFilters.push(filter);
        return {
          order: (field: string) => {
            orders.push(field);
            return {
              order: (second: string) => {
                orders.push(second);
                return {
                  limit: async (limit: number) => ({
                    data: stations.slice().sort((a, b) =>
                      (a.coverage_end ?? "").localeCompare(b.coverage_end ?? "") || a.id.localeCompare(b.id)).slice(0, limit),
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    }),
  };
  (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
    from: (table: string) => {
      if (table === "tide_station_prediction_coverage") return coverageQuery;
      if (table === "cron_runs") return { insert: async () => ({ error: null }) };
      if (table === "tide_station_predictions") return {
        upsert: async (rows: TideStationPredictionRow[], options: { onConflict: string }) => {
          upserts.push(rows);
          conflictTargets.push(options.onConflict);
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
  return { upserts, deletes, orders, coverageFilters, conflictTargets };
}

async function run(): Promise<{ data: { stationsAttempted: number; stationsWritten: number; rowsUpserted: number; rowsDeleted: number; upstreamSkipped: Record<string, number>; stoppedReason: string | null; outcome: string } }> {
  const response = await GET(new Request("http://localhost/api/cron/tide-stations/predictions?maxStations=120"));
  expect(response.status).toBe(200);
  return response.json();
}

beforeEach(() => {
  jest.clearAllMocks();
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
  expect(db.orders).toEqual(["coverage_end", "id"]);
  expect(db.coverageFilters).toEqual(["coverage_end.is.null,coverage_end.lt.2026-12-06T12:00:00.000Z"]);
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

it("fails the run when a Supabase upsert fails", async () => {
  mockDatabase([candidate("good", "subordinate")], "write failed");
  await expect(run()).rejects.toThrow("Failed to upsert noaa:good: write failed");
  expect(Sentry.captureException).toHaveBeenCalled();
});
