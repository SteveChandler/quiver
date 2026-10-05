export const SWELL_ENGAGEMENT = {
  answerWindowHours: 48,
  pauseAfterUnanswered: 3,
  exceptionAfterDays: 14,
  firstSightingMinHours: 72,
} as const;

export interface SwellEngagementState {
  consecutiveUnanswered: number;
  lastSentAt: string | null;
  pausedSince: string | null;
  lastAnsweredAt: string | null;
  lastExceptionAt: string | null;
  lastFirstSightingAt: string | null;
}

export const EMPTY_SWELL_ENGAGEMENT: SwellEngagementState = {
  consecutiveUnanswered: 0,
  lastSentAt: null,
  pausedSince: null,
  lastAnsweredAt: null,
  lastExceptionAt: null,
  lastFirstSightingAt: null,
};

export type SwellSendKind = 'first_sighting' | 'followup';
export type SwellSendDecision =
  | { ok: true; exception: boolean }
  | { ok: false; reason: 'skipped_unengaged' | 'first_sighting_spacing'; exceptionEligible: boolean };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function settle<T extends SwellEngagementState>(state: T, now: Date): T {
  if (state.pausedSince !== null || state.lastSentAt === null) return state;
  if (state.consecutiveUnanswered < SWELL_ENGAGEMENT.pauseAfterUnanswered) return state;
  const lapse = Date.parse(state.lastSentAt) + SWELL_ENGAGEMENT.answerWindowHours * HOUR_MS;
  return now.getTime() > lapse ? { ...state, pausedSince: new Date(lapse).toISOString() } : state;
}

export function applyOpen<T extends SwellEngagementState>(state: T, now: Date): T {
  const current = settle(state, now);
  const age = current.lastSentAt === null ? null : now.getTime() - Date.parse(current.lastSentAt);
  const answered = current.consecutiveUnanswered > 0 && age !== null
    && age >= 0 && age <= SWELL_ENGAGEMENT.answerWindowHours * HOUR_MS;
  if (current.pausedSince !== null) {
    // Resuming after a late open does not make the old push answered.
    return {
      ...current,
      pausedSince: null,
      consecutiveUnanswered: 0,
      lastAnsweredAt: answered ? now.toISOString() : current.lastAnsweredAt,
    };
  }
  if (!answered) return current;
  return { ...current, consecutiveUnanswered: 0, lastAnsweredAt: now.toISOString() };
}

export function decideSend(
  state: SwellEngagementState,
  now: Date,
  kind: SwellSendKind,
  rare: boolean,
): SwellSendDecision {
  const current = settle(state, now);
  const tooSoon = kind === 'first_sighting'
    && current.lastFirstSightingAt !== null
    && now.getTime() - Date.parse(current.lastFirstSightingAt) < SWELL_ENGAGEMENT.firstSightingMinHours * HOUR_MS;
  if (current.pausedSince !== null) {
    const reference = Math.max(
      Date.parse(current.pausedSince),
      current.lastExceptionAt ? Date.parse(current.lastExceptionAt) : 0,
    );
    const open = kind === 'first_sighting'
      && now.getTime() - reference >= SWELL_ENGAGEMENT.exceptionAfterDays * DAY_MS;
    if (open && rare) {
      if (tooSoon) return { ok: false, reason: 'first_sighting_spacing', exceptionEligible: false };
      return { ok: true, exception: true };
    }
    return { ok: false, reason: 'skipped_unengaged', exceptionEligible: open };
  }
  if (current.consecutiveUnanswered >= SWELL_ENGAGEMENT.pauseAfterUnanswered) {
    return { ok: false, reason: 'skipped_unengaged', exceptionEligible: false };
  }
  if (tooSoon) {
    return { ok: false, reason: 'first_sighting_spacing', exceptionEligible: false };
  }
  return { ok: true, exception: false };
}

export function recordSend<T extends SwellEngagementState>(
  state: T,
  now: Date,
  kind: SwellSendKind,
  exception: boolean,
): T {
  const current = settle(state, now);
  const at = now.toISOString();
  return {
    ...current,
    consecutiveUnanswered: current.consecutiveUnanswered + 1,
    lastSentAt: at,
    lastFirstSightingAt: kind === 'first_sighting' ? at : current.lastFirstSightingAt,
    lastExceptionAt: exception ? at : current.lastExceptionAt,
  };
}
