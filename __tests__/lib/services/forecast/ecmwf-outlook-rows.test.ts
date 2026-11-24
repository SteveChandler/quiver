import { attachEcmwfOutlook } from "@/lib/services/forecast/ecmwf-outlook-rows";
import { isFallbackForecastRow } from "@/lib/utils/forecast-row-source";
import type { EcmwfOutlookSeries } from "@/lib/services/noaa-wavewatch/types";
import type { EnhancedForecastWithRawData } from "@/types/forecast";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-11-06T00:00:00Z");
const SEAM = NOW + 9 * 24 * HOUR;

function row(ms: number, waveHeight: string | null): EnhancedForecastWithRawData {
  return {
    forecast_at: new Date(ms).toISOString(),
    data_source: waveHeight === null ? "FALLBACK" : "OPEN_METEO",
    wave_height: waveHeight,
    raw_forecast: { data_sources: ["NOAA_NWS"] },
  } as unknown as EnhancedForecastWithRawData;
}

function rows(): EnhancedForecastWithRawData[] {
  const out: EnhancedForecastWithRawData[] = [];
  for (let h = 0; h < 12 * 24; h += 3) {
    const ms = NOW + h * HOUR;
    out.push(row(ms, ms <= SEAM ? "4.0 ft" : null));
  }
  return out;
}

function series(hsM: number): EcmwfOutlookSeries {
  const points = [];
  for (let h = 0; h <= 14 * 24; h += 1) points.push({ ms: NOW + h * HOUR, hs_m: hsM });
  return { model: "ecmwf_wam025", points, starts_after_ms: SEAM, model_ratio: 1.1, model_ratio_pairs: 24 };
}

describe("attachEcmwfOutlook", () => {
  it("scales WAM by the seam face ratio onto FALLBACK rows after the seam only", () => {
    const built = rows();
    const attached = attachEcmwfOutlook(built, series(2));
    expect(attached).toBe(built.filter((r) => Date.parse(r.forecast_at!) > SEAM).length);
    const before = built.filter((r) => Date.parse(r.forecast_at!) <= SEAM);
    const after = built.filter((r) => Date.parse(r.forecast_at!) > SEAM);
    expect(before.every((r) => r.raw_forecast?.ecmwf_outlook === undefined)).toBe(true);
    for (const r of after) {
      // 4 ft displayed over 2 m WAM at the seam = 2 ft per m.
      expect(r.raw_forecast?.ecmwf_outlook).toMatchObject({ model: "ecmwf_wam025", face_ft: 4, hs_m: 2, face_ft_per_m: 2 });
      // The row is still a FALLBACK row with no forecast height.
      expect(isFallbackForecastRow(r)).toBe(true);
      expect(r.wave_height).toBeNull();
      expect(r.raw_forecast?.data_sources).toEqual(["NOAA_NWS"]);
    }
  });

  it("attaches nothing without a series or with too few seam pairs", () => {
    const built = rows();
    expect(attachEcmwfOutlook(built, undefined)).toBe(0);
    const sparse = series(2);
    sparse.points = sparse.points.filter((point) => point.ms > SEAM - 6 * HOUR);
    expect(attachEcmwfOutlook(built, sparse)).toBe(0);
    expect(built.some((r) => r.raw_forecast?.ecmwf_outlook)).toBe(false);
  });
});
