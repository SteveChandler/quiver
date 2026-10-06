import type { SupabaseClient } from '@supabase/supabase-js';
import { isDeepStrictEqual } from 'node:util';

import type { StoredOutlookList } from '@/lib/services/discovery/swell-outlook-types';
import type { Database } from '@/types/database.generated';

import { EMPTY_SWELL_ENGAGEMENT, applyOpen, type SwellEngagementState } from './engagement';

const TABLE = 'swell_outlook_user_state';
const MAX_WRITE_ATTEMPTS = 3;
const STATE_COLUMNS = {
  consecutiveUnanswered: 'consecutive_unanswered',
  lastSentAt: 'last_sent_at',
  pausedSince: 'paused_since',
  lastAnsweredAt: 'last_answered_at',
  lastExceptionAt: 'last_exception_at',
  lastFirstSightingAt: 'last_first_sighting_at',
  outlookList: 'outlook_list',
  outlookPrevList: 'outlook_prev_list',
} as const;
const COLUMNS = ['user_id', ...Object.values(STATE_COLUMNS), 'updated_at'].join(',');

export interface SwellOutlookUserState extends SwellEngagementState {
  outlookList: StoredOutlookList | null;
  outlookPrevList: StoredOutlookList | null;
}

export const EMPTY_SWELL_OUTLOOK_USER_STATE: SwellOutlookUserState = {
  ...EMPTY_SWELL_ENGAGEMENT,
  outlookList: null,
  outlookPrevList: null,
};

// Retried against fresh state; callbacks must be pure and never return a captured snapshot.
export type SwellOutlookStateTransition = (state: SwellOutlookUserState) => SwellOutlookUserState;

export class SwellOutlookStateConflictError extends Error {
  constructor(userId: string) {
    super(`Swell outlook state changed during all ${MAX_WRITE_ATTEMPTS} attempts for user ${userId}`);
    this.name = 'SwellOutlookStateConflictError';
  }
}

interface StateSnapshot {
  state: SwellOutlookUserState;
  updatedAt: string;
}

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

async function loadSnapshot(supabase: SupabaseClient<Database>, userId: string): Promise<StateSnapshot | null> {
  const { data, error } = await untyped(supabase).from(TABLE).select(COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load swell outlook state: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  const updatedAt = text(row.updated_at);
  if (!updatedAt) throw new Error('Swell outlook state is missing updated_at');
  return {
    updatedAt,
    state: {
      consecutiveUnanswered: typeof row.consecutive_unanswered === 'number' ? row.consecutive_unanswered : 0,
      lastSentAt: text(row.last_sent_at),
      pausedSince: text(row.paused_since),
      lastAnsweredAt: text(row.last_answered_at),
      lastExceptionAt: text(row.last_exception_at),
      lastFirstSightingAt: text(row.last_first_sighting_at),
      outlookList: parseList(row.outlook_list),
      outlookPrevList: parseList(row.outlook_prev_list),
    },
  };
}

export async function loadSwellOutlookUserState(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SwellOutlookUserState | null> {
  return (await loadSnapshot(supabase, userId))?.state ?? null;
}

function storedListsEqual(current: StoredOutlookList | null, next: StoredOutlookList | null): boolean {
  // Match JSON storage semantics before comparing object keys and array order.
  return isDeepStrictEqual(JSON.parse(JSON.stringify(current)), JSON.parse(JSON.stringify(next)));
}

function changedColumns(current: SwellOutlookUserState, next: SwellOutlookUserState): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of Object.keys(STATE_COLUMNS) as Array<keyof typeof STATE_COLUMNS>) {
    const unchanged = field === 'outlookList' || field === 'outlookPrevList'
      ? storedListsEqual(current[field], next[field])
      : current[field] === next[field];
    if (!unchanged) patch[STATE_COLUMNS[field]] = next[field];
  }
  return patch;
}

async function applyTransition(
  supabase: SupabaseClient<Database>,
  userId: string,
  transition: SwellOutlookStateTransition,
  createIfMissing: boolean,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    let snapshot = await loadSnapshot(supabase, userId);
    if (!snapshot) {
      if (!createIfMissing) return;
      const { error } = await untyped(supabase).from(TABLE).upsert(
        { user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true },
      );
      if (error) throw new Error(`Failed to create swell outlook state: ${error.message}`);
      snapshot = await loadSnapshot(supabase, userId);
      if (!snapshot) continue;
    }
    const patch = changedColumns(snapshot.state, transition(snapshot.state));
    if (Object.keys(patch).length === 0) return;
    const { data, error } = await untyped(supabase).from(TABLE)
      .update(patch).eq('user_id', userId).eq('updated_at', snapshot.updatedAt)
      .select('user_id').maybeSingle();
    if (error) throw new Error(`Failed to save swell outlook state: ${error.message}`);
    if (data) return;
  }
  throw new SwellOutlookStateConflictError(userId);
}

export async function saveSwellOutlookUserState(
  supabase: SupabaseClient<Database>,
  userId: string,
  transition: SwellOutlookStateTransition,
): Promise<void> {
  await applyTransition(supabase, userId, transition, true);
}

export async function saveSwellOutlookLists(
  supabase: SupabaseClient<Database>,
  userId: string,
  list: StoredOutlookList,
): Promise<void> {
  await saveSwellOutlookUserState(supabase, userId, (state) => advanceLists(state, list));
}

export function previousListFor(state: SwellOutlookUserState, runDate: string): StoredOutlookList | null {
  if (state.outlookList && state.outlookList.runDate < runDate) return state.outlookList;
  if (state.outlookPrevList && state.outlookPrevList.runDate < runDate) return state.outlookPrevList;
  return null;
}

export function advanceLists(state: SwellOutlookUserState, list: StoredOutlookList): SwellOutlookUserState {
  if (state.outlookList && state.outlookList.runDate > list.runDate) return state;
  if (state.outlookList?.runDate === list.runDate) return { ...state, outlookList: list };
  return { ...state, outlookPrevList: state.outlookList, outlookList: list };
}

export async function recordSwellOpen(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<void> {
  try {
    await applyTransition(supabase, userId, (state) => applyOpen(state, now), false);
  } catch (error) {
    if (error instanceof SwellOutlookStateConflictError) return;
    throw error;
  }
}
