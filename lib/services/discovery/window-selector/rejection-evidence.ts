import type { CandidateRejection } from '@/types/personalization';

const GATE_PROGRESS: Partial<Record<CandidateRejection['gate'], number>> = {
  score_floor: 1,
  horizon: 2,
  time_slot: 3,
  daylight: 4,
  session_duration: 5,
};

export function moreInformativeRejection(
  current: CandidateRejection | null,
  next: CandidateRejection,
): CandidateRejection {
  if (!current) return next;
  const currentProgress = GATE_PROGRESS[current.gate] ?? 0;
  const nextProgress = GATE_PROGRESS[next.gate] ?? 0;
  if (nextProgress > currentProgress) return next;
  if (nextProgress < currentProgress) return current;
  if (next.gate === 'score_floor'
    && (next.observed?.score ?? -Infinity) > (current.observed?.score ?? -Infinity)) return next;
  return current;
}
