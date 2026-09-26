import { parseNdbcStdmet } from "@/lib/climatology/parse-ndbc";

const MODERN = [
  "#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS  TIDE",
  "#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC   mi    ft",
  "2024 01 01 00 26 999 99.0 99.0  0.22 99.00  5.14 999 9999.0 999.0  19.5 999.0 99.0 99.00",
  "2024 01 01 00 56 352  0.2  0.6  0.23 11.00  5.22 087 9999.0 999.0  19.4 999.0 99.0 99.00",
].join("\n");

const LEGACY = [
  "YYYY MM DD hh mm  WD  WSPD GST  WVHT  DPD   APD  MWD  BAR    ATMP  WTMP  DEWP  VIS  TIDE",
  "2006 01 01 00 00 999 99.0 99.0  1.90 14.00 99.00 999 9999.0 999.0  15.1 999.0 99.0 99.00",
].join("\n");

describe("parseNdbcStdmet", () => {
  it("reads the #YY header, skips the units row and nulls sentinel values", () => {
    const rows = parseNdbcStdmet(MODERN);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      timeUtcMs: Date.UTC(2024, 0, 1, 0, 26),
      waveHeightM: 0.22,
      dominantPeriodS: null,
      meanWaveDirDeg: null,
      waterTempC: 19.5,
      windDirDeg: null,
      windSpeedMs: null,
    });
    expect(rows[1]).toMatchObject({
      dominantPeriodS: 11,
      meanWaveDirDeg: 87,
      windDirDeg: 352,
      windSpeedMs: 0.2,
    });
  });

  it("maps the legacy YYYY/WD/BAR header", () => {
    expect(parseNdbcStdmet(LEGACY)).toEqual([
      {
        timeUtcMs: Date.UTC(2006, 0, 1, 0, 0),
        waveHeightM: 1.9,
        dominantPeriodS: 14,
        meanWaveDirDeg: null,
        waterTempC: 15.1,
        windDirDeg: null,
        windSpeedMs: null,
      },
    ]);
  });

  it("treats MM as missing and skips rows with broken time fields", () => {
    const text = [
      "#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS  TIDE",
      "2024 02 01 05 00 MM   MM   MM   1.20   MM    MM  MM    MM     MM    MM    MM   MM   MM",
      "2024 xx 01 06 00 999 99.0 99.0  1.30 99.00 99.00 999 9999.0 999.0 999.0 999.0 99.0 99.00",
    ].join("\n");

    expect(parseNdbcStdmet(text)).toEqual([
      {
        timeUtcMs: Date.UTC(2024, 1, 1, 5, 0),
        waveHeightM: 1.2,
        dominantPeriodS: null,
        meanWaveDirDeg: null,
        waterTempC: null,
        windDirDeg: null,
        windSpeedMs: null,
      },
    ]);
  });
});
