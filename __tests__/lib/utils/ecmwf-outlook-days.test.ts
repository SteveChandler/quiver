import { aggregateOutlookDays } from "@/lib/utils/ecmwf-outlook-days";
import type { EnhancedForecastEntity } from "@/types/forecast";

function modelRow(at: string, ft: number): EnhancedForecastEntity {
  return { forecast_at: at, data_source: "OPEN_METEO", wave_height: `${ft} ft` } as EnhancedForecastEntity;
}

function outlookRow(at: string, faceFt: number | null): EnhancedForecastEntity {
  return {
    forecast_at: at,
    data_source: "FALLBACK",
    wave_height: null,
    raw_forecast: faceFt === null ? { data_sources: [] } : {
      ecmwf_outlook: { model: "ecmwf_wam025", face_ft: faceFt, hs_m: 1, face_ft_per_m: 3, seam_pairs: 24, model_ratio: 1 },
    },
  } as unknown as EnhancedForecastEntity;
}

function day(date: string, faces: number[]): EnhancedForecastEntity[] {
  return faces.map((face, i) => outlookRow(`${date}T${String(i * 3).padStart(2, "0")}:00:00Z`, face));
}

describe("aggregateOutlookDays", () => {
  it("gives a range and trend for whole outlook days after the last model day", () => {
    const rows = [
      ...[0, 3, 6, 9].map((h) => modelRow(`2026-11-14T${String(h).padStart(2, "0")}:00:00Z`, 3)),
      ...[12, 15, 18, 21].map((h) => outlookRow(`2026-11-14T${h}:00:00Z`, 9)),
      ...day("2026-11-15", [3.2, 3.6, 4.4, 4.1]),
      ...day("2026-11-16", [5.5, 6.2, 6.8, 6]),
      ...day("2026-11-17", [6, 6.1, 5.9, 6.3]),
      ...day("2026-11-18", [3.1, 3, 2.8]),
    ];
    const days = aggregateOutlookDays(rows, "UTC");
    expect(days[0]).toMatchObject({ dayName: "Sun", date: "Nov 15" });
    expect(days.map((d) => [d.localDate, d.lowFt, d.highFt, d.trend])).toEqual([
      ["2026-11-15", 3, 5, "building"],
      ["2026-11-16", 5, 7, "building"],
      ["2026-11-17", 5, 7, "steady"],
    ]);
  });

  it("returns nothing when no row carries an outlook", () => {
    expect(aggregateOutlookDays(day("2026-11-15", []).concat([outlookRow("2026-11-15T00:00:00Z", null)]), "UTC")).toEqual([]);
  });
});
