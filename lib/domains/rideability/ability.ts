import type { SkillLevel } from '@/lib/domains/user-preferences/skill-level';
import { parseSkillLevel } from '@/lib/domains/user-preferences/skill-level';
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

export interface ResolvedVerdictSkill {
  skill: SkillLevel;
  source: SkillSource;
}

export function boardImpliedSkill(board: BoardClass): SkillLevel {
  return BOARD_IMPLIED_SKILL[board];
}

/** Cold-path resolution: stored skill > board-implied prior > intermediate. */
export function resolveVerdictSkill(
  experienceLevel: string | null | undefined,
  board: BoardClass | null
): ResolvedVerdictSkill {
  const profileSkill = parseSkillLevel(experienceLevel);
  if (profileSkill) {
    return { skill: profileSkill, source: 'profile' };
  }

  if (board) {
    return { skill: boardImpliedSkill(board), source: 'board_prior' };
  }

  return { skill: 'intermediate', source: 'default' };
}
