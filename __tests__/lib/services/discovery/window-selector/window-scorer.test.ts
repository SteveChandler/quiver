import {
  scoreWindowConditionDetails,
  scoreWindowWithComposite,
} from '@/lib/services/discovery/window-selector/window-scorer';
import type { BoardClass } from '@/lib/domains/rideability/board-class';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import tideSwingDay from '../../../../fixtures/tide-swing-20261027.json';

function beach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: 'beach-1', name: 'Church', slug: 'church', shoaling_factors: {},
    wind_offshore_deg: 90, wind_offshore_tol_deg: 45,
    swell_window_center_deg: 218, swell_window_halfwidth_deg: 118,
    break_type: 'beach', aspect_deg: 270,
    ...overrides,
  } as Beach;
}

function forecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1', beach_id: 'beach-1', forecast_at: '2026-05-01T18:00:00Z',
    wave_height: '2 ft', wave_period: '9s', swell_1_period: '9s',
    swell_1_direction: 'SSW', wind_speed: '8 mph', wind_direction: 'W',
    tide_height: '3 ft', tide_status: 'Rising', data_source: 'NOAA_NWS',
    ...overrides,
  } as EnhancedForecastEntity;
}

describe('direction scoring window scorer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DIRECTION_SCORING_ENABLED: 'true' };
    delete process.env.DIRECTION_SCORING_ALLOWED_SLUGS;
    delete process.env.DIRECTION_SCORING_EXCLUDED_SLUGS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('changes wind and swell direction scores while leaving excluded beaches unchanged', () => {
    const aligned = scoreWindowConditionDetails(
      forecast({ swell_1_direction: 'SSW', wind_direction: 'E' }), beach(), 'intermediate', null, [],
    );
    const poor = scoreWindowConditionDetails(
      forecast({ wave_height: '3 ft', swell_1_direction: 'WNW', wind_direction: 'W', wind_speed: '8 mph' }), beach(), 'intermediate', null, [],
    );
    const excluded = scoreWindowConditionDetails(
      forecast({ swell_1_direction: 'WNW', wind_direction: 'W' }), beach({ slug: 'avalanche' }), 'intermediate', null, [],
    );

    expect(aligned.score).toBeGreaterThan(poor.score);
    expect(poor.appliedEffects).toContain('wind_chop');
    expect(excluded.appliedEffects).not.toContain('wind_chop');
  });

  it('keeps missing directions neutral and flag-off output legacy', () => {
    const missing = scoreWindowConditionDetails(
      forecast({ swell_1_direction: null, wind_direction: null }), beach(), 'intermediate', null, [],
    );
    const enabled = scoreWindowConditionDetails(
      forecast({ wave_period: '13s', swell_1_period: '13s', swell_1_direction: 'SSW' }),
      beach(), 'intermediate', null, [],
    );
    process.env.DIRECTION_SCORING_ENABLED = 'false';
    const disabled = scoreWindowConditionDetails(forecast(), beach(), 'intermediate', null, [],);

    expect(missing.components.windQuality).toBe(missing.components.wind);
    expect(missing.components.swellAlignment).toBe(15);
    expect(disabled.components.windQuality).toBeUndefined();
    expect(disabled.components.swellAlignment).toBeUndefined();
    expect(enabled.components.windQuality).not.toBeUndefined();
  });

  it('keeps wind quality neutral when offshore and facing direction are both missing', () => {
    const result = scoreWindowConditionDetails(forecast({ wind_direction: 'N', wind_speed: '8 mph' }), beach({ wind_offshore_deg: null, aspect_deg: null }), 'intermediate', null, []);
    expect(result.components.windQuality).toBe(result.components.wind);
  });

  it('derives offshore from the facing direction when offshore is missing', () => {
    const derived = scoreWindowConditionDetails(forecast({ wind_direction: 'W', wind_speed: '8 mph' }), beach({ wind_offshore_deg: null, wind_offshore_tol_deg: null, aspect_deg: 270 }), 'intermediate', null, []);
    const stored = scoreWindowConditionDetails(forecast({ wind_direction: 'W', wind_speed: '8 mph' }), beach({ wind_offshore_deg: 90, wind_offshore_tol_deg: 30, aspect_deg: 270 }), 'intermediate', null, []);
    expect(derived.components.windQuality).toBe(stored.components.windQuality);
    expect(derived.components.windQuality).toBeLessThan(derived.components.wind);
  });
});

describe('curated tide band ceiling', () => {
  // Ponto's beach row and its 2026-09-23 15:00Z forecast (the 8 AM PT row).
  const ponto = (overrides: Partial<Beach> = {}): Beach => beach({
    name: 'Ponto', slug: 'ponto', preferred_tide_ft_min: 2, preferred_tide_ft_max: 4,
    preferred_tide_direction: 'falling', wind_offshore_deg: 45, wind_offshore_tol_deg: 30,
    swell_window_center_deg: 265, swell_window_halfwidth_deg: 105, ...overrides,
  });
  const epicDay = (tide_height: string): EnhancedForecastEntity => forecast({
    wave_height: '3.7 ft', wave_period: '15s', wave_direction: 'WSW',
    swell_1_height: '2.2 ft', swell_1_period: '17s', swell_1_direction: 'WSW',
    swell_2_height: '1.7 ft', swell_2_period: '4s', swell_2_direction: 'W',
    wind_wave_height: '0.6 ft', wind_wave_period: '9s', wind_wave_direction: 'WSW',
    wind_speed: '3 mph', wind_direction: 'SSE', wind_direction_deg: 153,
    confidence_score: 100, data_source: 'CDIP', tide_height, tide_status: 'Falling',
  });
  const boards: BoardClass[] = ['shortboard', 'fish', 'longboard'];

  it('keeps an in-band tide uncapped and caps a high tide below EPIC', () => {
    const inBand = scoreWindowConditionDetails(epicDay('3.7 ft'), ponto(), 'advanced', null, boards);
    const high = scoreWindowConditionDetails(epicDay('4.4 ft'), ponto(), 'advanced', null, boards);

    expect(inBand.score).toBeGreaterThanOrEqual(80);
    expect(inBand.appliedEffects).not.toContain('tide_outside_band');
    expect(high.score).toBe(79);
    expect(high.appliedEffects).toContain('tide_outside_band');
  });

  it('leaves a beach without a curated band unchanged', () => {
    const uncurated = ponto({ preferred_tide_ft_min: null, preferred_tide_ft_max: null });
    const result = scoreWindowConditionDetails(epicDay('4.4 ft'), uncurated, 'advanced', null, boards);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.appliedEffects).not.toContain('tide_outside_band');
  });
});

describe('band-aware tide term on tomorrow\'s rows (2026-10-27, intermediate, no board)', () => {
  type Slug = keyof typeof tideSwingDay.beaches;
  const slugs = Object.keys(tideSwingDay.beaches).sort() as Slug[];
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DIRECTION_SCORING_ENABLED;
    delete process.env.TIDE_SWING_ENABLED;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function shown(slug: Slug) {
    const beachRow = tideSwingDay.beaches[slug] as unknown as Beach;
    return (tideSwingDay.forecasts[slug] as unknown as EnhancedForecastEntity[])
      .map((row) => scoreWindowConditionDetails(row, beachRow, 'intermediate'));
  }

  // 5, 8, 11 AM, 2, 5 PM PDT. Prod's displayed scores for these rows, before this change.
  const today: Record<Slug, number[]> = {
    'blackies': [33, 32, 32, 28, 32],
    'lower-trestles': [52, 65, 59, 61, 55],
    'pb-point': [47, 39, 37, 44, 36],
    'tourmaline': [49, 41, 39, 42, 47],
    'windansea': [67, 65, 59, 65, 65],
  };

  it('flag off reproduces today\'s displayed scores and the fixed tide term exactly', () => {
    for (const slug of slugs) {
      const details = shown(slug);
      expect(details.map((d) => d.score)).toEqual(today[slug]);
      const rows = tideSwingDay.forecasts[slug] as unknown as EnhancedForecastEntity[];
      // 2.x ft rising/falling -> 10, 5.x ft moving -> 7, 6+ ft or below 0.5 moving -> 4.
      expect(details.map((d) => d.components.tide)).toEqual(rows.map((row) => {
        const ft = parseFloat(row.tide_height ?? '');
        return ft >= 1.5 && ft <= 4.5 ? 10 : ft >= 0.5 && ft <= 6 ? 7 : 4;
      }));
    }
  });

  it('flag on follows each beach\'s band; unbanded Blackies is unchanged', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    const tide = (slug: Slug) => shown(slug).map((d) => Math.round(d.components.tide * 100) / 100);

    expect(shown('blackies').map((d) => d.score)).toEqual(today.blackies);
    expect(tide('blackies')).toEqual([10, 7, 7, 10, 4]);
    // 2-4 point: 5.7 ft at 8 AM loses points, 6.3 ft at 11 AM was already at the floor.
    expect(shown('pb-point').map((d) => d.score)).toEqual([47, 38, 37, 44, 36]);
    expect(tide('pb-point')).toEqual([10, 5.65, 4, 10, 4]);
    // 2-5.5 beach: 5.7 ft is in tolerance, 6.3 ft is 0.55 ft past it.
    expect(shown('tourmaline').map((d) => d.score)).toEqual([49, 44, 43, 42, 47]);
    expect(tide('tourmaline')).toEqual([10, 10, 8.35, 10, 4]);
    // 0-6 reef: high water is in its band.
    expect(shown('windansea').map((d) => d.score)).toEqual([67, 65, 65, 65, 65]);
    expect(tide('windansea')).toEqual([10, 10, 10, 10, 8.35]);
    // 2-6 reef.
    expect(shown('lower-trestles').map((d) => d.score)).toEqual([52, 65, 62, 61, 55]);
    expect(tide('lower-trestles')).toEqual([10, 10, 10, 10, 4]);
  });

  it('flag on: Tourmaline 11 AM says when the tide is back, PB Point keeps its 55', () => {
    process.env.TIDE_SWING_ENABLED = 'true';
    const eleven = (slug: Slug) => scoreWindowWithComposite(
      (tideSwingDay.forecasts[slug] as unknown as EnhancedForecastEntity[])[2],
      tideSwingDay.beaches[slug] as unknown as Beach,
    );
    expect(eleven('tourmaline').effects).toContainEqual(
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 79, message: 'Tide back in range by ~12 PM' },
    );
    expect(eleven('pb-point').effects).toContainEqual(
      { code: 'tide_outside_band', severity: 'material', verdictCeiling: 55, message: 'Tide is high' },
    );
    expect(shown('pb-point')[2].decisionCeiling).toBe(55);
    // Every tide-only ceiling stays at or above FAIR.
    for (const slug of slugs) {
      for (const d of shown(slug)) expect(d.decisionCeiling).toBeGreaterThanOrEqual(55);
    }
  });
});


describe('composite skip ceiling', () => {
  // Ocean Beach Pier's beach row and its 2026-11-01 21:00Z forecast. Dev served this hour as
  // MAYBE 65 beside the character "Onshore wind — conditions blown out".
  const obp = (): Beach => beach({
    id: '65d177de-e75a-4ad8-aa0d-48a67c0851b0', name: 'Ocean Beach Pier', slug: 'ocean-beach-pier',
    aspect_deg: 260, skill_level: 'advanced', wind_offshore_deg: 90, wind_offshore_tol_deg: 45,
    swell_window_center_deg: 293, swell_window_halfwidth_deg: 73,
    preferred_tide_ft_min: 0, preferred_tide_ft_max: 4, preferred_tide_direction: 'rising',
  });
  const hour = (wind_speed: string, wind_direction_deg: number): EnhancedForecastEntity => forecast({
    beach_id: '65d177de-e75a-4ad8-aa0d-48a67c0851b0', forecast_at: '2026-11-01T21:00:00Z',
    wave_height: '3.2 ft', wave_period: '14s', wave_direction: 'SSW',
    swell_1_height: '4.2 ft', swell_1_period: '16s', swell_1_direction: 'SSW',
    wind_wave_height: '1 ft', wind_wave_period: '9s',
    wind_speed, wind_direction: 'WNW', wind_direction_deg,
    tide_height: '4.7 ft', tide_status: 'Falling', data_source: 'CDIP', confidence_score: 100,
  });
  const boards: BoardClass[] = ['shortboard', 'longboard'];
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DIRECTION_SCORING_ENABLED;
    delete process.env.TIDE_SWING_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('holds a blown-out onshore hour at MEH, with or without boards', () => {
    const blownOut = hour('22 mph', 299);
    expect(scoreWindowWithComposite(blownOut, obp()).skipReason).toBe('Blown out (22 mph onshore)');

    const noBoard = scoreWindowConditionDetails(blownOut, obp(), 'advanced', null, []);
    const withBoards = scoreWindowConditionDetails(blownOut, obp(), 'advanced', null, boards);

    expect(noBoard.score).toBe(39);
    expect(withBoards.score).toBe(39);
    expect(noBoard.decisionCeiling).toBe(39);
    expect(noBoard.appliedEffects).toContain('composite_skip');
  });

  it('leaves a choppy hour below the blown-out tier to the condition score', () => {
    const choppy = hour('20 mph', 283);
    expect(scoreWindowWithComposite(choppy, obp()).skipReason).toBeNull();

    const details = scoreWindowConditionDetails(choppy, obp(), 'advanced', null, []);

    expect(details.decisionCeiling).toBeGreaterThan(39);
    expect(details.score).toBeGreaterThan(39);
    expect(details.appliedEffects).not.toContain('composite_skip');
  });
});
