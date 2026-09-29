jest.mock('@/lib/logger', () => ({ createContextLogger: () => ({ warn: jest.fn() }) }));
import { applySimilarityLayer, interpretRpcResult, forecastToMatchSlot } from '@/lib/services/discovery/similarity-layer';
import type { SurfDiscoveryRecommendation } from '@/types/personalization';

const row = (id: string, at = '2026-09-23T12:00:00Z'): SurfDiscoveryRecommendation => ({
  beach: { id }, forecast: { beach_id: id, forecast_at: at, wave_height: '3-5 ft', wave_period: '15s', wind_speed: '3 mph' },
  score: 94, similarity: null,
} as SurfDiscoveryRecommendation);
const match = { state: 'ready', score: 6.4, label: 'FAIR', confidence: 'high', sessions_in_profile: 39, reason_bullets: ['Similar sessions'] };

it('scores all beaches and windows with one set-based RPC, matching timestamps by instant', async () => {
  const recommendations = [row('a'), row('b'), row('a', '2026-09-23T15:00:00Z')];
  const rpc = jest.fn().mockResolvedValue({ data: { matches: recommendations.map((rec) => ({ beach_id: rec.beach.id, forecast_at: new Date(rec.forecast.forecast_at).toISOString(), result: match })) }, error: null });
  const result = await applySimilarityLayer({ recommendations, userId: 'user', isPro: true, supabase: { rpc } });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('get_week_scout_personalization', { p_user_id: 'user', p_beach_ids: ['a', 'b'], p_slots: recommendations.map((rec) => ({ beach_id: rec.beach.id, ...forecastToMatchSlot(rec.forecast) })) });
  for (const rec of result.recommendations) {
    expect(rec.score).toBe(94);
    expect(rec.similarity).toMatchObject({ state: 'ready', label: 'FAIR', score: 6.4, sessionCount: 39 });
  }
  expect(recommendations.every((rec) => rec.similarity === null)).toBe(true);
});
it.each([['user', false], [null, true]])('skips calls without paid authenticated access (%s/%s)', async (userId, isPro) => {
  const rpc = jest.fn();
  const result = await applySimilarityLayer({ recommendations: [row('a')], userId: userId as string | null, isPro: Boolean(isPro), supabase: { rpc } });
  expect(rpc).not.toHaveBeenCalled();
  expect(result.recommendations[0].similarity).toBeNull();
});
it('preserves missing IDs, missing results and physical scores during RPC failures', async () => {
  for (const response of [{ data: { matches: [] }, error: null }, { data: null, error: { message: 'unavailable' } }]) {
    const rpc = jest.fn().mockResolvedValue(response);
    const result = await applySimilarityLayer({ recommendations: [row(''), row('a')], userId: 'user', isPro: true, supabase: { rpc } });
    expect(result.recommendations.map((rec) => [rec.score, rec.similarity])).toEqual([[94, null], [94, null]]);
    expect(rpc.mock.calls[0][1].p_beach_ids).toEqual(['a']);
  }
});
it.each(['onboarding', 'starter'])('interprets %s without altering physical scores', (state) => {
  expect(interpretRpcResult({ state, session_count: 2, sessions_needed: 3 })).toEqual({ state: 'onboarding', sessionCount: 2, sessionsNeeded: 3 });
});
it.each(['ready', 'learned'])('interprets %s and requires numeric evidence', (state) => {
  expect(interpretRpcResult({ ...match, state, similar_session_count: 5 })).toMatchObject({ state: 'ready', similarSessionCount: 5 });
  expect(interpretRpcResult({ ...match, state, score: null })).toBeNull();
});
it('ignores unrecognized and locked states', () => {
  expect(interpretRpcResult(null)).toBeNull();
  expect(interpretRpcResult({ state: 'locked' })).toBeNull();
});

describe('forecastToMatchSlot source keys', () => {
  const base = { beach_id: 'a', forecast_at: '2026-09-29T15:00:00Z', wave_height: '3.6 ft', wave_period: '5s', wind_speed: '3 mph', wind_direction_deg: 104, tide_height: '5.4 ft' };
  it('sends data_source and wave_period_om as text when the row has them', () => {
    expect(forecastToMatchSlot({ ...base, data_source: 'OPEN_METEO', wave_period_om: 9.9 } as never)).toEqual({
      forecast_at: '2026-09-29T15:00:00Z', wave_height: '3.6 ft', wave_period: '5', wind_speed: '3 mph',
      wind_direction: '104', tide_height: '5.4 ft', data_source: 'OPEN_METEO', wave_period_om: '9.9',
    });
  });
  it('omits both keys, never blanks them, when unavailable so the slot scores as before', () => {
    for (const extra of [{}, { data_source: null, wave_period_om: null }, { data_source: '', wave_period_om: Number.NaN }]) {
      const slot = forecastToMatchSlot({ ...base, ...extra } as never);
      expect(slot).not.toHaveProperty('data_source');
      expect(slot).not.toHaveProperty('wave_period_om');
    }
  });
  it('keeps a lone key: CDIP rows may carry the co-located Open-Meteo mean', () => {
    expect(forecastToMatchSlot({ ...base, data_source: 'CDIP', wave_period_om: 9.6 } as never)).toMatchObject({ data_source: 'CDIP', wave_period_om: '9.6' });
    expect(forecastToMatchSlot({ ...base, data_source: 'NOAA_NWS' } as never)).not.toHaveProperty('wave_period_om');
  });
});
