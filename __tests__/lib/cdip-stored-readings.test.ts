const queries: Array<{ table: string; filters: Record<string, unknown> }> = [];
const rowsByTable: Record<string, unknown[]> = {};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(async () => ({
    from: (table: string) => {
      const entry = { table, filters: {} as Record<string, unknown> };
      queries.push(entry);
      const builder: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: rowsByTable[table] ?? [], error: null }),
      };
      for (const method of ["select", "gte", "not", "order", "limit"]) {
        builder[method] = jest.fn(() => builder);
      }
      builder.eq = jest.fn((column: string, value: unknown) => {
        entry.filters[column] = value;
        return builder;
      });
      return builder;
    },
  })),
}));

import {
  fetchStoredCDIPBuoyData,
  ioosStationIdForCdip,
  latestReadingMs,
} from "@/lib/services/cdip/stored-readings";

const NOW = Date.parse("2026-11-05T12:00:00Z");

beforeEach(() => {
  queries.length = 0;
  for (const key of Object.keys(rowsByTable)) delete rowsByTable[key];
});

describe("fetchStoredCDIPBuoyData", () => {
  it("maps CDIP ids to the zero-padded ioos station id", () => {
    expect(ioosStationIdForCdip("45")).toBe("edu_ucsd_cdip_045");
    expect(ioosStationIdForCdip("CDIP 103")).toBe("edu_ucsd_cdip_103");
  });

  it("reads the ERDDAP store and the NDBC twin, newest first, in feet", async () => {
    rowsByTable.ioos_observations = [
      { observed_at: "2026-11-05T06:30:00Z", wave_height_m: 1.0, wave_period_s: 14, wave_direction_deg: 270 },
    ];
    rowsByTable.ndbc_direct_observations = [
      { observed_at: "2026-11-05T09:56:00Z", wave_height_m: 1.2, wave_period_s: 15, wave_direction_deg: 265 },
    ];

    const stored = await fetchStoredCDIPBuoyData("103", 12, NOW);

    expect(queries.map((q) => [q.table, q.filters.station_id])).toEqual([
      ["ioos_observations", "edu_ucsd_cdip_103"],
      ["ndbc_direct_observations", "46268"],
    ]);
    expect(stored?.readingSource).toBe("stored");
    expect(stored?.stationId).toBe("103");
    expect(stored?.data[0].timestamp).toBe("2026-11-05T09:56:00.000Z");
    expect(stored?.data[0].significantWaveHeight).toBeCloseTo(3.94, 2);
    expect(latestReadingMs(stored)).toBe(Date.parse("2026-11-05T09:56:00Z"));
  });

  it("returns null for a station outside the station table", async () => {
    rowsByTable.ioos_observations = [
      { observed_at: "2026-11-05T11:30:00Z", wave_height_m: 1.0, wave_period_s: 14, wave_direction_deg: 270 },
    ];

    expect(await fetchStoredCDIPBuoyData("215", 12, NOW)).toBeNull();
    expect(queries).toHaveLength(0);
  });

  it("returns null when nothing is stored in the window", async () => {
    expect(await fetchStoredCDIPBuoyData("155", 12, NOW)).toBeNull();
  });
});
