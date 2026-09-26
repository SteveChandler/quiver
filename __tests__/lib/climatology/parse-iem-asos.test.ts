import { parseIemAsosCsv } from "@/lib/climatology/parse-iem-asos";

describe("parseIemAsosCsv", () => {
  it("reads UTC rows and treats M as missing", () => {
    const csv = [
      "station,valid,drct,sknt",
      "SNA,2024-07-01 00:53,190.00,4.00",
      "SNA,2024-07-01 01:53,M,0.00",
      "SNA,2024-07-01 02:53,130.00,M",
      "SNA,not-a-time,130.00,5.00",
    ].join("\n");

    expect(parseIemAsosCsv(csv)).toEqual([
      { timeUtcMs: Date.UTC(2024, 6, 1, 0, 53), windDirDeg: 190, windSpeedKt: 4 },
      { timeUtcMs: Date.UTC(2024, 6, 1, 1, 53), windDirDeg: null, windSpeedKt: 0 },
      { timeUtcMs: Date.UTC(2024, 6, 1, 2, 53), windDirDeg: 130, windSpeedKt: null },
    ]);
  });

  it("rejects a response without the expected columns", () => {
    expect(() => parseIemAsosCsv("station,valid,tmpf\nSNA,2024-07-01 00:53,70")).toThrow(
      "Unexpected IEM ASOS header",
    );
  });
});
