/**
 * @jest-environment node
 */

import {
  evaluateWaterQuality,
  syncWQSamples,
} from "@/lib/services/water-quality/water-quality-sync-service";
import type { SupabaseServiceClient } from "@/types/supabase";

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface QueryBuilder {
  select: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  in: jest.Mock;
  gte: jest.Mock;
  lte: jest.Mock;
  limit: jest.Mock;
  upsert: jest.Mock;
  maybeSingle: jest.Mock;
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
}

function createQueryBuilder(resolve: () => QueryResult): QueryBuilder {
  const builder = {} as QueryBuilder;
  builder.select = jest.fn().mockReturnValue(builder);
  builder.not = jest.fn().mockReturnValue(builder);
  builder.order = jest.fn().mockReturnValue(builder);
  builder.range = jest.fn().mockReturnValue(builder);
  builder.in = jest.fn().mockReturnValue(builder);
  builder.gte = jest.fn().mockReturnValue(builder);
  builder.lte = jest.fn().mockReturnValue(builder);
  builder.limit = jest.fn().mockReturnValue(builder);
  builder.upsert = jest.fn().mockReturnValue(builder);
  builder.maybeSingle = jest.fn().mockImplementation(async () => resolve());
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return builder;
}

function utcDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

function mockSourceFetch(records: unknown[]): jest.Spied<typeof fetch> {
  return jest.spyOn(global, "fetch").mockImplementation(async (input) => {
    if (String(input).includes("data.ca.gov")) {
      return {
        ok: true,
        json: async () => ({ result: { records } }),
      } as Response;
    }

    return { ok: false, status: 404 } as Response;
  });
}

function createSampleSyncSupabase(): {
  supabase: SupabaseServiceClient;
  stationRanges: Array<[number, number]>;
  upsertRows: unknown[][];
} {
  const firstPage: Array<{
    id: string;
    station_id: string;
    nearest_beach_id: string | null;
  }> = Array.from({ length: 1_000 }, (_, index) => ({
    id: `station-uuid-${index}`,
    station_id: `OTHER-${index}`,
    nearest_beach_id: null,
  }));
  firstPage[0] = {
    id: "station-uuid-first",
    station_id: "CEDEN-KEEP",
    nearest_beach_id: "beach-1",
  };
  const secondPage = [
    {
      id: "station-uuid-second",
      station_id: "CEDEN-PAGE-2",
      nearest_beach_id: "beach-2",
    },
  ];
  const stationRanges: Array<[number, number]> = [];
  const upsertRows: unknown[][] = [];

  const from = jest.fn((table: string) => {
    if (table === "wq_monitoring_stations") {
      let pageStart = 0;
      const builder = createQueryBuilder(() => ({
        data: pageStart === 0 ? firstPage : secondPage,
        error: null,
      }));
      builder.range.mockImplementation((fromValue: number, toValue: number) => {
        pageStart = fromValue;
        stationRanges.push([fromValue, toValue]);
        return builder;
      });
      return builder;
    }

    const builder = createQueryBuilder(() => ({ data: null, error: null }));
    builder.upsert.mockImplementation((rows: unknown[]) => {
      upsertRows.push(rows);
      return builder;
    });
    return builder;
  });

  return {
    supabase: { from } as unknown as SupabaseServiceClient,
    stationRanges,
    upsertRows,
  };
}

describe("water-quality CEDEN ingestion and evaluation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("processes every station across Supabase pages", async () => {
    const { supabase, stationRanges, upsertRows } =
      createSampleSyncSupabase();
    mockSourceFetch([
      {
        StationCode: "KEEP",
        SampleDate: `${utcDateOffset(-1)}T00:00:00Z`,
        Analyte: "Enterococcus",
        Result: "10",
        Unit: "CFU/100mL",
      },
      {
        StationCode: "PAGE-2",
        SampleDate: `${utcDateOffset(-2)}T00:00:00Z`,
        Analyte: "Enterococcus",
        Result: "20",
        Unit: "CFU/100mL",
      },
    ]);

    const result = await syncWQSamples(supabase);
    const writtenRows = upsertRows.flat();

    expect(stationRanges).toEqual([
      [0, 999],
      [1_000, 1_999],
    ]);
    expect(result.samplesMatched).toBe(2);
    expect(result.samplesUpserted).toBe(2);
    expect(writtenRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ station_id: "station-uuid-first" }),
        expect.objectContaining({ station_id: "station-uuid-second" }),
      ])
    );
  });

  it("rejects future CEDEN rows and reports the rejection count", async () => {
    const { supabase, upsertRows } = createSampleSyncSupabase();
    mockSourceFetch([
      {
        StationCode: "KEEP",
        SampleDate: `${utcDateOffset(-1)}T00:00:00Z`,
        Analyte: "Enterococcus",
        Result: "10",
      },
      {
        StationCode: "KEEP",
        SampleDate: `${utcDateOffset(1)}T00:00:00Z`,
        Analyte: "Enterococcus",
        Result: "999",
      },
    ]);

    const result = await syncWQSamples(supabase);
    const writtenRows = upsertRows.flat();

    expect(result.futureSamplesRejected).toBe(1);
    expect(result.samplesMatched).toBe(1);
    expect(result.samplesUpserted).toBe(1);
    expect(writtenRows).toEqual([
      expect.objectContaining({
        station_id: "station-uuid-first",
        sample_date: utcDateOffset(-1),
      }),
    ]);
  });

  it("anchors evaluation to UTC today and constrains the upper date bound", async () => {
    const today = utcDateOffset(0);
    const cutoff = utcDateOffset(-30);
    const validDate = utcDateOffset(-3);
    const futureDate = utcDateOffset(50);
    const sampleRows = [
      {
        station_id: "station-uuid-1",
        characteristic: "Enterococcus",
        value: 20,
        detection_condition: null,
        sample_date: futureDate,
      },
      {
        station_id: "station-uuid-1",
        characteristic: "Enterococcus",
        value: 20,
        detection_condition: null,
        sample_date: validDate,
      },
    ];
    const sampleQueries: Array<{
      gte: string | undefined;
      lte: string | undefined;
    }> = [];
    const evaluationRows: unknown[][] = [];

    const from = jest.fn((table: string) => {
      if (table === "wq_monitoring_stations") {
        return createQueryBuilder(() => ({
          data: [
            {
              id: "station-uuid-1",
              station_id: "CEDEN-KEEP",
              nearest_beach_id: "beach-1",
              lat: 32.75,
              lon: -117.25,
              name: "Test station",
            },
          ],
          error: null,
        }));
      }

      if (table === "wq_samples") {
        const state: {
          gte: string | undefined;
          lte: string | undefined;
        } = { gte: undefined, lte: undefined };
        const builder = createQueryBuilder(() => ({
          data: sampleRows.filter(
            (row) =>
              (state.gte === undefined || row.sample_date >= state.gte) &&
              (state.lte === undefined || row.sample_date <= state.lte)
          ),
          error: null,
        }));
        builder.gte.mockImplementation((_column: string, value: string) => {
          state.gte = value;
          if (!sampleQueries.includes(state)) sampleQueries.push(state);
          return builder;
        });
        builder.lte.mockImplementation((_column: string, value: string) => {
          state.lte = value;
          return builder;
        });
        builder.maybeSingle.mockResolvedValue({
          data: { sample_date: futureDate },
          error: null,
        });
        return builder;
      }

      if (table === "beach_water_quality") {
        const builder = createQueryBuilder(() => ({ data: [], error: null }));
        builder.upsert.mockImplementation((rows: unknown[]) => {
          evaluationRows.push(rows);
          return builder;
        });
        return builder;
      }

      return createQueryBuilder(() => ({ data: [], error: null }));
    });

    const result = await evaluateWaterQuality(
      { from } as unknown as SupabaseServiceClient
    );

    expect(result.beachesEvaluated).toBe(1);
    expect(sampleQueries).toEqual([{ gte: cutoff, lte: today }]);
    expect(evaluationRows.flat()).toEqual([
      expect.objectContaining({
        beach_id: "beach-1",
        status: "good",
        total_samples_30d: 1,
        latest_sample_date: validDate,
      }),
    ]);
  });
});
