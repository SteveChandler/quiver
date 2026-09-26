/**
 * @jest-environment node
 */

import {
  buildWeekScoutSwells,
  type BuildWeekScoutSwellsInput,
} from '@/lib/services/discovery/week-scout-swells';
import { SWELL_EVENT_DETECTOR_VERSION, type SwellEventSnapshot } from '@/lib/alerts/swell-events';
import type { MajorEventHoldWeekScoutDay } from '@/lib/recommendations/major-event-hold/adapters/week-scout';
import { createMockBeach } from '@/__tests__/setup/typed-mocks';
import {
  FLAT,
  NOW,
  TIMEZONE,
  dayRows,
  localDate,
  localIso,
  type PartitionSpec,
} from '@/__tests__/helpers/swell-events';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

type Window = MajorEventHoldWeekScoutDay['windows'][number];

const IDS = {
  blacks: 'aaaaaaaa-0000-4000-8000-000000000001',
  scripps: 'aaaaaaaa-0000-4000-8000-000000000002',
  shores: 'aaaaaaaa-0000-4000-8000-000000000003',
  oceanside: 'aaaaaaaa-0000-4000-8000-000000000004',
  cove: 'aaaaaaaa-0000-4000-8000-000000000005',
};

function beach(id: string, name: string, window: { center: number; half: number } | null): Beach {
  return createMockBeach({
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    timezone: TIMEZONE,
    swell_window_center_deg: window?.center ?? null,
    swell_window_halfwidth_deg: window?.half ?? null,
  });
}

function forecastRows(beachId: string, specs: Array<PartitionSpec | null>, peakDay: number): EnhancedForecastEntity[] {
  return specs.flatMap((spec, day) => dayRows(day, spec, { noonBumpFt: day === peakDay ? 0.2 : 0 }))
    .map((row, index) => ({
      ...row,
      id: `${beachId}:${index}`,
      beach_id: beachId,
      wind_speed: '10 mph',
      wind_direction: 'NE',
      wind_direction_deg: 45,
      wind_source: 'NWS',
    } as EnhancedForecastEntity));
}

const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };
const SMALLER_PEAK: PartitionSpec = { heightFt: 3.5, periodS: 16, direction: 270 };
const WEEK = (peak: PartitionSpec): Array<PartitionSpec | null> => [FLAT, FLAT, FLAT, peak, FLAT, FLAT, FLAT];

function window(id: string, beachId: string, day: number, overrides: Partial<Window> = {}): Window {
  return {
    id,
    bucket: 'midday',
    start: localIso(day, 11),
    end: localIso(day, 14),
    displayWindowStart: localIso(day, 11),
    displayWindowEnd: localIso(day, 13),
    peakTime: localIso(day, 12),
    beachId,
    isBeachDayBest: true,
    conditionScore: 60,
    rankingScore: 60,
    verdict: 'maybe',
    rideable: true,
    safe: true,
    confidence: 80,
    forecast: {
      waveHeight: '3 ft', period: '16s', swellDirection: 'W', windSpeed: '5 mph', windDirection: 'E',
      tideHeightFt: 2, tidePhase: 'Rising', freshnessAt: NOW.toISOString(),
    },
    takeaway: null,
    rankedSpots: [],
    ...overrides,
  };
}

function days(windows: Window[]): BuildWeekScoutSwellsInput['days'] {
  return Array.from({ length: 7 }, (_, day) => ({
    localDate: localDate(day),
    windows: windows.filter((item) => item.start.slice(0, 10) === localDate(day)
      || localDate(day) === new Date(Date.parse(item.start) - 7 * 3_600_000).toISOString().slice(0, 10)),
  }));
}

function scenario(overrides: Partial<BuildWeekScoutSwellsInput> = {}): BuildWeekScoutSwellsInput {
  const beaches = [
    beach(IDS.blacks, 'Blacks', { center: 270, half: 30 }),
    beach(IDS.scripps, 'Scripps', { center: 280, half: 30 }),
    // 45° off its window center: inside the taper, so it sees a sliver of the swell.
    beach(IDS.shores, 'La Jolla Shores', { center: 225, half: 30 }),
    beach(IDS.oceanside, 'Oceanside', null),
    beach(IDS.cove, 'Hidden Cove', { center: 90, half: 20 }),
  ];
  return {
    days: days([
      window('blacks-mon', IDS.blacks, 3, { verdict: 'worth_it', conditionScore: 82 }),
      // Not the beach's day-best window: never named, even with a better verdict.
      window('blacks-mon-alt', IDS.blacks, 3, { verdict: 'worth_it', conditionScore: 95, isBeachDayBest: false }),
      // After the swell fades (Tue 00:00): outside its span, whatever the verdict.
      window('blacks-tue', IDS.blacks, 4, { verdict: 'worth_it', conditionScore: 99 }),
      window('blacks-thu', IDS.blacks, 6, { verdict: 'worth_it', conditionScore: 99 }),
      window('scripps-mon', IDS.scripps, 3, { verdict: 'maybe', conditionScore: 65 }),
      window('shores-mon', IDS.shores, 3, { verdict: 'skip', conditionScore: 30 }),
      window('oceanside-mon', IDS.oceanside, 3, { verdict: 'worth_it', conditionScore: 75 }),
      window('cove-mon', IDS.cove, 3, { verdict: 'maybe', conditionScore: 50 }),
    ]),
    beaches,
    forecastsByBeach: new Map([
      [IDS.blacks, forecastRows(IDS.blacks, WEEK(PEAK), 3)],
      [IDS.scripps, forecastRows(IDS.scripps, WEEK(SMALLER_PEAK), 3)],
      [IDS.shores, forecastRows(IDS.shores, WEEK(PEAK), 3)],
      [IDS.oceanside, forecastRows(IDS.oceanside, WEEK({ heightFt: 2.5, periodS: 16, direction: 270 }), 3)],
      [IDS.cove, forecastRows(IDS.cove, WEEK(PEAK), 3)],
    ]),
    snapshots: [],
    userSkillLevel: 'intermediate',
    boardClasses: [],
    now: NOW,
    timezone: TIMEZONE,
    ...overrides,
  };
}

function snapshot(overrides: Partial<SwellEventSnapshot> = {}): SwellEventSnapshot {
  return {
    beachId: IDS.blacks,
    eventKey: `${IDS.blacks}:W:${localDate(3)}`,
    detectorVersion: SWELL_EVENT_DETECTOR_VERSION,
    runDate: '2026-09-24',
    detectedAt: '2026-09-24T14:30:00.000Z',
    directionDeg: 270,
    directionBand: 'W',
    periodS: 16,
    peakOffshoreHeightFt: 4,
    peakFaceHeightFt: 5.4,
    exposure: 1,
    energyRatio: 25,
    arrivalAt: localIso(3, 0),
    peakAt: localIso(3, 12),
    fadeAt: localIso(4, 0),
    crossingDirectionDeg: null,
    crossingPeriodS: null,
    crossingOffshoreHeightFt: null,
    ...overrides,
  };
}

describe('buildWeekScoutSwells', () => {
  it('groups one swell across beaches and joins each beach to its own day-best window', () => {
    const [swell, ...rest] = buildWeekScoutSwells(scenario());

    expect(rest).toEqual([]);
    expect(swell).toMatchObject({
      eventKey: `${IDS.blacks}:W:${localDate(3)}`,
      directionLabel: 'W',
      periodS: 16,
      peakOffshoreHeightFt: 4.2,
      arrivalAt: localIso(3, 0),
      peakAt: localIso(3, 12),
      fadeAt: localIso(4, 0),
      peakLocalDate: localDate(3),
      timezone: TIMEZONE,
    });
    expect(swell.directionDeg).toBe(270);
    expect(swell.beaches.map((item) => [item.beachName, item.bestWindow?.windowId ?? null])).toEqual([
      ['Blacks', 'blacks-mon'],
      ['Oceanside', 'oceanside-mon'],
      ['Scripps', 'scripps-mon'],
      ['La Jolla Shores', 'shores-mon'],
    ]);
    expect(swell.beaches[0]).toMatchObject({
      exposure: 1,
      exposureLabel: 'open',
      swellWindow: { centerDeg: 270, halfWidthDeg: 30 },
      sizeFit: 'in_range',
      bestWindow: {
        windowId: 'blacks-mon',
        localDate: localDate(3),
        displayWindowStart: localIso(3, 11),
        displayWindowEnd: localIso(3, 13),
        verdict: 'worth_it',
        conditionScore: 82,
      },
    });
    expect(swell.beaches[0].peakFaceHeightFt).toBeGreaterThan(swell.beaches[2].peakFaceHeightFt ?? 0);
  });

  it('lists a windowless worth-it beach as open, with face height from its own row nearest the peak', () => {
    const [swell] = buildWeekScoutSwells(scenario());
    const oceanside = swell.beaches.find((item) => item.beachId === IDS.oceanside);
    expect(oceanside).toMatchObject({ swellWindow: null, exposure: 1, exposureLabel: 'open' });
    expect(oceanside?.peakFaceHeightFt).toBeGreaterThan(2.5);
    expect(swell.beaches.some((item) => item.beachId === IDS.cove)).toBe(false);
  });

  it('names blocked beaches honestly in the narrative', () => {
    const [swell] = buildWeekScoutSwells(scenario());
    const shores = swell.beaches.find((item) => item.beachId === IDS.shores);
    expect(shores?.exposureLabel).toBe('shadowed');
    expect(swell.narrative).toBe(
      'W swell, 4.2 ft at 16 s, builds early Monday morning and peaks Monday afternoon. '
      + 'Blacks and Scripps face it most directly; '
      + 'La Jolla Shores is mostly blocked from this direction, so expect little of it there.',
    );
    expect(swell.narrative).not.toMatch(/Oceanside/);
  });

  it('adds a size line naming the best in-range beach when the top beach is above range', () => {
    const input = scenario({ userSkillLevel: 'beginner' });
    // Blacks' window reads 5-6 ft, over a beginner's 4 ft ceiling; the others read 3 ft.
    const [swell] = buildWeekScoutSwells({
      ...input,
      days: input.days.map((day) => ({
        ...day,
        windows: day.windows.map((item) => (item.id === 'blacks-mon'
          ? { ...item, forecast: { ...item.forecast, waveHeight: '5-6 ft' } }
          : item)),
      })),
    });
    expect(swell.beaches[0]).toMatchObject({ beachName: 'Blacks', sizeFit: 'above_range' });
    expect(swell.narrative).toMatch(/It may run above your usual range at Blacks; Oceanside is the better size for you\.$/);
  });

  it('reuses an earlier run key for the group', () => {
    const reused = snapshot({ eventKey: `${IDS.blacks}:W:${localDate(2)}`, peakAt: localIso(2, 23) });
    const [swell] = buildWeekScoutSwells(scenario({ snapshots: [reused] }));
    expect(swell.eventKey).toBe(`${IDS.blacks}:W:${localDate(2)}`);
  });

  it('omits swells when no listed beach has a verdict, and returns [] without swells', () => {
    expect(buildWeekScoutSwells(scenario({ days: days([]) }))).toEqual([]);
    const flat = new Map([[IDS.blacks, forecastRows(IDS.blacks, WEEK(FLAT), 3)]]);
    expect(buildWeekScoutSwells(scenario({ forecastsByBeach: flat }))).toEqual([]);
  });

  it('keeps separate swells apart and orders them by peak', () => {
    const south = beach('aaaaaaaa-0000-4000-8000-000000000006', 'Imperial', { center: 190, half: 30 });
    const input = scenario();
    const swells = buildWeekScoutSwells({
      ...input,
      beaches: [...input.beaches, south],
      forecastsByBeach: new Map([
        ...input.forecastsByBeach,
        [south.id, forecastRows(south.id, [FLAT, FLAT, { heightFt: 4, periodS: 17, direction: 190 }, FLAT, FLAT, FLAT, FLAT]
          .map((spec) => (spec === FLAT ? { ...FLAT, direction: 190 } : spec)), 2)],
      ]),
      days: days([
        ...input.days.flatMap((day) => day.windows),
        window('imperial-sun', south.id, 2, { verdict: 'maybe', conditionScore: 55 }),
      ]),
    });
    expect(swells.map((item) => [item.directionLabel, item.peakLocalDate])).toEqual([
      ['S', localDate(2)],
      ['W', localDate(3)],
    ]);
  });

  it('caps the beach list at 8', () => {
    const many = Array.from({ length: 10 }, (_, index) => beach(
      `bbbbbbbb-0000-4000-8000-0000000000${String(index + 10)}`, `Beach ${index}`, { center: 270, half: 30 },
    ));
    const [swell] = buildWeekScoutSwells(scenario({
      beaches: many,
      forecastsByBeach: new Map(many.map((item) => [item.id, forecastRows(item.id, WEEK(PEAK), 3)])),
      days: days(many.map((item, index) => window(`w-${index}`, item.id, 3, { conditionScore: 50 + index }))),
    }));
    expect(swell.beaches).toHaveLength(8);
    expect(swell.beaches[0].bestWindow?.conditionScore).toBe(59);
  });
});

describe('Week Scout swell confidence', () => {
  const SOON = new Date('2026-09-27T12:00:00.000Z');

  it('is on the radar far out, likely once stable', () => {
    expect(buildWeekScoutSwells(scenario())[0].confidence).toBe('on_the_radar');
    expect(buildWeekScoutSwells(scenario({ snapshots: [snapshot()] }))[0].confidence).toBe('likely');
  });

  it('is likely inside 36 h, locked once stable', () => {
    expect(buildWeekScoutSwells(scenario({ now: SOON }))[0].confidence).toBe('likely');
    expect(buildWeekScoutSwells(scenario({ now: SOON, snapshots: [snapshot()] }))[0].confidence).toBe('locked');
  });

  it('is not stable on a snapshot under 18 h old, a moved peak, or a 30%+ size change', () => {
    const tooRecent = snapshot({ detectedAt: '2026-09-27T00:00:00.000Z' });
    const moved = snapshot({ peakAt: localIso(2, 21) });
    const resized = snapshot({ peakOffshoreHeightFt: 3 });
    for (const stale of [tooRecent, moved, resized]) {
      expect(buildWeekScoutSwells(scenario({ now: SOON, snapshots: [stale] }))[0].confidence).toBe('likely');
    }
  });
});

describe('Week Scout swell change', () => {
  const changeWith = (snapshots: SwellEventSnapshot[]) => buildWeekScoutSwells(scenario({ snapshots }))[0].change;

  it('is null with no earlier run, and "new" when an earlier run missed it', () => {
    expect(changeWith([])).toBeNull();
    expect(changeWith([snapshot({ detectedAt: '2026-09-25T10:00:00.000Z' })])).toBeNull();
    expect(changeWith([snapshot({ beachId: IDS.cove, eventKey: `${IDS.cove}:S:2026-09-24` })])).toEqual({
      kind: 'new',
      comparedToIssuedAt: '2026-09-24T14:30:00.000Z',
      previousPeakOffshoreHeightFt: null,
      previousPeakAt: null,
      summary: "Not in yesterday's forecast",
    });
  });

  it('reports upgrades and downgrades of 15% or more', () => {
    expect(changeWith([snapshot({ peakOffshoreHeightFt: 3.6 })])).toMatchObject({
      kind: 'upgraded',
      previousPeakOffshoreHeightFt: 3.6,
      summary: 'Up from 3.6 ft since yesterday',
    });
    expect(changeWith([snapshot({ peakOffshoreHeightFt: 5 })])).toMatchObject({
      kind: 'downgraded',
      summary: 'Down from 5 ft since yesterday',
    });
  });

  it('reports a peak that moved 6 h or more, else steady', () => {
    expect(changeWith([snapshot({ peakAt: localIso(3, 3) })])).toMatchObject({
      kind: 'later',
      previousPeakAt: localIso(3, 3),
      summary: 'Peak moved to Monday afternoon',
    });
    expect(changeWith([snapshot({ peakAt: localIso(3, 21) })])).toMatchObject({ kind: 'earlier' });
    expect(changeWith([snapshot({ peakAt: localIso(3, 9) })])).toMatchObject({
      kind: 'steady',
      summary: 'Holding steady since yesterday',
    });
  });

  it('compares with the newest earlier run and names older runs by weekday', () => {
    const older = snapshot({ detectedAt: '2026-09-22T14:30:00.000Z', peakOffshoreHeightFt: 2 });
    expect(changeWith([older])).toMatchObject({ kind: 'upgraded', summary: 'Up from 2 ft since Tuesday' });
    expect(changeWith([older, snapshot()])).toMatchObject({ kind: 'steady' });
  });
});

describe('Week Scout swell crossing, wind and rarity', () => {
  const SSE: PartitionSpec = { heightFt: 4, periodS: 16, direction: 165 };
  const EAST: PartitionSpec = { heightFt: 5, periodS: 8, direction: 80 };
  const pointId = 'cccccccc-0000-4000-8000-000000000001';

  function crossingScenario(overrides: Partial<BuildWeekScoutSwellsInput> = {}): BuildWeekScoutSwellsInput {
    // Window 90°–210°: the SSE groundswell is near center; the E wind swell is in the taper.
    const point = beach(pointId, 'South Point', { center: 150, half: 60 });
    const rows = [FLAT, FLAT, FLAT, SSE, FLAT, FLAT, FLAT].flatMap((spec, day) => dayRows(
      day,
      spec === FLAT ? { ...FLAT, direction: 165 } : spec,
      { noonBumpFt: day === 3 ? 0.2 : 0, secondary: day === 3 ? EAST : null },
    )).map((row, index) => ({
      ...row, id: `${pointId}:${index}`, beach_id: pointId,
      wind_speed: '10 mph', wind_direction: 'NE', wind_direction_deg: 45, wind_source: 'NWS',
    } as EnhancedForecastEntity));
    return scenario({
      beaches: [point],
      forecastsByBeach: new Map([[pointId, rows]]),
      days: days([window('point-mon', pointId, 3, { verdict: 'worth_it', conditionScore: 80 })]),
      ...overrides,
    });
  }

  it('reports a crossed swell on the group and says so in one factual sentence', () => {
    const [swell] = buildWeekScoutSwells(crossingScenario());
    expect(swell.directionLabel).toBe('SSE');
    expect(swell.crossing).toEqual({
      directionDeg: 80,
      directionLabel: 'E',
      periodS: 8,
      peakOffshoreHeightFt: 5,
      angleDeg: 85,
      overlapStartAt: localIso(3, 0),
      overlapEndAt: localIso(3, 21),
      rarity: null,
    });
    expect(swell.narrative).toContain('Two swells about 90° apart: a long-period SSE and a short-period E.');
  });

  it('adds rarity only once snapshots span 14 run dates, counting other crossing days at the lead beach', () => {
    const currentKey = `${pointId}:S:${localDate(3)}`;
    const rarity = (crossingHistory: BuildWeekScoutSwellsInput['crossingHistory']) => (
      buildWeekScoutSwells(crossingScenario({ crossingHistory }))[0].crossing?.rarity
    );
    const crossing = (beachId: string, eventKey: string, peakDate: string) => ({ beachId, eventKey, peakDate });
    expect(buildWeekScoutSwells(crossingScenario())[0].eventKey).toBe(currentKey);
    expect(rarity(null)).toBeNull();
    expect(rarity({ historyDays: 13, crossings: [crossing(pointId, `${pointId}:E:2026-09-10`, '2026-09-10')] })).toBeNull();
    // The event on screen and other beaches' crossings do not count.
    expect(rarity({
      historyDays: 14,
      crossings: [crossing(pointId, currentKey, localDate(3)), crossing(IDS.blacks, `${IDS.blacks}:W:2026-09-12`, '2026-09-12')],
    })).toEqual({ crossingDaysInLast30: 0, line: 'First crossed swell here in 30 days' });
    // Two events on one day count once.
    expect(rarity({
      historyDays: 30,
      crossings: [
        crossing(pointId, `${pointId}:S:2026-09-02`, '2026-09-02'),
        crossing(pointId, `${pointId}:W:2026-09-02`, '2026-09-02'),
        crossing(pointId, `${pointId}:S:2026-09-10`, '2026-09-10'),
        crossing(pointId, `${pointId}:SE:2026-09-18`, '2026-09-18'),
      ],
    })).toEqual({ crossingDaysInLast30: 3, line: 'Crossed swells showed up on 3 of the last 30 days' });
  });

  it('has no crossing for a single swell', () => {
    const [swell] = buildWeekScoutSwells(scenario());
    expect(swell.crossing).toBeNull();
    expect(swell.narrative).not.toMatch(/Two swells/);
  });

  it('reports wind at the lead beach row nearest the peak', () => {
    expect(buildWeekScoutSwells(scenario())[0].windAtPeak).toEqual({ directionDeg: 45, speedKt: 8.7 });
    const noWind = scenario();
    const defaulted = new Map([...noWind.forecastsByBeach].map(([id, rows]) => [
      id, rows.map((row) => ({ ...row, wind_source: null })),
    ]));
    expect(buildWeekScoutSwells({ ...noWind, forecastsByBeach: defaulted })[0].windAtPeak).toBeNull();
  });

  it('keeps a crossing only on the stronger of two crossing swells', () => {
    const id = 'cccccccc-0000-4000-8000-000000000002';
    const wide = beach(id, 'Wide Open', { center: 225, half: 90 });
    const west: PartitionSpec = { heightFt: 7, periodS: 16, direction: 270 };
    const south: PartitionSpec = { heightFt: 5, periodS: 14, direction: 190 };
    const rows = [
      ...dayRows(0, FLAT),
      ...dayRows(1, FLAT),
      ...dayRows(2, west, { noonBumpFt: 0.2, secondary: south }),
      ...dayRows(3, south, { secondary: { ...west, heightFt: 5 } }),
      ...dayRows(4, FLAT),
    ].map((row, index) => ({ ...row, id: `${id}:${index}`, beach_id: id } as EnhancedForecastEntity));

    const swells = buildWeekScoutSwells(scenario({
      beaches: [wide],
      forecastsByBeach: new Map([[id, rows]]),
      days: days([window('wide-sat', id, 2, { verdict: 'maybe', conditionScore: 60 })]),
    }));

    const byLabel = new Map(swells.map((item) => [item.directionLabel, item]));
    expect([...byLabel.keys()].sort()).toEqual(['S', 'W']);
    expect(byLabel.get('W')?.crossing).toMatchObject({ directionLabel: 'S', periodS: 14 });
    expect(byLabel.get('S')?.crossing).toBeNull();
    expect(byLabel.get('S')?.narrative).not.toMatch(/Two swells/);
  });
});

describe('Week Scout swells already arriving', () => {
  const BACKGROUND: PartitionSpec = { heightFt: 1.5, periodS: 16, direction: 270 };

  function arriving(history: Array<PartitionSpec | null>, week: Array<PartitionSpec | null>, peakDay: number) {
    const id = IDS.blacks;
    const toEntity = (row: ReturnType<typeof dayRows>[number], index: number) => ({
      ...row, id: `${id}:${index}`, beach_id: id,
    } as EnhancedForecastEntity);
    return scenario({
      beaches: [beach(id, 'Blacks', { center: 270, half: 30 })],
      forecastsByBeach: new Map([[id, week.flatMap((spec, day) => dayRows(day, spec, {
        noonBumpFt: day === peakDay ? 0.2 : 0,
      })).map(toEntity)]]),
      swellHistoryByBeach: new Map([[id, history.flatMap((spec, index) => dayRows(index - history.length, spec))]]),
      days: days([window('blacks-sat', id, 1, { verdict: 'worth_it', conditionScore: 80 })]),
    });
  }

  it('keeps a swell that arrived before now, measured against the 48 h before it', () => {
    const input = arriving([BACKGROUND, BACKGROUND], [PEAK, PEAK, BACKGROUND, BACKGROUND, BACKGROUND, BACKGROUND, BACKGROUND], 1);
    const [swell] = buildWeekScoutSwells(input);
    expect(swell).toMatchObject({ arrivalAt: localIso(0, 0), peakAt: localIso(1, 12), fadeAt: localIso(2, 0) });
    expect(swell.narrative).toMatch(/^W swell, 4\.2 ft at 16 s, is building now and peaks Saturday afternoon\./);

    // Without the past rows the swell has no lull to rise from and drops out.
    expect(buildWeekScoutSwells({ ...input, swellHistoryByBeach: undefined })).toEqual([]);
  });

  it('shows nothing for a flat week', () => {
    expect(buildWeekScoutSwells(arriving([BACKGROUND, BACKGROUND], Array(7).fill(BACKGROUND), 1))).toEqual([]);
  });

  it('drops a swell that has already faded', () => {
    // Peaked yesterday and faded at midnight, before the 08:00 request.
    const input = arriving([BACKGROUND, PEAK], [BACKGROUND, BACKGROUND, BACKGROUND, BACKGROUND, BACKGROUND, BACKGROUND, BACKGROUND], -1);
    expect(buildWeekScoutSwells(input)).toEqual([]);
  });
});

describe('Week Scout swell beach row height', () => {
  it('carries the window height the day strip shows and judges size by it', () => {
    const input = scenario({ userSkillLevel: 'beginner' });
    const withHeights = {
      ...input,
      days: input.days.map((day) => ({
        ...day,
        windows: day.windows.map((item) => ({
          ...item,
          forecast: { ...item.forecast, waveHeight: item.id === 'blacks-mon' ? '2-3 ft' : '5-6 ft' },
        })),
      })),
    };
    const [swell] = buildWeekScoutSwells(withHeights);
    const blacks = swell.beaches.find((item) => item.beachId === IDS.blacks);
    const scripps = swell.beaches.find((item) => item.beachId === IDS.scripps);
    // Blacks' swell face is above a beginner's range, but its window reads 2-3 ft: in range.
    expect(blacks).toMatchObject({ bestWindow: { windowId: 'blacks-mon', waveHeight: '2-3 ft' }, sizeFit: 'in_range' });
    expect(blacks?.peakFaceHeightFt).toBeGreaterThan(4);
    expect(scripps).toMatchObject({ bestWindow: { waveHeight: '5-6 ft' }, sizeFit: 'above_range' });
  });

  it('falls back to the swell face height only without a window', () => {
    const input = scenario({ userSkillLevel: 'beginner' });
    // Scripps keeps a window later in the week (still recommendable) but none during the swell.
    const noScrippsWindow = {
      ...input,
      days: input.days.map((day, index) => ({
        ...day,
        windows: [
          ...day.windows.filter((item) => item.beachId !== IDS.scripps),
          ...(index === 6 ? [window('scripps-thu', IDS.scripps, 6, { verdict: 'maybe' })] : []),
        ],
      })),
    };
    const [swell] = buildWeekScoutSwells(noScrippsWindow);
    const scripps = swell.beaches.find((item) => item.beachId === IDS.scripps);
    expect(scripps).toMatchObject({ bestWindow: null, sizeFit: 'in_range' });
    expect(scripps?.peakFaceHeightFt).toBeLessThanOrEqual(4);
  });
});

describe('Week Scout swells review fixes', () => {
  const HELD = 'eeeeeeee-0000-4000-8000-000000000001';

  function withHeldBeach(heldWindows: Window[]) {
    const input = scenario({ userSkillLevel: 'beginner' });
    const held = beach(HELD, 'Held Beach', { center: 280, half: 30 });
    return {
      ...input,
      beaches: [...input.beaches, held],
      forecastsByBeach: new Map([...input.forecastsByBeach, [HELD, forecastRows(HELD, WEEK(SMALLER_PEAK), 3)]]),
      days: days([
        // Blacks reads above a beginner's range; the only other in-range rows are not recommendable.
        window('blacks-mon', IDS.blacks, 3, { verdict: 'worth_it', conditionScore: 82, forecast: {
          ...window('x', IDS.blacks, 3).forecast, waveHeight: '5-6 ft',
        } }),
        window('shores-mon', IDS.shores, 3, { verdict: 'skip', conditionScore: 30 }),
        ...heldWindows,
      ]),
    };
  }

  it.each([
    ['removed for water quality', []],
    ['held by a major event (verdict null)', [window('held-mon', HELD, 3, {
      verdict: null, conditionScore: null, rankingScore: null, rideable: null, safe: null,
    })]],
  ])('never lists, leads with, or suggests a beach %s', (_label, heldWindows) => {
    const swells = buildWeekScoutSwells(withHeldBeach(heldWindows as Window[]));
    expect(swells.length).toBeGreaterThan(0);
    for (const swell of swells) {
      expect(swell.beaches.map((row) => row.beachId)).not.toContain(HELD);
      expect(swell.eventKey.startsWith(HELD)).toBe(false);
      expect(swell.narrative).not.toContain('Held Beach');
    }
    // Shores reads in range but its window is a skip, so nothing is offered as the better size.
    expect(swells[0].narrative).toMatch(/It may run above your usual range at these spots\.$/);
  });

  it('groups one swell whose 16-point label flips across a band edge (S and SW)', () => {
    const a = beach('ffffffff-0000-4000-8000-000000000001', 'South A', { center: 200, half: 30 });
    const b = beach('ffffffff-0000-4000-8000-000000000002', 'South B', { center: 200, half: 30 });
    const swells = buildWeekScoutSwells(scenario({
      beaches: [a, b],
      forecastsByBeach: new Map([
        [a.id, forecastRows(a.id, WEEK({ ...PEAK, direction: 190 }).map((spec) => spec && { ...spec, direction: 190 }), 3)],
        [b.id, forecastRows(b.id, WEEK({ ...SMALLER_PEAK, direction: 205 }).map((spec) => spec && { ...spec, direction: 205 }), 3)],
      ]),
      days: days([
        window('a-mon', a.id, 3, { verdict: 'maybe' }),
        window('b-mon', b.id, 3, { verdict: 'maybe' }),
      ]),
    }));
    expect(swells).toHaveLength(1);
    expect(swells[0].beaches.map((row) => row.beachId).sort()).toEqual([a.id, b.id].sort());
  });

  it('says a swell past its peak is easing', () => {
    const [swell] = buildWeekScoutSwells(scenario({ now: new Date(localIso(3, 15)) }));
    expect(swell.narrative).toMatch(/^W swell, 4\.2 ft at 16 s, peaked Monday afternoon and is easing\./);
  });

  it('names only windows that overlap the swell in time, not its whole local dates', () => {
    // Blacks' Tuesday window scores higher but opens after the swell fades at Tuesday 00:00.
    const [swell] = buildWeekScoutSwells(scenario());
    expect(swell.fadeAt).toBe(localIso(4, 0));
    expect(swell.beaches.find((row) => row.beachId === IDS.blacks)?.bestWindow?.windowId).toBe('blacks-mon');
  });
});
