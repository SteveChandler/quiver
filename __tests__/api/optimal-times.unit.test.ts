import {
  parseTimeToHour,
  filterByTimeWindow,
  scoreForecast,
  analyzeOptimalTimes,
  buildTwoHourBlocks,
} from "@/lib/session-planner/optimal-times-utils";
import { computeHourScoreBreakdown, computeHourScore, clamp01 } from '@/lib/surf/scoring';
import { topMorningWindows, buildTwoHourWindows } from '@/lib/surf/windows';

// Minimal mock forecast row factory
function fc(time: string, attrs: Partial<any> = {}) {
  return {
    id: `test-${time}`,
    beach_id: "beach-1",
    forecast_date: "2025-01-01",
    forecast_time: time,
    wave_height: "3",
    wave_period: null,
    wave_direction: null,
    swell_1_height: null,
    swell_1_period: null,
    swell_1_direction: null,
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: "5 mph",
    wind_direction: "NE",
    wind_direction_deg: null,
    water_temp: null,
    tide_status: null,
    tide_height: "2.5",
    next_tide_time: null,
    next_tide_type: null,
    next_tide_height: null,
    next_tide_at: null,
    coops_station_id: null,
    air_temperature: null,
    weather_condition: "Clear",
    confidence_score: 0.7,
    data_source: "NOAA_NWS",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tide_type: "rising",
    swell_period: 12,
    ...attrs,
  };
}

describe("Optimal Times utilities", () => {
  test("parseTimeToHour handles HH:MM:SS, HH:MM, AM/PM, ISO", () => {
    expect(parseTimeToHour("15:00:00")).toBeCloseTo(15, 5);
    expect(parseTimeToHour("06:30")).toBeCloseTo(6.5, 5);
    expect(parseTimeToHour("03:10 PM")).toBeCloseTo(15.166, 2);

    const iso = new Date("2025-01-01T03:10:00Z");
    const h = iso.getHours() + iso.getMinutes() / 60;
    expect(parseTimeToHour("2025-01-01T03:10:00Z")).toBeCloseTo(h, 5);
  });

  test("filterByTimeWindow keeps ±2h around selected time", () => {
    const forecasts = [
      fc("12:00:00"),
      fc("14:00:00"),
      fc("15:00:00"),
      fc("16:00:00"),
      fc("18:00:00"),
      fc("21:00:00"),
    ];

    const around1510 = filterByTimeWindow(forecasts as any[], "15:10", 2);
    const hours = around1510.map((f) => parseTimeToHour(f.forecast_time)!);
    // Should include approx 13:10..17:10 → 14,15,16 are inside; 12,18,21 out
    expect(hours).toEqual(expect.arrayContaining([14, 15, 16]));
    expect(hours).not.toEqual(expect.arrayContaining([12, 18, 21]));
  });

  test("scoreForecast emphasizes mid/rising tide and offshore winds", () => {
    const s = scoreForecast(fc("15:00:00"));
    expect(s.score).toBeGreaterThanOrEqual(50);
    expect(s.reasons.join(" ").toLowerCase()).toContain("rising tide");
    expect(s.reasons.join(" ").toLowerCase()).toContain("mid tide");
    expect(s.reasons.join(" ").toLowerCase()).toContain("offshore");
  });

  test("analyzeOptimalTimes restricts to selected window and sorts by score", () => {
    const forecasts = [
      fc("00:00:00", { wind_speed: "20 mph" }),
      fc("14:00:00"),
      fc("15:00:00"),
      fc("16:00:00"),
      fc("21:00:00", { wind_speed: "20 mph" }),
    ];
    const result = analyzeOptimalTimes(forecasts as any[], "15:10");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((r: { time: string }) => {
      const h = parseTimeToHour(r.time)!;
      expect(h).toBeGreaterThanOrEqual(13);
      expect(h).toBeLessThanOrEqual(17);
    });
  });

  test("buildTwoHourBlocks creates ranges and averages score", () => {
    const scored = [
      scoreForecast(fc("14:00:00")),
      scoreForecast(fc("15:00:00")),
      scoreForecast(fc("16:00:00")),
    ];
    const blocks = buildTwoHourBlocks(scored);
    expect(blocks.length).toBeGreaterThan(0);
    const b = blocks[0];
    expect(b.startTime).toBeDefined();
    expect(b.endTime).toBeDefined();
    expect(typeof b.score).toBe("number");
  });
});

describe('computeHourScore edge cases', () => {
	const params = {
		windOffshoreDeg: 270,
		windCrossOkKts: 8,
		swellWindowMinDeg: 220,
		swellWindowMaxDeg: 280,
		tidePreferredFtMin: 1,
		tidePreferredFtMax: 3,
	};

	it('perfect offshore low wind → high windScore', () => {
		const b = computeHourScoreBreakdown({
			params,
			waveDirectionDeg: 250,
			wavePeriodS: 12,
			windDirectionDeg: 270,
			windSpeedMs: 1,
			tideHeightM: 0.6,
		});
		expect(b.windScore).toBeGreaterThan(0.9);
	});

	it('strong onshore wind → low windScore', () => {
		const b = computeHourScoreBreakdown({
			params,
			waveDirectionDeg: 250,
			wavePeriodS: 12,
			windDirectionDeg: 90, // onshore
			windSpeedMs: 12, // ~23 kts
			tideHeightM: 0.6,
		});
		expect(b.windScore).toBeLessThan(0.2);
	});

	it('outside swell window → low swell score', () => {
		const b = computeHourScoreBreakdown({
			params,
			waveDirectionDeg: 150,
			wavePeriodS: 12,
			windDirectionDeg: 270,
			windSpeedMs: 2,
			tideHeightM: 0.6,
		});
		expect(b.swellDirScore).toBeLessThan(0.2);
	});

	it('tide outside band → lower tideScore', () => {
		const centerFt = (params.tidePreferredFtMin + params.tidePreferredFtMax) / 2;
		const ideal = computeHourScoreBreakdown({
			params,
			waveDirectionDeg: 250,
			wavePeriodS: 12,
			windDirectionDeg: 270,
			windSpeedMs: 1,
			tideHeightM: centerFt / 3.28084,
		});
		const far = computeHourScoreBreakdown({
			params,
			waveDirectionDeg: 250,
			wavePeriodS: 12,
			windDirectionDeg: 270,
			windSpeedMs: 1,
			tideHeightM: 6 / 3.28084,
		});
		expect(ideal.tideScore).toBeGreaterThan(far.tideScore);
	});
});

describe('topMorningWindows non-overlap and limit', () => {
	it('limits to ≤3 and avoids overlapping windows', () => {
		const base = new Date('2025-08-15T12:00:00.000Z');
		const hours = Array.from({ length: 10 }).map((_, i) => ({
			ts: new Date(base.getTime() + i * 3600_000).toISOString(),
			waveDirectionDeg: 250,
			wavePeriodS: 12,
			windDirectionDeg: 270,
			windSpeedMs: 2,
			tideHeightM: 0.6,
			params: {
				windOffshoreDeg: 270,
				windCrossOkKts: 10,
				swellWindowMinDeg: 220,
				swellWindowMaxDeg: 280,
				tidePreferredFtMin: 1,
				tidePreferredFtMax: 3,
			},
		}));
		const windows = topMorningWindows(hours, { tz: 'UTC', startHour: 12, endHour: 20, limit: 3 });
		expect(windows.length).toBeLessThanOrEqual(3);
		for (let i = 0; i < windows.length; i++) {
			for (let j = i + 1; j < windows.length; j++) {
				const a = windows[i];
				const b = windows[j];
				expect(new Date(a.endTs) <= new Date(b.startTs) || new Date(a.startTs) >= new Date(b.endTs)).toBe(true);
			}
		}
	});
});
