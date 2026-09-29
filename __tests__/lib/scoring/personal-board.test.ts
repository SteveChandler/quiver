import { boardHistoryNudge, conditionSimilarity, recommendBoard, similarityPeriod, LIKE_THIS_SIMILARITY, type PersonalBoard, type BoardSession } from '@/lib/scoring/personal-board';
import { normalizeBoardClass } from '@/lib/domains/rideability';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const beach = { id: 'ponto', name: 'Ponto', break_type: 'beach', skill_level: 'intermediate', preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, lat: 33, lon: -117, wind_offshore_deg: 90 } as Beach;
const forecast = { confidence_score: 90, forecast_at: '2026-09-23T12:00:00Z', wave_height: '3.7 ft', wave_period: '15s', wind_speed: '3 mph', wind_direction_deg: 150, tide_height: '3 ft', tide_status: 'Rising' } as EnhancedForecastEntity;
function board(id: string, name: string, type: string, count: number, height: number, rating: number, fit: string | null = null, legacyFit: string | null = null): PersonalBoard {
  return { id, name, board_type: type, sessions: Array.from({ length: count }, (_, i): BoardSession => ({
    id: `${id}-${i}`, status: 'completed', deleted_at: null, rating, session_board_fit: fit, board_fit: legacyFit,
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
it('classifies a thruster by its board type', () => {
  expect(normalizeBoardClass('thruster')).toBe('shortboard');
  expect(normalizeBoardClass('Twin pin')).toBe('fish');
  expect(recommendBoard([board('unknown', 'Twin pin', 'unknown', 5, 3.7, 4)], forecast, beach, 'advanced')?.boardClass).toBe('fish');
});
it('chooses the history-backed all-rounder for the diagnosed fixture and includes the other', () => {
  const pick = recommendBoard(boards, forecast, beach, 'advanced');
  expect(pick?.name).toBe('Twin pin');
  expect(pick?.alternates.map((b) => b.name)).toContain('Machadocado');
  expect(pick?.reason).toBe('Twin pin: an all-rounder for 3-4 ft (glassy faces; long-period power)');
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

it('penalizes wrong type more than too small for otherwise identical boards', () => {
  const a = board('a', 'A', 'fish', 5, 3.7, 4, 'right');
  const b = board('b', 'B', 'fish', 5, 3.7, 4, 'right');
  a.sessions!.push({ ...a.sessions![0], id: 'a-extra', session_board_fit: 'wrong_type' });
  b.sessions!.push({ ...b.sessions![0], id: 'b-extra', session_board_fit: 'too_small' });
  expect(recommendBoard([a, b], forecast, beach, 'advanced')?.id).toBe('b');
});

it('does not credit a mismatched five-star session', () => {
  const a = board('a', 'A', 'fish', 5, 3.7, 4);
  const b = board('b', 'B', 'fish', 5, 3.7, 4);
  a.sessions!.push({ ...a.sessions![0], id: 'a-extra', rating: 5, session_board_fit: 'wrong_type' });
  b.sessions!.push({ ...b.sessions![0], id: 'b-extra', rating: 5, session_board_fit: 'right' });
  expect(recommendBoard([a, b], forecast, beach, 'advanced')?.id).toBe('b');
});

it('gives a mixed beach and reef session the same similarity as a beach session', () => {
  const snapshot = { wave_height: '3.7 ft', wave_period: '15s', wind_speed: '3 mph', tide_height: '3 ft' };
  expect(conditionSimilarity(snapshot, forecast, { ...beach, break_type: 'beach/reef break' }, beach))
    .toBe(conditionSimilarity(snapshot, forecast, beach, beach));
});

it('accepts the production one-to-one PostgREST snapshot shape', () => {
  const quiver = boards.map((b) => ({ ...b, sessions: b.sessions?.map((session) => ({ ...session,
    session_forecast_snapshots: Array.isArray(session.session_forecast_snapshots) ? session.session_forecast_snapshots[0] : session.session_forecast_snapshots,
  })) }));
  expect(recommendBoard(quiver, forecast, beach, 'advanced')).toEqual(recommendBoard(boards, forecast, beach, 'advanced'));
});

it('never puts a session count in the reason, however much history backs the pick', () => {
  const a = board('a', 'A', 'fish', 12, 3.7, 5, 'right');
  const reason = recommendBoard([a], forecast, beach, 'advanced')?.reason;
  expect(reason).toBe('A: an all-rounder for 3-4 ft (glassy faces; long-period power)');
  expect(reason).not.toMatch(/session/i);
});

it('still ranks boards using feedback between the evidence and like-this cutoffs', () => {
  const a = board('a', 'A', 'fish', 3, 6, 3, 'too_small');
  const b = board('b', 'B', 'fish', 3, 6, 3, 'right');
  const snapshot = { wave_height: '6', wave_period: '15s', wind_speed: '3 mph', tide_height: '3 ft', tide_status: 'incoming' };
  const similarity = conditionSimilarity(snapshot, forecast, beach, beach);
  expect(similarity).toBeGreaterThanOrEqual(0.35);
  expect(similarity).toBeLessThan(0.7);
  const pick = recommendBoard([a, b], forecast, beach, 'advanced');
  expect(pick?.id).toBe('b');
  expect(pick?.reason).not.toMatch(/session/i);
});

describe('conditions-first pick', () => {
  // Del Mar 2026-09-29 08:00 on Surfline-like inputs: 3.5 ft, 8 s, light offshore, tide filling.
  const allRounderDay = { ...forecast, wave_height: '3.5 ft', wave_period: '8s', wind_speed: '8 mph', wind_direction_deg: 90, tide_height: '4.1 ft' } as EnhancedForecastEntity;
  const smallCleanDay = { ...forecast, wave_height: '2 ft', wave_period: '12s', wind_speed: '2 mph', tide_height: '2.5 ft' } as EnhancedForecastEntity;

  it('picks an all-rounder over a heavily ridden longboard at 3.5 ft for an advanced surfer', () => {
    const pick = recommendBoard([board('lb', 'Southpoint', 'longboard', 30, 3.5, 5, 'right'), board('mid', 'Ghombra', 'midlength', 0, 3.5, 3)], allRounderDay, beach, 'advanced');
    expect(pick?.name).toBe('Ghombra');
    expect(pick?.alternates.map((b) => b.name)).toEqual(['Southpoint']);
    expect(pick?.reason).toMatch(/^Ghombra: an all-rounder for 3-4 ft/);
  });

  it('picks the longboard on a small, clean day', () => {
    const pick = recommendBoard([board('lb', 'Southpoint', 'longboard', 0, 2, 3), board('mid', 'Ghombra', 'midlength', 0, 2, 3)], smallCleanDay, beach, 'advanced');
    expect(pick?.name).toBe('Southpoint');
    expect(pick?.reason).toMatch(/^Southpoint: a longboard for 2-3 ft/);
  });

  it('counts a twin pin typed as a shortboard as an all-rounder', () => {
    expect(recommendBoard([board('tp', 'Twin pin', 'shortboard', 0, 3.5, 3)], allRounderDay, beach, 'advanced')?.boardClass).toBe('fish');
  });

  it('caps history so a board that fits the conditions beats a heavily liked board that does not', () => {
    const solid = { ...forecast, wave_height: '5 ft', wave_period: '14s' } as EnhancedForecastEntity;
    const pick = recommendBoard([board('lb', 'Log', 'longboard', 50, 5, 5, 'right'), board('sb', 'Thruster', 'shortboard', 0, 5, 3)], solid, beach, 'advanced');
    expect(pick?.name).toBe('Thruster');
  });

  it('names the closest owned board with class advice when nothing in the quiver fits well', () => {
    const bigger = { ...forecast, wave_height: '6 ft', wave_period: '10s' } as EnhancedForecastEntity;
    const pick = recommendBoard([board('f', 'Fish', 'fish', 0, 6, 3)], bigger, beach, 'advanced');
    expect(pick?.reason).toMatch(/^Ride a shortboard or step-up in \d+-\d+ ft waves\. Closest board you own: Fish/);
  });

  it('returns no pick when no board reaches the fit floor', () => {
    expect(recommendBoard([board('lb', 'Log', 'longboard', 0, 12, 3)], { ...forecast, wave_height: '12 ft' } as EnhancedForecastEntity, beach, 'advanced')).toBeNull();
  });
});

describe('board fit feedback', () => {
  const pair = (a: PersonalBoard, b: PersonalBoard) => recommendBoard([a, b], forecast, beach, 'advanced')?.id;
  const twins = () => [board('a', 'A', 'fish', 5, 3.7, 4), board('b', 'B', 'fish', 5, 3.7, 4)] as const;

  it('reads the legacy not_right fit when session_board_fit is null', () => {
    const [a, b] = twins();
    a.sessions!.push({ ...a.sessions![0], id: 'a-extra', board_fit: 'not_right' });
    b.sessions!.push({ ...b.sessions![0], id: 'b-extra' });
    expect(pair(a, b)).toBe('b');
  });

  it('reads the legacy good and perfect fits as right', () => {
    for (const legacy of ['good', 'perfect']) {
      const [a, b] = twins();
      a.sessions!.push({ ...a.sessions![0], id: 'a-extra' });
      b.sessions!.push({ ...b.sessions![0], id: 'b-extra', board_fit: legacy });
      expect(pair(a, b)).toBe('b');
    }
  });

  it('weights legacy not_right as a generic negative, not as wrong_type', () => {
    const [a, b] = twins();
    a.sessions!.push({ ...a.sessions![0], id: 'a-extra', session_board_fit: 'wrong_type' });
    b.sessions!.push({ ...b.sessions![0], id: 'b-extra', board_fit: 'not_right' });
    expect(pair(a, b)).toBe('b');
  });

  it('lets session_board_fit win over the legacy fit in both directions', () => {
    const [a, b] = twins();
    a.sessions!.push({ ...a.sessions![0], id: 'a-extra' });
    b.sessions!.push({ ...b.sessions![0], id: 'b-extra', session_board_fit: 'right', board_fit: 'not_right' });
    expect(pair(a, b)).toBe('b');

    const [c, d] = twins();
    c.sessions!.push({ ...c.sessions![0], id: 'a-extra', session_board_fit: 'too_small', board_fit: 'perfect' });
    d.sessions!.push({ ...d.sessions![0], id: 'b-extra' });
    expect(pair(c, d)).toBe('b');
  });

  it('does not let two-star sessions build habit for a board', () => {
    expect(pair(board('a', 'A', 'fish', 10, 3.7, 2), board('b', 'B', 'fish', 0, 3.7, 3))).toBe('b');
  });

  it('still lets three-star sessions build habit', () => {
    expect(pair(board('a', 'A', 'fish', 10, 3.7, 3), board('b', 'B', 'fish', 0, 3.7, 3))).toBe('a');
  });

  it('does not let negative-fit sessions build habit, however well they were rated', () => {
    expect(pair(board('a', 'A', 'fish', 10, 3.7, 4, 'too_small'), board('b', 'B', 'fish', 0, 3.7, 3))).toBe('b');
    expect(pair(board('a', 'A', 'fish', 10, 3.7, 4, null, 'not_right'), board('b', 'B', 'fish', 0, 3.7, 3))).toBe('b');
  });
});

describe('source-aware similarity period', () => {
  // Open-Meteo rows carry the tallest partition's period in wave_period (5 s) beside the whole-sea height;
  // the whole-sea mean period is wave_period_om. CDIP history stores the whole-sea peak period.
  const omRow = { ...forecast, wave_height: '3.6 ft', wave_period: '5s', wave_period_om: 9.9, data_source: 'OPEN_METEO' } as EnhancedForecastEntity;
  const cdipSnapshot = { wave_height: '3.4 ft', wave_period: '11s', wind_speed: '3 mph', tide_height: '3 ft', tide_status: 'incoming', data_source: 'CDIP' };

  it.each([
    [{ data_source: 'OPEN_METEO', wave_period: '5s', wave_period_om: 9.9 }, 9.9],
    [{ data_source: 'open_meteo', wave_period: '5s', wave_period_om: '9.9' }, 9.9],
    [{ data_source: 'OPEN_METEO', wave_period: '5s', wave_period_om: 0 }, 5],
    [{ data_source: 'OPEN_METEO', wave_period: '5s', wave_period_om: null }, 5],
    [{ data_source: 'OPEN_METEO', wave_period: '5s' }, 5],
    [{ data_source: 'OPEN_METEO', wave_period: '5s', wave_period_om: 'NaN' }, 5],
    [{ data_source: 'CDIP', wave_period: '13s', wave_period_om: 9.6 }, 13],
    [{ data_source: 'NOAA_NWS', wave_period: '9', wave_period_om: 9.6 }, 9],
    [{ wave_period: '12s', wave_period_om: 9.6 }, 12],
    [{ data_source: 'OPEN_METEO', wave_period: null, wave_period_om: 9.9 }, 9.9],
    [{ data_source: 'CDIP' }, null],
    [{}, null],
  ])('reads %j as %s', (row, expected) => {
    expect(similarityPeriod(row)).toBe(expected);
  });

  it('matches an Open-Meteo row to a 10-12 s CDIP session that its tallest-partition period misses', () => {
    const aware = conditionSimilarity(cdipSnapshot, omRow, beach, beach);
    const legacy = conditionSimilarity(cdipSnapshot, { ...omRow, data_source: 'CDIP' } as EnhancedForecastEntity, beach, beach);
    expect(aware).toBeGreaterThanOrEqual(LIKE_THIS_SIMILARITY);
    expect(legacy).toBeLessThan(0.5);
  });

  it('leaves a CDIP row unchanged whatever wave_period_om says', () => {
    const cdipRow = { ...forecast, wave_height: '3.6 ft', wave_period: '11s', wave_period_om: 5, data_source: 'CDIP' } as EnhancedForecastEntity;
    expect(conditionSimilarity(cdipSnapshot, cdipRow, beach, beach))
      .toBe(conditionSimilarity(cdipSnapshot, { ...cdipRow, wave_period_om: null } as EnhancedForecastEntity, beach, beach));
  });

  it('reads an Open-Meteo session snapshot by its mean period on the history side', () => {
    const omSnapshot = { ...cdipSnapshot, wave_period: '5s', wave_period_om: 11, data_source: 'OPEN_METEO' };
    const cdipRow = { ...forecast, wave_height: '3.6 ft', wave_period: '11s', data_source: 'CDIP' } as EnhancedForecastEntity;
    expect(conditionSimilarity(omSnapshot, cdipRow, beach, beach)).toBeGreaterThanOrEqual(LIKE_THIS_SIMILARITY);
  });

  it('lets CDIP history nudge the pick for an Open-Meteo row that its tallest-partition period would miss', () => {
    const withHistory: PersonalBoard = {
      id: 'a', name: 'Machadocado', board_type: 'fish', sessions: Array.from({ length: 5 }, (_, i): BoardSession => ({
        id: `a-${i}`, status: 'completed', deleted_at: null, rating: 5, session_board_fit: 'right', arrival_time: '2026-09-10T12:00:00Z',
        beaches: beach, session_forecast_snapshots: [{ forecast_snapshot: cdipSnapshot }],
      })),
    };
    const om = boardHistoryNudge(withHistory, omRow, beach);
    const legacy = boardHistoryNudge(withHistory, { ...omRow, data_source: 'CDIP' } as EnhancedForecastEntity, beach);
    expect(om).toBe(5);
    expect(legacy).toBeLessThan(om);
  });
});
