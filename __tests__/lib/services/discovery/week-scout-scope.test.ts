/** @jest-environment node */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getWeekScoutLocation, resolveWeekScoutScopeAnchor } from '@/lib/services/discovery/week-scout-scope';

const now = Date.parse('2026-10-11T13:00:00Z');
const snapshot = { lat: 33.15, lon: -117.35, captured_at: '2026-10-11T12:45:01Z' };
const home = { lat: 32.89, lon: -117.25 };

function client(data: unknown = home, error: { message: string } | null = null): SupabaseClient<Database> {
  return { from: jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({
    maybeSingle: jest.fn(async () => ({ data, error })),
  })) })) })) } as unknown as SupabaseClient<Database>;
}

describe('Week Scout scope shared by Home and the parity tool', () => {
  it('trusts only a snapshot strictly under 15 minutes old', () => {
    expect(getWeekScoutLocation(snapshot, now)).toEqual({ lat: snapshot.lat, lon: snapshot.lon });
    expect(getWeekScoutLocation({ ...snapshot, captured_at: '2026-10-11T12:45:00Z' }, now)).toBeUndefined();
    expect(getWeekScoutLocation({ ...snapshot, captured_at: '2026-10-11T12:00:00Z' }, now)).toBeUndefined();
    expect(getWeekScoutLocation({ ...snapshot, captured_at: '2026-10-11T13:00:01Z' }, now)).toBeUndefined();
    expect(getWeekScoutLocation({ ...snapshot, captured_at: 'invalid' }, now)).toBeUndefined();
    expect(getWeekScoutLocation(null, now)).toBeUndefined();
  });

  it.each([{ lat: NaN }, { lon: Infinity }, { lat: 91 }, { lon: -181 }, { lat: '33.15' }])(
    'rejects invalid snapshot coordinates %j', (coordinates) => {
      expect(getWeekScoutLocation({ ...snapshot, ...coordinates }, now)).toBeUndefined();
    },
  );

  it('preserves the legacy request freshness window', () => {
    const old = { ...snapshot, captured_at: '2026-10-10T13:00:01Z' };
    expect(getWeekScoutLocation(old, now, 24 * 3_600_000)).toEqual({ lat: snapshot.lat, lon: snapshot.lon });
    expect(getWeekScoutLocation({ ...old, captured_at: '2026-10-10T13:00:00Z' }, now, 24 * 3_600_000)).toBeUndefined();
  });

  it('prioritizes searched origin, then fresh location, then home', async () => {
    const supabase = client();
    const location = getWeekScoutLocation(snapshot, now);
    const origin = { lat: 21.28, lon: -157.83 };
    expect(await resolveWeekScoutScopeAnchor(supabase, origin, location, 'home-id')).toEqual({ anchor: origin, source: 'origin' });
    expect(await resolveWeekScoutScopeAnchor(supabase, null, location, 'home-id')).toEqual({ anchor: location, source: 'location' });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(await resolveWeekScoutScopeAnchor(supabase, null, undefined, 'home-id')).toEqual({ anchor: home, source: 'home' });
    expect(supabase.from).toHaveBeenCalledWith('beaches');
  });

  it('returns no scope without location or a finite home anchor', async () => {
    const supabase = client();
    expect(await resolveWeekScoutScopeAnchor(supabase, null, undefined, null)).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(await resolveWeekScoutScopeAnchor(client(null), null, undefined, 'home-id')).toBeNull();
    expect(await resolveWeekScoutScopeAnchor(client({ lat: NaN, lon: 1 }), null, undefined, 'home-id')).toBeNull();
  });

  it('preserves the home-read error instead of returning an empty scope', async () => {
    await expect(resolveWeekScoutScopeAnchor(client(null, { message: 'unavailable' }), null, undefined, 'home-id'))
      .rejects.toThrow('Failed to load Week Scout home beach: unavailable');
  });
});
