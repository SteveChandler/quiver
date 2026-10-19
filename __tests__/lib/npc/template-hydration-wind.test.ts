/**
 * @jest-environment node
 *
 * Missing wind is unknown, not calm: the NPC wind phrase must not say "glassy"
 * for a forecast row that has no wind reading, and a real 0 mph still does.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  buildTemplateVariables,
  fetchSurfConditions,
} from '@/lib/npc/template-hydration';

type Conditions = Parameters<typeof buildTemplateVariables>[1];

const conditions = (overrides: Partial<Conditions>): Conditions => ({
  waveHeight: 3,
  wavePeriod: 12,
  windSpeed: null,
  windDirection: null,
  tideHeight: 3,
  tideStatus: 'rising',
  waterTemp: 62,
  ...overrides,
});

const windPhrase = (overrides: Partial<Conditions>): string =>
  buildTemplateVariables('Ocean Beach', conditions(overrides), 'local', new Date('2026-10-16T15:00:00Z'))
    .wind_description;

function supabaseReturning(row: Record<string, unknown> | undefined): SupabaseClient<Database> {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gte', 'lt', 'order']) {
    chain[method] = jest.fn(() => chain);
  }
  chain.limit = jest.fn(async () => ({ data: row ? [row] : [] }));
  return { from: jest.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

describe('describeWind via buildTemplateVariables', () => {
  it('does not call a missing wind speed glassy', () => {
    const phrase = windPhrase({ windSpeed: null, windDirection: 'NW' });
    expect(phrase).not.toMatch(/glassy|calm|light|offshore|onshore|clean/i);
    expect(phrase).not.toMatch(/kts|mph/);
  });

  it('keeps a real calm glassy', () => {
    expect(windPhrase({ windSpeed: 0, windDirection: null })).toBe('glassy conditions');
    expect(windPhrase({ windSpeed: 2, windDirection: 'W' })).toBe('glassy conditions');
  });

  it('reads speed and direction when both exist', () => {
    expect(windPhrase({ windSpeed: 9, windDirection: 'nw' })).toBe('moderate NW winds around 9kts');
  });

  it('reads speed alone, without a stray space, when the direction is missing', () => {
    expect(windPhrase({ windSpeed: 9, windDirection: null })).toBe('moderate winds around 9kts');
  });
});

describe('fetchSurfConditions wind speed', () => {
  const rowWith = (wind_speed: unknown) => ({
    wave_height: '3', wave_period: '12', wind_speed, wind_direction: 'W',
    tide_height: '2', tide_status: 'rising', water_temp: '62°F',
  });

  it('returns null for a missing wind speed', async () => {
    const result = await fetchSurfConditions(supabaseReturning(rowWith(null)), 'beach-1');
    expect(result.windSpeed).toBeNull();
  });

  it('keeps a real 0 mph as 0, not unknown', async () => {
    const result = await fetchSurfConditions(supabaseReturning(rowWith('0 mph')), 'beach-1');
    expect(result.windSpeed).toBe(0);
  });

  it('parses a speed with units', async () => {
    const result = await fetchSurfConditions(supabaseReturning(rowWith('12 mph')), 'beach-1');
    expect(result.windSpeed).toBe(12);
  });
});
