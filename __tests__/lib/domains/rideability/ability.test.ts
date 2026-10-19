import { BOARD_CLASSES } from '@/lib/domains/rideability';
import { boardImpliedSkill } from '@/lib/domains/rideability/ability';

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
