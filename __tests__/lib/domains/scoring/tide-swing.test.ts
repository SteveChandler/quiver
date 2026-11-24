import {
  assessTideSwing,
  classifyTideBreak,
  classifyTideRate,
  formatTideWhen,
  softenTideBandCeiling,
  TIDE_ONLY_CEILING_FLOOR,
} from '@/lib/domains/scoring/tide-swing';
import { beachToSpotProfile, forecastToSnapshot } from '@/lib/domains/scoring';
import type { ConditionsSnapshot } from '@/lib/domains/conditions';
import type { SpotProfile } from '@/lib/domains/spot-profile';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import fixture from '../../../fixtures/tide-swing-20261027.json';

type Slug = keyof typeof fixture.beaches;

function realRow(slug: Slug, utcHour: string, overrides: Partial<EnhancedForecastEntity> = {}) {
  const row = (fixture.forecasts[slug] as unknown as EnhancedForecastEntity[])
    .find((f) => f.forecast_at.slice(11, 13) === utcHour);
  if (!row) throw new Error(`no ${slug} row at ${utcHour}Z`);
  const forecast = { ...row, ...overrides };
  return {
    snapshot: forecastToSnapshot(forecast),
    profile: beachToSpotProfile(fixture.beaches[slug] as unknown as Beach),
  };
}

describe('assessTideSwing on tomorrow\'s rows (2026-10-27)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('PB Point 11 AM (6.3 ft falling, point, band 2-4): fast water, but not fast for a point; 1.9 h from range', () => {
    const { snapshot, profile } = realRow('pb-point', '18');
    const swing = assessTideSwing(snapshot, profile);

    // (-0.9 - 6.3) / 6 h. Sensitivity "low" is only the point-break default, so the point 0.7 applies alone.
    expect(snapshot.tide.rateFtPerHour).toBe(-1.2);
    expect(profile.tidePreferences.directionSensitivity).toBe('low');
    expect(swing.rateClass).toBe('fast');
    expect(swing.effectiveRateFtPerHour).toBeCloseTo(-0.84, 3);
    expect(swing.side).toBe('high');
    expect(swing.excessFt).toBeCloseTo(2.3, 5);
    expect(swing.hoursToReenter).toBeCloseTo(2.3 / 1.2, 5);
    expect(swing.reentryMessage).toBeNull();
    expect(swing.effects).toEqual([]);

    const series = realRow('pb-point', '18', { tide_rate_ft_per_hour: -1.1 });
    expect(assessTideSwing(series.snapshot, series.profile).effectiveRateFtPerHour).toBeCloseTo(-0.77, 3);
  });

  it('Tourmaline 11 AM (6.3 ft on 2-5.5, beach): back in range by ~12 PM; small surf never walls', () => {
    const { snapshot, profile } = realRow('tourmaline', '18');
    const swing = assessTideSwing(snapshot, profile);

    expect(swing.excessFt).toBeCloseTo(0.8, 5);
    expect(swing.hoursToReenter).toBeCloseTo(0.8 / 1.2, 5);
    expect(swing.reentryMessage).toBe('Tide back in range by ~12 PM');
    expect(swing.effects).toEqual([]);
  });

  it('Tourmaline with 3.5 ft at 12 s: high water never walls, the low end of the drop does (69)', () => {
    const bigSwell = { wave_height: '3.5 ft', swell_1_height: '3.5 ft', swell_1_period: '12s', wave_period: '12s' };
    const high = realRow('tourmaline', '18', bigSwell);
    expect(high.snapshot.waveHeight).toBe(3.5);
    expect(assessTideSwing(high.snapshot, high.profile).effects).toEqual([]);

    // 2.3 ft on 2-5.5 is inside the 0.5 ft drain zone above the band floor.
    const low = realRow('tourmaline', '21', { ...bigSwell, tide_height: '2.3 ft', tide_rate_ft_per_hour: -1.2 });
    expect(assessTideSwing(low.snapshot, low.profile).effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Dropping fast, expect it to wall up as it drains' },
    ]);
  });

  it('Windansea 11 AM (6.1 ft on 0-6, reef): inside tolerance, nowhere near the reef floor, no effect', () => {
    const { snapshot, profile } = realRow('windansea', '18');
    const swing = assessTideSwing(snapshot, profile);

    expect(snapshot.tide.rateFtPerHour).toBe(-1.15);
    // "high" is the reef default, so only the reef 1.2 applies.
    expect(swing.effectiveRateFtPerHour).toBeCloseTo(-1.38, 3);
    expect(swing.effects).toEqual([]);
  });

  it('Windansea 3 PM (0.4 ft falling 1.18 ft/h on the hourly series): turning off as it drains (79)', () => {
    const { snapshot, profile } = realRow('windansea', '21', {
      forecast_at: '2026-10-27T22:00:00+00:00', tide_height: '0.4 ft', tide_rate_ft_per_hour: -1.18,
    });
    const swing = assessTideSwing(snapshot, profile);

    expect(snapshot.tide.rateSource).toBe('series');
    expect(swing.effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 79, message: 'Turning off as it drains' },
    ]);
    // 0.4 ft above the floor at 1.18 ft/h: leaves the band ~3:30 PM.
    expect(swing.warnings).toEqual(['Tide leaves its best range by ~3:30 PM']);
  });

  it('Windansea 5 PM (-0.8 ft rising on the next-high mean): 1.04 h out, so no re-entry softening', () => {
    const { snapshot, profile } = realRow('windansea', '00');
    const swing = assessTideSwing(snapshot, profile);

    expect(snapshot.tide.rateFtPerHour).toBe(0.77);
    expect(swing.side).toBe('low');
    expect(swing.hoursToReenter).toBeCloseTo(0.8 / 0.77, 5);
    expect(swing.reentryMessage).toBeNull();
    expect(swing.reasons).toEqual([]);
  });

  it('Lower Trestles 2 PM (2.1 ft falling on 2-6, reef): turning off, and it leaves the band by ~2:30 PM', () => {
    const { snapshot, profile } = realRow('lower-trestles', '21');
    const swing = assessTideSwing(snapshot, profile);

    expect(snapshot.tide.rateFtPerHour).toBe(-0.9);
    expect(swing.effectiveRateFtPerHour).toBeCloseTo(-1.08, 3);
    expect(swing.side).toBeNull();
    expect(swing.hoursToExit).toBeCloseTo(0.1 / 0.9, 5);
    expect(swing.effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 79, message: 'Turning off as it drains' },
    ]);
    expect(swing.warnings).toEqual(['Tide leaves its best range by ~2:30 PM']);
  });

  it('Lower Trestles 5 AM (2.9 ft rising on 2-6, reef): filling in, reason only', () => {
    const { snapshot, profile } = realRow('lower-trestles', '12');
    const swing = assessTideSwing(snapshot, profile);

    // (6.1 - 2.9) / 5 h x reef 1.2 = 0.77 >= 0.6.
    expect(snapshot.tide.rateFtPerHour).toBe(0.64);
    expect(swing.reasons).toEqual(['Filling in, turns on as it covers']);
    expect(swing.effects).toEqual([]);

    // 0.45 ft/h x 1.2 = 0.54: still too slow to call it filling in.
    const slow = realRow('lower-trestles', '12', { tide_rate_ft_per_hour: 0.45 });
    expect(assessTideSwing(slow.snapshot, slow.profile).reasons).toEqual([]);
  });

  it('PB Point 5 AM (2.3 ft rising on 2-4, point): filling in at a real rate, not at a slow one', () => {
    const mean = realRow('pb-point', '12');
    // (6.8 - 2.3) / 5 h x point 0.7 = 0.63.
    expect(mean.snapshot.tide.rateFtPerHour).toBe(0.9);
    expect(assessTideSwing(mean.snapshot, mean.profile).reasons).toEqual(['Filling in, turns on as it covers']);

    const slow = realRow('pb-point', '12', { tide_rate_ft_per_hour: 0.8 });
    expect(assessTideSwing(slow.snapshot, slow.profile).reasons).toEqual([]);
  });

  it('scales by tide_direction_sensitivity only when the beach curates a non-default value', () => {
    const reef = (tide_direction_sensitivity: string | null) => {
      const { snapshot, profile } = realRow('windansea', '18', { tide_rate_ft_per_hour: -1.0 });
      const curated = beachToSpotProfile({ ...(fixture.beaches.windansea as unknown as Beach), tide_direction_sensitivity } as Beach);
      return assessTideSwing(snapshot, { ...profile, tidePreferences: curated.tidePreferences }).effectiveRateFtPerHour;
    };
    expect(reef(null)).toBeCloseTo(-1.2, 3);
    expect(reef('high')).toBeCloseTo(-1.2, 3);
    expect(reef('medium')).toBeCloseTo(-1.2, 3);
    expect(reef('low')).toBeCloseTo(-0.84, 3);

    const { snapshot, profile } = realRow('pb-point', '18', { tide_rate_ft_per_hour: -1.0 });
    const curatedHigh = beachToSpotProfile({ ...(fixture.beaches['pb-point'] as unknown as Beach), tide_direction_sensitivity: 'high' } as Beach);
    expect(assessTideSwing(snapshot, { ...profile, tidePreferences: curatedHigh.tidePreferences }).effectiveRateFtPerHour)
      .toBeCloseTo(-0.91, 3);
  });

  it('Blackies (unbanded beach): no height ceiling, only walling and a slack-high warning', () => {
    const elevenAm = realRow('blackies', '18');
    expect(assessTideSwing(elevenAm.snapshot, elevenAm.profile)).toMatchObject({
      side: null, excessFt: 0, effects: [], warnings: [],
    });

    const bigSwell = { wave_height: '3.5 ft', swell_1_height: '3.5 ft', swell_1_period: '11s', wave_period: '11s' };
    const walling = realRow('blackies', '18', {
      ...bigSwell, forecast_at: '2026-10-27T22:00:00+00:00', tide_height: '1.26 ft', tide_rate_ft_per_hour: -1.0,
    });
    expect(assessTideSwing(walling.snapshot, walling.profile).effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Dropping fast, expect it to wall up as it drains' },
    ]);
    // Unbanded walling stops above 2 ft MLLW.
    const midTide = realRow('blackies', '18', {
      ...bigSwell, forecast_at: '2026-10-27T19:00:00+00:00', tide_height: '4.25 ft', tide_rate_ft_per_hour: -1.0,
    });
    expect(assessTideSwing(midTide.snapshot, midTide.profile).effects).toEqual([]);

    const slackHigh = realRow('blackies', '18', {
      forecast_at: '2026-10-27T17:00:00+00:00', tide_height: '6.25 ft', tide_status: 'High', tide_rate_ft_per_hour: 0.1,
    });
    const swing = assessTideSwing(slackHigh.snapshot, slackHigh.profile);
    expect(swing.effects).toEqual([]);
    expect(swing.warnings).toEqual(['Lots of water at the top of the tide']);
  });

  it('slack high water warns under a foot over the band and caps at 69 from a foot over', () => {
    const justOver = realRow('tourmaline', '18', { tide_height: '6.0 ft', tide_rate_ft_per_hour: 0.1 });
    const justOverSwing = assessTideSwing(justOver.snapshot, justOver.profile);
    expect(justOverSwing.effects).toEqual([]);
    expect(justOverSwing.warnings).toEqual(['Lots of water at the top of the tide']);

    const wellOver = realRow('tourmaline', '18', { tide_height: '6.6 ft', tide_rate_ft_per_hour: 0.1 });
    expect(assessTideSwing(wellOver.snapshot, wellOver.profile).effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Lots of water at the top of the tide' },
    ]);

    // 0.2 ft/h is moving water, not slack.
    const moving = realRow('tourmaline', '18', { tide_height: '6.6 ft', tide_rate_ft_per_hour: -0.2 });
    const movingSwing = assessTideSwing(moving.snapshot, moving.profile);
    expect(movingSwing.effects).toEqual([]);
    expect(movingSwing.warnings).toEqual([]);
  });

  it('does nothing without a rate or a real tide reading', () => {
    const { snapshot, profile } = realRow('tourmaline', '18', { next_tide_at: null });
    expect(snapshot.tide.rateFtPerHour).toBeNull();
    expect(assessTideSwing(snapshot, profile)).toMatchObject({
      rateClass: 'unknown', effects: [], reasons: [], warnings: [], reentryMessage: null, hoursToReenter: null,
    });
    const missing = realRow('tourmaline', '18', { tide_height: null });
    expect(assessTideSwing(missing.snapshot, missing.profile).effects).toEqual([]);
  });
});

describe('tide-only ceilings never go below FAIR', () => {
  const base: Pick<ConditionsSnapshot, 'waveHeight' | 'wavePeriod' | 'timestamp'> = {
    waveHeight: 6, wavePeriod: 16, timestamp: new Date('2026-10-27T18:00:00Z'),
  };
  const profiles: Array<Pick<SpotProfile, 'tidePreferences' | 'breakType' | 'timezone'>> = [];
  for (const breakType of ['beach', 'reef', 'point', 'jetty', null]) {
    for (const directionSensitivity of ['low', 'medium', 'high'] as const) {
      for (const explicitRange of [true, false]) {
        profiles.push({
          breakType,
          timezone: 'America/Los_Angeles',
          tidePreferences: { minHeightFt: 1, maxHeightFt: 3, preferredDirection: 'rising', directionSensitivity, explicitRange },
        });
      }
    }
  }

  it('holds across heights, rates and break types', () => {
    for (const profile of profiles) {
      for (let heightFt = -2; heightFt <= 8; heightFt += 0.25) {
        for (const rateFtPerHour of [-3, -1.5, -1, -0.6, -0.2, 0, 0.2, 0.6, 1, 1.5, 3]) {
          const swing = assessTideSwing(
            { ...base, tide: { heightFt, status: 'rising', direction: 'rising', heightKnown: true, rateFtPerHour } },
            profile,
          );
          for (const effect of swing.effects) {
            expect(effect.verdictCeiling).toBeGreaterThanOrEqual(TIDE_ONLY_CEILING_FLOOR);
          }
        }
      }
    }
  });

  it('softens one tier and never past the mildest', () => {
    expect(softenTideBandCeiling(55)).toBe(69);
    expect(softenTideBandCeiling(69)).toBe(79);
    expect(softenTideBandCeiling(79)).toBe(79);
  });
});

describe('tide-swing helpers', () => {
  it('classifies the beaches.break_type vocabulary', () => {
    expect(classifyTideBreak('beach')).toBe('beach');
    expect(classifyTideBreak('pier')).toBe('beach');
    expect(classifyTideBreak('Reef Break')).toBe('reef');
    expect(classifyTideBreak('point')).toBe('point');
    expect(classifyTideBreak('jetty')).toBe('jetty');
    expect(classifyTideBreak('breakwater')).toBe('jetty');
    expect(classifyTideBreak('river-mouth')).toBe('unknown');
    expect(classifyTideBreak(null)).toBe('unknown');
  });

  it('classifies raw water movement', () => {
    expect(classifyTideRate(null)).toBe('unknown');
    expect(classifyTideRate(-1.0)).toBe('fast');
    expect(classifyTideRate(0.6)).toBe('moderate');
    expect(classifyTideRate(-0.45)).toBe('gentle');
    expect(classifyTideRate(0.29)).toBe('gentle');
    expect(classifyTideRate(-0.19)).toBe('slack');
  });

  it('formats the clock time in the beach timezone, rounded up to the half hour', () => {
    const from = new Date('2026-10-27T18:00:00Z');
    expect(formatTideWhen(from, 0.67, 'America/Los_Angeles')).toBe('by ~12 PM');
    expect(formatTideWhen(from, 0.2, 'America/Los_Angeles')).toBe('by ~11:30 AM');
    expect(formatTideWhen(from, 0.2, 'Pacific/Honolulu')).toBe('by ~8:30 AM');
  });

  it('falls back to "within the hour" without a usable timezone', () => {
    const from = new Date('2026-10-27T18:00:00Z');
    expect(formatTideWhen(from, 0.5, 'Not/AZone')).toBe('within the hour');
    expect(formatTideWhen(from, 0.5, '')).toBe('within the hour');
    expect(formatTideWhen(new Date('nope'), 0.5, 'America/Los_Angeles')).toBe('within the hour');
  });
});

describe('7-day replay cases (50 CA beaches)', () => {
  function replay(
    band: { minFt: number; maxFt: number },
    heightFt: number,
    rateFtPerHour: number,
    swell: { waveHeight: number; wavePeriod: number } = { waveHeight: 2, wavePeriod: 10 },
  ) {
    return assessTideSwing(
      {
        ...swell,
        timestamp: new Date('2026-10-20T19:00:00Z'),
        tide: {
          heightFt,
          status: rateFtPerHour < 0 ? 'falling' : 'rising',
          direction: rateFtPerHour < 0 ? 'falling' : 'rising',
          heightKnown: true,
          rateFtPerHour,
        },
      },
      {
        breakType: 'beach',
        timezone: 'America/Los_Angeles',
        tidePreferences: { minHeightFt: band.minFt, maxHeightFt: band.maxFt, preferredDirection: 'either', directionSensitivity: 'medium', explicitRange: true },
      },
    );
  }

  it('Del Mar 4.3 ft falling 0.25 ft/h on 0-4: no slack-high cap (was 69)', () => {
    const swing = replay({ minFt: 0, maxFt: 4 }, 4.3, -0.25);
    expect(swing.rateClass).toBe('gentle');
    expect(swing.effects).toEqual([]);
    expect(swing.warnings).toEqual([]);
  });

  it('Ocean Beach 4.8 ft barely moving on 1-4: a warning, never a 69 cap', () => {
    const swing = replay({ minFt: 1, maxFt: 4 }, 4.8, 0.1);
    expect(swing.effects).toEqual([]);
    expect(swing.warnings).toEqual(['Lots of water at the top of the tide']);
  });

  it('Ocean Beach SF 2.6 ft draining 1 ft/h on 2-6 with 3.6 ft @ 10 s: no walling cap (was 69)', () => {
    expect(replay({ minFt: 2, maxFt: 6 }, 2.6, -1.0, { waveHeight: 3.6, wavePeriod: 10 }).effects).toEqual([]);
  });

  it('Pismo 2.3 ft draining 1.45 ft/h on 2-6 with 3.6 ft @ 14 s: still walls up (69)', () => {
    expect(replay({ minFt: 2, maxFt: 6 }, 2.3, -1.45, { waveHeight: 3.6, wavePeriod: 14 }).effects).toEqual([
      { code: 'tide_swing', severity: 'material', verdictCeiling: 69, message: 'Dropping fast, expect it to wall up as it drains' },
    ]);
  });
});
