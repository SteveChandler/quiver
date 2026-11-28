interface QueryBuilder {
  select: jest.Mock<QueryBuilder, []>;
  eq: jest.Mock<QueryBuilder, [string, string]>;
  gte: jest.Mock<QueryBuilder, [string, string]>;
  limit: jest.Mock;
}

const limit = jest.fn();
const builder: QueryBuilder = {
  select: jest.fn((): QueryBuilder => builder),
  eq: jest.fn((_column: string, _value: string): QueryBuilder => builder),
  gte: jest.fn((_column: string, _value: string): QueryBuilder => builder),
  limit,
};
const from = jest.fn(() => builder);

jest.mock("@/lib/supabase/server", () => ({ createPublicReadClient: () => ({ from }) }));

import { isTideStationLinkedFromBeach } from "@/lib/tide-stations/queries";

const noaa = { source: "noaa" as const, source_station_id: "9410230" };
const nowMs = Date.parse("2026-11-27T12:00:00Z");

beforeEach(() => jest.clearAllMocks());

describe("beach-link probe", () => {
  it("is true when a beach's recent tide rows name the station", async () => {
    limit.mockResolvedValue({ data: [{ station_id: "9410230" }], error: null });
    await expect(isTideStationLinkedFromBeach(noaa, nowMs)).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith("tide_forecasts");
    expect(builder.eq).toHaveBeenCalledWith("station_id", "9410230");
    expect(builder.gte).toHaveBeenCalledWith("ts", "2026-11-24T12:00:00.000Z");
  });

  it("is false when no beach names it", async () => {
    limit.mockResolvedValue({ data: [], error: null });
    await expect(isTideStationLinkedFromBeach(noaa, nowMs)).resolves.toBe(false);
  });

  it("never queries for a TICON station (beaches read NOAA tables only)", async () => {
    await expect(isTideStationLinkedFromBeach({ source: "ticon", source_station_id: "x" }, nowMs)).resolves.toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps the station when the read returns an error", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    limit.mockResolvedValue({ data: null, error: { message: "timeout" } });
    await expect(isTideStationLinkedFromBeach(noaa, nowMs)).resolves.toBe(true);
    warn.mockRestore();
  });

  it("does not swallow an unrelated thrown error", async () => {
    limit.mockRejectedValue(new TypeError("boom"));
    await expect(isTideStationLinkedFromBeach(noaa, nowMs)).rejects.toThrow("boom");
  });
});
