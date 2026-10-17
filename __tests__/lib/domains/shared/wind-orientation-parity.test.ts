/**
 * @jest-environment node
 *
 * Every surface that judges wind against a beach must resolve missing
 * orientation data the same way: stored offshore, else facing + 180, else
 * unknown, with one default tolerance. These beaches mirror prod rows that
 * have no `wind_offshore_deg` (East Coast + Hawaii, see the 2026-10-16
 * offshore data review).
 */

import { createSpotProfile } from '@/lib/domains/spot-profile/spot-profile';
import { windQualityScorer } from '@/lib/domains/scoring';
import { resolveWindDirection } from '@/lib/alerts/degree-utils';
import { buildSurfWindowRecommendations } from '@/lib/recommendations/surf-window-recommendations';
import {
  buildBeachChartConfig,
  transformForecastsToChartData,
  WIND_COLORS,
} from '@/app/embed/surf-terminal/[slug]/data-transform';
import { getConditionBoardPick, type BoardForPick } from '@/lib/scoring/board-pick';
import { DEFAULT_WIND_OFFSHORE_TOL_DEG } from '@/lib/domains/shared/wind-orientation';
import { createSnapshot } from '../__fixtures__';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { ScorerInput } from '@/lib/domains/scoring';

jest.mock('@/lib/utils/timezone-utils.server', () => ({
  getTimezoneFromCoords: jest.fn(() => 'America/New_York'),
}));

const EAST = 90;
const WEST = 270;
const TOL = DEFAULT_WIND_OFFSHORE_TOL_DEG;

function beach(overrides: Partial<Beach>): Beach {
  return {
    id: 'beach-ac',
    name: 'Atlantic City',
    slug: 'atlantic-city',
    lat: 39.36,
    lon: -74.42,
    timezone: 'America/New_York',
    wind_offshore_deg: null,
    wind_offshore_tol_deg: null,
    aspect_deg: null,
    ...overrides,
  } as Beach;
}

/** East-facing, no stored offshore: offshore must resolve to west. */
const EAST_FACING = beach({ aspect_deg: EAST });
/** Neither offshore nor facing direction stored. */
const NO_DATA = beach({});

function scoreWind(b: Beach, directionDeg: number, speedMph = 10) {
  const input: ScorerInput = {
    profile: createSpotProfile(b),
    snapshot: createSnapshot({ wind: { speedMph, directionDeg } }),
    window: null,
    preferences: null,
  };
  return windQualityScorer.score(input);
}

const NOW = new Date('2026-10-16T12:00:00Z');

function forecastRow(windDeg: number): EnhancedForecastEntity {
  return {
    id: 'f-1',
    beach_id: 'beach-ac',
    forecast_at: '2026-10-16T14:00:00Z',
    forecast_date: '2026-10-16',
    forecast_time: '10:00',
    wave_height: '3',
    wave_period: '10s',
    wave_direction: 'E',
    swell_1_height: '3',
    swell_1_period: '10s',
    swell_1_direction: '90',
    wind_speed: '12',
    wind_direction: 'X',
    wind_direction_deg: windDeg,
    tide_status: 'Rising',
    tide_height: '2',
    confidence_score: 85,
    data_source: 'NOAA_NWS',
    created_at: '2026-10-16T00:00:00Z',
    updated_at: '2026-10-16T00:00:00Z',
  } as EnhancedForecastEntity;
}

function recWindQuality(b: Beach, windDeg: number) {
  const result = buildSurfWindowRecommendations(
    { beach: b, forecasts: [forecastRow(windDeg)] },
    { now: NOW },
  );
  return result.recommendations[0]?.wind.quality;
}

function embedClass(b: Beach, windDeg: number) {
  const realNow = Date.now;
  Date.now = () => NOW.getTime();
  try {
    const data = transformForecastsToChartData([forecastRow(windDeg)], buildBeachChartConfig(b), 24);
    const color = data.windSpeed[0]?.color;
    return (Object.keys(WIND_COLORS) as (keyof typeof WIND_COLORS)[]).find(
      (k) => WIND_COLORS[k] === color,
    );
  } finally {
    Date.now = realNow;
  }
}

const BOARDS: BoardForPick[] = [
  { id: 'ml', name: 'Mid', board_type: 'mid-length', volume: 48 },
  { id: 'fs', name: 'Fish', board_type: 'fish', volume: 33 },
];

function boardPick(b: Beach | undefined, windDeg: number) {
  return getConditionBoardPick(
    {
      forecastTime: NOW,
      waveHeight: 2.5,
      wavePeriod: 10,
      windSpeed: 12,
      windDirection: windDeg,
      tideHeight: 2,
      tideStatus: 'rising',
    },
    BOARDS,
    b,
  )?.boardType;
}

describe('east-facing beach with no stored offshore', () => {
  it('scoring treats an east wind as onshore and a west wind as offshore', () => {
    expect(createSpotProfile(EAST_FACING).windThresholds.offshoreDeg).toBe(WEST);
    expect(scoreWind(EAST_FACING, EAST).reasons.join(' ')).not.toMatch(/offshore/i);
    expect(scoreWind(EAST_FACING, EAST).warnings).toContain('Onshore wind');
    expect(scoreWind(EAST_FACING, WEST).reasons).toContain('Clean offshore wind');
  });

  it('alerts classify by the derived offshore direction', () => {
    expect(resolveWindDirection(EAST, null, null, EAST)).toBe('onshore');
    expect(resolveWindDirection(WEST, null, null, EAST)).toBe('offshore');
  });

  it('recommendations classify by the derived offshore direction', () => {
    expect(recWindQuality(EAST_FACING, EAST)).toBe('onshore');
    expect(recWindQuality(EAST_FACING, WEST)).toBe('offshore');
  });

  it('the embed classifies by the derived offshore direction', () => {
    expect(embedClass(EAST_FACING, EAST)).toBe('onshore');
    expect(embedClass(EAST_FACING, WEST)).toBe('offshore');
  });

  it('board pick reads an east wind as chop', () => {
    expect(boardPick(EAST_FACING, EAST)).toBe('fish'); // small-chop
    expect(boardPick(EAST_FACING, WEST)).toBe('mid-length'); // small-clean
  });
});

describe('beach with no orientation data', () => {
  it('scoring is neutral, never offshore', () => {
    expect(createSpotProfile(NO_DATA).windThresholds.offshoreDeg).toBeNull();
    for (const dir of [0, EAST, 180, WEST]) {
      const result = scoreWind(NO_DATA, dir);
      expect(result.score).toBe(50);
      expect(result.reasons.join(' ')).not.toMatch(/offshore/i);
      expect(result.warnings).toContain('Beach wind orientation unknown');
    }
  });

  it('alerts cannot match any wind direction', () => {
    expect(resolveWindDirection(EAST, null, null, null)).toBeNull();
  });

  it('recommendations report the relation as unknown', () => {
    expect(recWindQuality(NO_DATA, EAST)).toBe('unknown');
  });

  it('the embed colours the wind as neutral cross-shore, not offshore', () => {
    expect(embedClass(NO_DATA, EAST)).toBe('cross-shore');
  });

  it('board pick does not read an east wind as offshore or onshore', () => {
    expect(boardPick(NO_DATA, EAST)).toBe('mid-length');
    expect(boardPick(NO_DATA, WEST)).toBe('mid-length');
  });
});

describe('wraparound', () => {
  // North-facing beach: offshore resolves to 180; facing 350 → offshore 170.
  const FACING_350 = beach({ aspect_deg: 350 });

  it('derives offshore across 360 on every surface', () => {
    expect(createSpotProfile(FACING_350).windThresholds.offshoreDeg).toBe(170);
    expect(resolveWindDirection(170, null, null, 350)).toBe('offshore');
    expect(resolveWindDirection(355, null, null, 350)).toBe('onshore');
    expect(recWindQuality(FACING_350, 170)).toBe('offshore');
    expect(embedClass(FACING_350, 170)).toBe('offshore');
    expect(embedClass(FACING_350, 350)).toBe('onshore');
  });

  it('a stored offshore near north matches winds on both sides of 0', () => {
    const NORTH = beach({ wind_offshore_deg: 10, aspect_deg: 190 });
    expect(resolveWindDirection(350, 10, null, 190)).toBe('offshore');
    expect(recWindQuality(NORTH, 350)).toBe('offshore');
    expect(embedClass(NORTH, 350)).toBe('offshore');
    expect(scoreWind(NORTH, 350).reasons).toContain('Clean offshore wind');
  });
});

describe('tolerance parity', () => {
  // West-facing beach, no stored tolerance: every surface uses the same cone.
  const WEST_FACING = beach({ aspect_deg: WEST });
  const inside = EAST + TOL - 1;
  const outside = EAST + TOL + 1;

  it('uses one default tolerance in scoring', () => {
    expect(createSpotProfile(WEST_FACING).windThresholds.offshoreToleranceDeg).toBe(TOL);
    expect(scoreWind(WEST_FACING, inside).reasons).toContain('Clean offshore wind');
    expect(scoreWind(WEST_FACING, outside).reasons).not.toContain('Clean offshore wind');
  });

  it('uses one default tolerance in alerts', () => {
    expect(resolveWindDirection(inside, null, null, WEST)).toBe('offshore');
    expect(resolveWindDirection(outside, null, null, WEST)).not.toBe('offshore');
  });

  it('uses one default tolerance in recommendations', () => {
    expect(recWindQuality(WEST_FACING, inside)).toBe('offshore');
    expect(recWindQuality(WEST_FACING, outside)).not.toBe('offshore');
  });

  it('uses one default tolerance in the embed', () => {
    expect(embedClass(WEST_FACING, inside)).toBe('offshore');
    expect(embedClass(WEST_FACING, outside)).not.toBe('offshore');
  });
});
