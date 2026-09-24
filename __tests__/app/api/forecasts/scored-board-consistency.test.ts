import { scoreForecastSlots } from '@/app/api/forecasts/scored/[beachId]/route';
import { scoreWindowConditionDetails } from '@/lib/services/discovery/window-selector/window-scorer';
import type { BoardSession, PersonalBoard } from '@/lib/scoring/personal-board';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const beach = { id: 'ponto', name: 'Ponto', break_type: 'beach', skill_level: 'intermediate', preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, lat: 33, lon: -117, wind_offshore_deg: 90 } as Beach;
const forecast = { confidence_score: 90, forecast_at: '2026-09-23T12:00:00Z', wave_height: '3.7 ft', wave_period: '15s', wind_speed: '3 mph', wind_direction_deg: 150, tide_height: '3 ft', tide_status: 'Rising' } as EnhancedForecastEntity;

function board(id: string, name: string, type: string, count: number, height: number, rating: number): PersonalBoard {
  return {
    id, name, board_type: type,
    sessions: Array.from({ length: count }, (_, i): BoardSession => ({
      id: `${id}-${i}`, status: 'completed', deleted_at: null, rating, session_board_fit: null,
      arrival_time: '2026-09-10T12:00:00Z', beaches: beach,
      session_forecast_snapshots: [{ forecast_snapshot: { wave_height: String(height), wave_period: '15s', wind_speed: '3 mph', tide_height: '3 ft', tide_status: 'incoming' } }],
    })),
  };
}

const quiver = [
  board('fish', 'Machadocado', 'fish', 15, 3.3, 2.67),
  board('thruster', 'Twin pin', 'thruster', 14, 4.3, 4.07),
  board('log', 'Southpoint', 'longboard-2-plus-1', 1, 2, 4),
];
const classes = ['longboard', 'fish'] as const;

describe('scored forecast board advice', () => {
  it('adds the personal board recommendation without changing the slot score', () => {
    const [slot] = scoreForecastSlots([forecast], beach, 'advanced', classes, quiver);
    const main = scoreWindowConditionDetails(forecast, beach, 'advanced', null, classes);

    expect(['Twin pin', 'Machadocado']).toContain(slot.recommendedBoard?.name);
    expect(slot.compositeScore).toBe(main.score);
    expect(slot.boardClass).toBe(main.boardClass);
  });

  it('returns no recommendation and main scoring when the surfer has no boards', () => {
    const [slot] = scoreForecastSlots([forecast], beach, 'advanced', classes, []);
    const main = scoreWindowConditionDetails(forecast, beach, 'advanced', null, classes);

    expect(slot.recommendedBoard).toBeNull();
    expect(slot.compositeScore).toBe(main.score);
    expect(slot.boardClass).toBe(main.boardClass);
  });
});
