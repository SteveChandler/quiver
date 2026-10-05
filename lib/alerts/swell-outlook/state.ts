import type { SupabaseClient } from '@supabase/supabase-js';

import type { StoredOutlookList } from '@/lib/services/discovery/swell-outlook-types';
import type { Database } from '@/types/database.generated';

import { EMPTY_SWELL_ENGAGEMENT, applyOpen, type SwellEngagementState } from './engagement';

const TABLE = 'swell_outlook_user_state';
const COLUMNS = [
  'user_id', 'consecutive_unanswered', 'last_sent_at', 'paused_since', 'last_answered_at',
  'last_exception_at', 'last_first_sighting_at', 'outlook_list', 'outlook_prev_list',
].join(',');

export interface SwellOutlookUserState extends SwellEngagementState {
  outlookList: StoredOutlookList | null;
  outlookPrevList: StoredOutlookList | null;
}

export const EMPTY_SWELL_OUTLOOK_USER_STATE: SwellOutlookUserState = {
  ...EMPTY_SWELL_ENGAGEMENT,
  outlookList: null,
  outlookPrevList: null,
};

// The written migration is not in the generated types yet.
function untyped(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseList(value: unknown): StoredOutlookList | null {
  if (!value || typeof value !== 'object') return null;
  const { runDate, swells } = value as { runDate?: unknown; swells?: unknown };
  return typeof runDate === 'string' && Array.isArray(swells)
    ? { runDate, swells: swells as StoredOutlookList['swells'] }
    : null;
}

export async function loadSwellOutlookUserState(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SwellOutlookUserState | null> {
  const { data, error } = await untyped(supabase).from(TABLE).select(COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load swell outlook state: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  const count = typeof row.consecutive_unanswered === 'number' ? row.consecutive_unanswered : 0;
  return {
    consecutiveUnanswered: count,
    lastSentAt: text(row.last_sent_at),
    pausedSince: text(row.paused_since),
    lastAnsweredAt: text(row.last_answered_at),
    lastExceptionAt: text(row.last_exception_at),
    lastFirstSightingAt: text(row.last_first_sighting_at),
    outlookList: parseList(row.outlook_list),
    outlookPrevList: parseList(row.outlook_prev_list),
  };
}

export async function saveSwellOutlookUserState(
  supabase: SupabaseClient<Database>,
  userId: string,
  state: SwellOutlookUserState,
): Promise<void> {
  const { error } = await untyped(supabase).from(TABLE).upsert({
    user_id: userId,
    consecutive_unanswered: state.consecutiveUnanswered,
    last_sent_at: state.lastSentAt,
    paused_since: state.pausedSince,
    last_answered_at: state.lastAnsweredAt,
    last_exception_at: state.lastExceptionAt,
    last_first_sighting_at: state.lastFirstSightingAt,
    outlook_list: state.outlookList,
    outlook_prev_list: state.outlookPrevList,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(`Failed to save swell outlook state: ${error.message}`);
}

export function previousListFor(state: SwellOutlookUserState, runDate: string): StoredOutlookList | null {
  if (state.outlookList && state.outlookList.runDate < runDate) return state.outlookList;
  if (state.outlookPrevList && state.outlookPrevList.runDate < runDate) return state.outlookPrevList;
  return null;
}

export function advanceLists(state: SwellOutlookUserState, list: StoredOutlookList): SwellOutlookUserState {
  if (state.outlookList?.runDate === list.runDate) return { ...state, outlookList: list };
  return { ...state, outlookPrevList: state.outlookList, outlookList: list };
}

export async function recordSwellOpen(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<void> {
  const state = await loadSwellOutlookUserState(supabase, userId);
  if (!state) return;
  const next = applyOpen(state, now);
  if (next === state) return;
  await saveSwellOutlookUserState(supabase, userId, next);
}
