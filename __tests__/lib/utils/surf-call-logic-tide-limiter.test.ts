/**
 * The tide reason reaches the surf call's why sentence (TIDE_SWING_ENABLED).
 * Rows are tomorrow's real prod rows (Tue 2026-10-27, La Jolla 6.59 ft high at
 * 09:47, -0.84 ft low at 16:57 PDT). Hourly rows carry each beach's real hourly
 * tide series and rate; swell and wind come from the 3-hourly row in effect.
 */
import { computeSurfCall } from '@/lib/utils/surf-call-logic';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';
import fixture from '../../fixtures/tide-swing-20261027.json';
import tideFixture from '../../fixtures/tide-swing-20261027-tides.json';
import { bridgeForecastsHourly } from '@/lib/services/forecast/hourly-bridge';
import type { TideSeriesSample } from '@/lib/services/tide-series-loader';

type Slug = keyof typeof fixture.beaches;
type HourlyTide = ReadonlyArray<readonly [utcHour: string, heightFt: number, rateFtPerHour: number]>;

const HOUR_MS = 3_600_000;
const originalFlag = process.env.TIDE_SWING_ENABLED;

/** PB Point and Tourmaline share this series, 8 AM to 5 PM PDT. */
const LA_JOLLA_TIDE: HourlyTide = [
  ['15', 5.7, 1.02], ['16', 6.5, 0.54], ['17', 6.8, -0.12], ['18', 6.3, -0.8],
  ['19', 5.2, -1.34], ['20', 3.6, -1.62], ['21', 2.0, -1.58], ['22', 0.5, -1.25],
  ['23', -0.5, -0.68], ['00', -0.9, -0.01],
];
/** 2 PM to 5 PM PDT. */
const LOWER_TRESTLES_TIDE: HourlyTide = [
  ['21', 2.1, -1.0], ['22', 1.1, -1.0], ['23', 0.1, -0.84], ['00', -0.6, 0.03],
];

function beachOf(slug: Slug): Beach {
  return fixture.beaches[slug] as unknown as Beach;
}

function rowsOf(slug: Slug): EnhancedForecastEntity[] {
  return fixture.forecasts[slug] as unknown as EnhancedForecastEntity[];
}

function hourlyRows(slug: Slug, tide: HourlyTide, overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity[] {
  const raw = rowsOf(slug);
  return tide.map(([utcHour, heightFt, rate]) => {
    const at = `${utcHour === '00' ? '2026-10-28' : '2026-10-27'}T${utcHour}:00:00+00:00`;
    const inEffect = [...raw].reverse().find((row) => Date.parse(row.forecast_at) <= Date.parse(at)) ?? raw[0];
    return {
      ...inEffect,
      ...overrides,
      id: `${inEffect.id}:h${utcHour}`,
      forecast_at: at,
      tide_height: `${heightFt} ft`,
      tide_status: Math.abs(rate) < 0.1 ? 'High' : rate > 0 ? 'Rising' : 'Falling',
      tide_rate_ft_per_hour: rate,
    };
  });
}

/** Drops the secondary swell so the crossing-swell ceiling (65) doesn't sit below the tide's. */
const SINGLE_SWELL: Partial<EnhancedForecastEntity> = {
  swell_2_height: null,
  swell_2_period: null,
  swell_2_direction: null,
};

function singleSwellTourmaline(): EnhancedForecastEntity[] {
  return hourlyRows('tourmaline', LA_JOLLA_TIDE, SINGLE_SWELL);
}

/** Glassy, so the wind lines don't answer first and today's falling-tide line does. */
function glassySingleSwellTourmaline(): EnhancedForecastEntity[] {
  return hourlyRows('tourmaline', LA_JOLLA_TIDE, { ...SINGLE_SWELL, wind_speed: '1 mph' });
}

const TOURMALINE_11AM_FLAG_OFF = 'Good swell, but tide is dropping through the window.';

function windowAt(row: EnhancedForecastEntity, score: number): PersonalizedForecastWindow {
  const start = new Date(row.forecast_at);
  return {
    start,
    end: new Date(start.getTime() + 2 * HOUR_MS),
    tide: row.tide_status ?? 'Unknown',
    wind: `${row.wind_speed} ${row.wind_direction}`,
    waveHeight: row.wave_height ?? 'Unknown',
    wavePeriod: row.wave_period ?? 'Unknown',
    dataSource: 'CDIP',
    confidence: 80,
    timezone: 'America/Los_Angeles',
    score,
    peakTime: start,
    sourceForecast: row,
  };
}

function callAt(slug: Slug, utcHour: string, score: number, rows: EnhancedForecastEntity[] = rowsOf(slug)) {
  const row = rows.find((candidate) => candidate.forecast_at.slice(11, 13) === utcHour);
  if (!row) throw new Error(`no ${slug} row at ${utcHour}Z`);
  return computeSurfCall(windowAt(row, score), rows, beachOf(slug), { isTomorrow: true });
}

function withFlag(enabled: boolean): void {
  if (enabled) process.env.TIDE_SWING_ENABLED = 'true';
  else delete process.env.TIDE_SWING_ENABLED;
}

afterEach(() => {
  if (originalFlag === undefined) delete process.env.TIDE_SWING_ENABLED;
  else process.env.TIDE_SWING_ENABLED = originalFlag;
});

describe('computeSurfCall tide limiter', () => {
  describe('flag off keeps today\'s sentences', () => {
    beforeEach(() => withFlag(false));

    it.each([
      ['tourmaline', '00', 45, 'Size is there, but onshore wind hurts shape.'],
      ['lower-trestles', '00', 55, 'Size is there, but onshore wind hurts shape.'],
      ['tourmaline', '18', 45, 'Size is there, but onshore wind hurts shape.'],
      ['pb-point', '18', 45, 'Small for this break but conditions look fun — 1.4 ft with manageable wind.'],
    ] as const)('%s at %s:00Z', (slug, hour, score, sentence) => {
      expect(callAt(slug, hour, score).whySentence).toBe(sentence);
    });

    it('hourly rows with a series rate change nothing', () => {
      expect(callAt('pb-point', '17', 45, hourlyRows('pb-point', LA_JOLLA_TIDE)).whySentence)
        .toBe('Small for this break but conditions look fun — 1.6 ft with manageable wind.');
      expect(callAt('lower-trestles', '00', 55, hourlyRows('lower-trestles', LOWER_TRESTLES_TIDE)).whySentence)
        .toBe('Size is there, but onshore wind hurts shape.');
      expect(callAt('tourmaline', '18', 45, glassySingleSwellTourmaline()).whySentence)
        .toBe(TOURMALINE_11AM_FLAG_OFF);
    });
  });

  describe('flag on', () => {
    beforeEach(() => withFlag(true));

    it('PB Point at the 10 AM high names the water and the in-band hours after it', () => {
      const call = callAt('pb-point', '17', 45, hourlyRows('pb-point', LA_JOLLA_TIDE));
      expect(call.verdict).toBe('MAYBE');
      expect(call.whySentence).toBe('Small for this break, but a lot of water until the tide drops — better 1–2 PM.');
    });

    it('on 3-hourly rows the one in-band row after the high is named alone', () => {
      expect(callAt('pb-point', '18', 45).whySentence)
        .toBe('Small for this break, but a lot of water until the tide drops — better around 2 PM.');
    });

    it('a low tide that binds outranks the onshore line, with no times when no in-band row follows', () => {
      expect(callAt('tourmaline', '00', 45).whySentence)
        .toBe('Size is there, but not enough water until the tide fills in.');
      expect(callAt('lower-trestles', '00', 55, hourlyRows('lower-trestles', LOWER_TRESTLES_TIDE)).whySentence)
        .toBe('Size is there, but not enough water until the tide fills in.');
    });

    it('never names a night hour as the better span', () => {
      const evening = rowsOf('tourmaline').find((row) => row.forecast_at.startsWith('2026-10-28T00'))!;
      const night = { ...evening, id: 'night', forecast_at: '2026-10-28T04:00:00+00:00', tide_height: '3 ft' };
      expect(callAt('tourmaline', '00', 45, [...rowsOf('tourmaline'), night]).whySentence)
        .toBe('Size is there, but not enough water until the tide fills in.');
    });

    it('a falling high tide back in range within the hour says when, not the generic dropping line', () => {
      const call = callAt('tourmaline', '18', 45, glassySingleSwellTourmaline());
      expect(call.tidePhase).toBe('falling');
      expect(call.whySentence).toBe('Size is there; tide back in range by ~12 PM.');
    });

    it('keeps the wind line when another ceiling (crossing swells) sits below the tide\'s', () => {
      expect(callAt('tourmaline', '18', 45).whySentence).toBe('Size is there, but onshore wind hurts shape.');
    });

    it('a tide back in range within the hour says when', () => {
      // Single swell so the crossing-swell ceiling (65) doesn't sit below the softened tide one (79).
      const rows = hourlyRows('pb-point', LA_JOLLA_TIDE, SINGLE_SWELL);
      expect(callAt('pb-point', '19', 45, rows).whySentence).toBe('Small for this break; tide back in range by ~1 PM.');
    });

    it('a YES the tide holds down leads with the size', () => {
      const rows = singleSwellTourmaline();
      const row = rows.find((candidate) => candidate.forecast_at.slice(11, 13) === '18')!;
      const call = computeSurfCall(windowAt(row, 75), rows, beachOf('tourmaline'), { isTomorrow: true, verdict: 'YES' });
      expect(call.whySentence).toBe('Good size; tide back in range by ~12 PM.');
    });

    it('stays under ~110 characters', () => {
      const sentences = [
        callAt('pb-point', '17', 45, hourlyRows('pb-point', LA_JOLLA_TIDE)).whySentence,
        callAt('pb-point', '18', 45).whySentence,
        callAt('tourmaline', '00', 45).whySentence,
      ];
      for (const sentence of sentences) expect(sentence.length).toBeLessThanOrEqual(110);
    });
  });
});

describe('computeSurfCall tide handoff (bridged hourly rows)', () => {
  function bridged(slug: Slug): EnhancedForecastEntity[] {
    const beach = beachOf(slug);
    const series: TideSeriesSample[] = tideFixture.tides[slug].map((sample) => ({ ts: sample.ts, heightFt: sample.ft }));
    return bridgeForecastsHourly(rowsOf(slug), series, { timezone: beach.timezone ?? undefined });
  }

  function callFor(slug: Slug, startIso: string, endIso: string, peakIso: string, score: number): string {
    const rows = bridged(slug);
    const peakRow = rows.reduce((best, row) =>
      Math.abs(Date.parse(row.forecast_at) - Date.parse(peakIso)) < Math.abs(Date.parse(best.forecast_at) - Date.parse(peakIso))
        ? row : best);
    const window: PersonalizedForecastWindow = {
      ...windowAt(peakRow, score),
      start: new Date(startIso),
      end: new Date(endIso),
      peakTime: new Date(peakIso),
    };
    return computeSurfCall(window, rows, beachOf(slug), { isTomorrow: true }).whySentence;
  }

  // PB Point's selected window tomorrow: first light 06:33–07:36 PDT, peak 06:30, score 46.
  const pbFirstLight = (): string =>
    callFor('pb-point', '2026-10-27T13:33:00Z', '2026-10-27T14:36:00Z', '2026-10-27T13:30:00Z', 46);
  // Lower Trestles 11 AM–2:15 PM, ahead of the low.
  const trestlesMidday = (): string =>
    callFor('lower-trestles', '2026-10-27T18:00:00Z', '2026-10-27T21:15:00Z', '2026-10-27T18:30:00Z', 62);
  // PB Point 12:00–12:50, straight after the 11 AM high-water hour.
  const pbAfterHigh = (): string =>
    callFor('pb-point', '2026-10-27T19:00:00Z', '2026-10-27T19:50:00Z', '2026-10-27T19:00:00Z', 44);

  const PB_FIRST_LIGHT_FLAG_OFF = 'Small for this break but conditions look fun — 1.4 ft with clean winds.';

  it('flag off leaves the neighbouring tide out', () => {
    withFlag(false);
    expect(pbFirstLight()).toBe(PB_FIRST_LIGHT_FLAG_OFF);
    expect(trestlesMidday()).toBe('Size is there, but onshore wind hurts shape.');
    expect(pbAfterHigh()).toBe('Small for this break but conditions look fun — 1.5 ft with manageable wind.');
  });

  it('PB Point first light says to go early before the 9 AM high floods it', () => {
    withFlag(true);
    // "(better again 1–2 PM)" would take it past 120 characters, so the optional tail drops.
    expect(pbFirstLight()).toBe(`${PB_FIRST_LIGHT_FLAG_OFF.slice(0, -1)} — go early, the tide floods it from ~9 AM.`);
  });

  it('names when a low tide drains a midday window', () => {
    withFlag(true);
    expect(trestlesMidday()).toBe('Size is there, but onshore wind hurts shape — go early, it drains out from ~4 PM.');
  });

  it('a window straight after a high-water stretch opens once the tide drops', () => {
    withFlag(true);
    expect(pbAfterHigh())
      .toBe('Small for this break but conditions look fun — 1.5 ft with manageable wind — once the tide drops, from ~12 PM.');
  });

  it('names when it is better again when that fits', () => {
    withFlag(true);
    const rows = glassySingleSwellTourmaline();
    const row = rows.find((candidate) => candidate.forecast_at.slice(11, 13) === '15')!;
    const window = { ...windowAt(row, 45), end: new Date('2026-10-27T15:50:00Z') };
    const sentence = computeSurfCall(window, rows, beachOf('tourmaline'), { isTomorrow: true }).whySentence;
    expect(sentence).toMatch(/ — go early, the tide floods it from ~9 AM \(better again 12–2 PM\)\.$/);
    expect(sentence.length).toBeLessThanOrEqual(120);
  });

  it('every handoff sentence stays within 120 characters', () => {
    withFlag(true);
    for (const sentence of [pbFirstLight(), trestlesMidday(), pbAfterHigh()]) {
      expect(sentence.length).toBeLessThanOrEqual(120);
    }
  });
});
