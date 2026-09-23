import { recommendBoard, type PersonalBoard, type BoardSession } from '@/lib/scoring/personal-board';
import { normalizeBoardClass } from '@/lib/domains/rideability';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const beach = { id: 'ponto', name: 'Ponto', break_type: 'beach', skill_level: 'intermediate', preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, lat: 33, lon: -117, wind_offshore_deg: 90 } as Beach;
const forecast = { confidence_score: 90, forecast_at: '2026-09-23T12:00:00Z', wave_height: '3.7 ft', wave_period: '15s', wind_speed: '3 mph', wind_direction_deg: 150, tide_height: '3 ft', tide_status: 'Rising' } as EnhancedForecastEntity;
function board(id: string, name: string, type: string, count: number, height: number, rating: number, fit: string | null = null): PersonalBoard {
  return { id, name, board_type: type, sessions: Array.from({ length: count }, (_, i): BoardSession => ({
    id: `${id}-${i}`, status: 'completed', deleted_at: null, rating, session_board_fit: fit,
    arrival_time: '2026-09-10T12:00:00Z', beaches: beach,
    session_forecast_snapshots: [{ forecast_snapshot: { wave_height: String(height), wave_period: '15s', wind_speed: '3 mph', tide_height: '3 ft', tide_status: 'incoming' } }],
  })) };
}
const boards = [
  board('fish', 'Machadocado', 'fish', 15, 3.3, 2.67),
  board('thruster', 'Twin pin', 'thruster', 14, 4.3, 4.07),
  board('mid', 'Ghombra', 'midlength', 2, 3, 3),
  board('chip', 'Potato chip', 'fish', 2, 2, 3),
  board('log', 'Southpoint', 'longboard-2-plus-1', 1, 2, 4),
];
it('uses the declared thruster type before the Twin pin name', () => {
  expect(normalizeBoardClass('thruster')).toBe('shortboard');
});
it('chooses an experienced board for the diagnosed fixture and includes the other', () => {
  const pick = recommendBoard(boards, forecast, beach, 'advanced');
  expect(['Twin pin', 'Machadocado']).toContain(pick?.name);
  expect([pick?.name, ...pick!.alternates.map((b) => b.name)]).toEqual(expect.arrayContaining(['Twin pin', 'Machadocado']));
  expect(pick?.reason).toMatch(/days like this \(1[45] sessions\)/);
});
it('enforces the physical floor despite repeated positive feedback', () => {
  const pick = recommendBoard([board('log', 'Southpoint', 'longboard', 100, 15, 5, 'right'), board('gun', 'Gun', 'gun', 0, 15, 3)], { ...forecast, wave_height: '10 ft' }, beach, 'advanced');
  expect(pick?.name).toBe('Gun');
});
it('does not learn from deleted or incomplete sessions and has deterministic ties', () => {
  const a = board('a', 'A', 'fish', 10, 3.7, 5, 'right');
  a.sessions!.forEach((s) => { s.deleted_at = '2026-09-20'; });
  const b = board('b', 'B', 'fish', 0, 3.7, 3);
  expect(recommendBoard([b, a], forecast, beach, 'advanced')?.id).toBe('a');
  expect(recommendBoard([a, b], forecast, beach, 'advanced')).toEqual(recommendBoard([b, a], forecast, beach, 'advanced'));
});
it('weights explicit board mismatch strongly and removes the good-day rating bias', () => {
  const a = board('a', 'A', 'fish', 12, 3.7, 5, 'wrong_type');
  const b = board('b', 'B', 'fish', 12, 3.7, 4, 'right');
  expect(recommendBoard([a, b], forecast, beach, 'advanced')?.id).toBe('b');
});

it('accepts the production one-to-one PostgREST snapshot shape', () => {
  const quiver = boards.map((b) => ({ ...b, sessions: b.sessions?.map((session) => ({ ...session,
    session_forecast_snapshots: Array.isArray(session.session_forecast_snapshots) ? session.session_forecast_snapshots[0] : session.session_forecast_snapshots,
  })) }));
  expect(recommendBoard(quiver, forecast, beach, 'advanced')).toEqual(recommendBoard(boards, forecast, beach, 'advanced'));
});
