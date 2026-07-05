import { boardStyleFit } from '@/lib/services/discovery/board-style-fit';

describe('boardStyleFit', () => {
  it('adds fit points for a longboarder at a mellow wave', () => {
    expect(boardStyleFit(-0.8, 'longboard')).toEqual({
      points: 5,
      reason: 'Classic longboard wave',
    });
  });

  it('penalizes a longboarder at a punchy wave', () => {
    const result = boardStyleFit(0.9, 'longboard');

    expect(result.points).toBe(-10);
    expect(result.warning).toBe('Punchy, steep wave - rough on a log');
  });

  it('is inert for unseeded beaches', () => {
    expect(boardStyleFit(null, 'longboard')).toEqual({ points: 0 });
  });

  it('is inert when the user has no resolved board class', () => {
    expect(boardStyleFit(-0.8, null)).toEqual({ points: 0 });
  });
});
