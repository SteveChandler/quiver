import { BOARD_CLASSES } from '@/lib/domains/rideability';
import {
  boardImpliedSkill,
  resolveVerdictSkill,
} from '@/lib/domains/rideability/ability';

describe('boardImpliedSkill', () => {
  it('maps every board class to the canonical skill prior', () => {
    expect(BOARD_CLASSES.map((board) => [board, boardImpliedSkill(board)])).toEqual([
      ['foamie', 'beginner'],
      ['longboard', 'beginner'],
      ['mid-length', 'intermediate'],
      ['funboard', 'intermediate'],
      ['fish', 'intermediate'],
      ['shortboard', 'intermediate'],
      ['step-up', 'advanced'],
      ['gun', 'advanced'],
      ['sup', 'beginner'],
      ['foil', 'beginner'],
      ['bodyboard', 'intermediate'],
    ]);
  });
});

describe('resolveVerdictSkill', () => {
  it('prefers a valid stored experience level', () => {
    expect(resolveVerdictSkill('advanced', 'longboard')).toEqual({
      skill: 'advanced',
      source: 'profile',
    });
  });

  it('normalizes stored experience level before resolving', () => {
    expect(resolveVerdictSkill(' Expert ', 'foamie')).toEqual({
      skill: 'expert',
      source: 'profile',
    });
  });

  it('falls back to board-implied prior when skill is missing', () => {
    expect(resolveVerdictSkill(null, 'shortboard')).toEqual({
      skill: 'intermediate',
      source: 'board_prior',
    });
  });

  it('falls back to board-implied prior when stored skill is invalid', () => {
    expect(resolveVerdictSkill('pro', 'gun')).toEqual({
      skill: 'advanced',
      source: 'board_prior',
    });
  });

  it('falls back to intermediate when skill and board are both missing', () => {
    expect(resolveVerdictSkill(null, null)).toEqual({
      skill: 'intermediate',
      source: 'default',
    });
  });
});
