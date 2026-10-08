import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import type { BoardClass } from './board-class';

const BOARD_IMPLIED_SKILL: Record<BoardClass, SkillLevel> = {
  foamie: 'beginner',
  longboard: 'beginner',
  sup: 'beginner',
  foil: 'beginner',
  funboard: 'intermediate',
  fish: 'intermediate',
  'mid-length': 'intermediate',
  bodyboard: 'intermediate',
  shortboard: 'intermediate',
  'step-up': 'advanced',
  gun: 'advanced',
};

export type SkillSource = 'profile' | 'board_prior' | 'default';

export function boardImpliedSkill(board: BoardClass): SkillLevel {
  return BOARD_IMPLIED_SKILL[board];
}
