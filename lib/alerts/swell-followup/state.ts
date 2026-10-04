import type { SupabaseClient } from "@supabase/supabase-js";

import { readAllPages } from "@/lib/alerts/swell-events/paging";
import { isSwellKind, type SwellKind } from "@/lib/notifications/copy/swell-card-headline";
import type { Database } from "@/types/database.generated";

import type { SwellFollowupStatus } from "./change-detection";

const SWELL_EVENT_USER_STATE_TABLE = "swell_event_user_state";
const STATE_COLUMNS = [
  "user_id",
  "event_key",
  "beach_id",
  "last_arrival_at",
  "last_peak_at",
  "last_face_height_ft",
  "last_period_s",
  "last_direction_deg",
  "serious",
  "last_kind",
  "told_kinds",
  "last_told_at",
  "last_followup_at",
  "status",
].join(",");

/** The (user, event, beach) pin from the first alert, with what the user was last told. */
export interface SwellFollowupState {
  userId: string;
  eventKey: string;
  beachId: string;
  lastArrivalAt: string;
  lastPeakAt: string;
  lastFaceHeightFt: number;
  lastPeriodS: number;
  lastDirectionDeg: number;
  serious: boolean;
  lastKind: SwellKind;
  toldKinds: SwellKind[];
  /** Kept exactly as stored: it is the optimistic-lock value for the next claim. */
  lastToldAt: string;
  lastFollowupAt: string | null;
  status: SwellFollowupStatus;
}

export interface SwellToldUpdate {
  arrivalAt: string;
  peakAt: string;
  faceHeightFt: number;
  periodS: number;
  directionDeg: number;
  serious: boolean;
  kind: SwellKind;
  toldAt: string;
  status: SwellFollowupStatus;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stateFromRow(row: Record<string, unknown>): SwellFollowupState | null {
  const userId = text(row.user_id);
  const eventKey = text(row.event_key);
  const beachId = text(row.beach_id);
  const lastArrivalAt = text(row.last_arrival_at);
  const lastPeakAt = text(row.last_peak_at);
  const lastFaceHeightFt = numeric(row.last_face_height_ft);
  const lastPeriodS = numeric(row.last_period_s);
  const lastDirectionDeg = numeric(row.last_direction_deg);
  const lastToldAt = text(row.last_told_at);
  const status = text(row.status);
  if (
    !userId || !eventKey || !beachId || !lastArrivalAt || !lastPeakAt || lastFaceHeightFt === null
    || lastPeriodS === null || lastDirectionDeg === null || !lastToldAt || !isSwellKind(row.last_kind)
    || (status !== "active" && status !== "arrived" && status !== "dropped" && status !== "passed")
  ) {
    return null;
  }
  return {
    userId,
    eventKey,
    beachId,
    lastArrivalAt,
    lastPeakAt,
    lastFaceHeightFt,
    lastPeriodS,
    lastDirectionDeg,
    serious: row.serious === true,
    lastKind: row.last_kind,
    toldKinds: Array.isArray(row.told_kinds) ? row.told_kinds.filter(isSwellKind) : [],
    lastToldAt,
    lastFollowupAt: text(row.last_followup_at),
    status,
  };
}

// The table is not in the generated types; rows are validated field by field above.
function untyped(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function loadActiveSwellFollowupStates(
  supabase: SupabaseClient<Database>,
): Promise<SwellFollowupState[]> {
  const rows = await readAllPages(async (offset, limit) => {
    const { data, error } = await untyped(supabase)
      .from(SWELL_EVENT_USER_STATE_TABLE)
      .select(STATE_COLUMNS)
      .eq("status", "active")
      .order("user_id", { ascending: true })
      .order("event_key", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to load swell follow-up state: ${error.message}`);
    return (data ?? []) as unknown as Array<Record<string, unknown>>;
  });
  return rows.flatMap((row) => {
    const state = stateFromRow(row);
    return state ? [state] : [];
  });
}

/** Pins (user, event, beach) at the first alert. An existing pin is left as it is. */
export async function saveSwellFirstTold(
  supabase: SupabaseClient<Database>,
  args: { userId: string; eventKey: string; beachId: string; told: SwellToldUpdate },
): Promise<void> {
  const { error } = await untyped(supabase)
    .from(SWELL_EVENT_USER_STATE_TABLE)
    .upsert({
      user_id: args.userId,
      event_key: args.eventKey,
      beach_id: args.beachId,
      last_arrival_at: args.told.arrivalAt,
      last_peak_at: args.told.peakAt,
      last_face_height_ft: args.told.faceHeightFt,
      last_period_s: args.told.periodS,
      last_direction_deg: args.told.directionDeg,
      serious: args.told.serious,
      last_kind: args.told.kind,
      told_kinds: [args.told.kind],
      last_told_at: args.told.toldAt,
      status: args.told.status,
    }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  if (error) throw new Error(`Failed to save swell follow-up state: ${error.message}`);
}

/**
 * Records a follow-up as told before it is enqueued. False when another run
 * told this user something about the event first, so one change is one push.
 */
export async function claimSwellFollowup(
  supabase: SupabaseClient<Database>,
  state: SwellFollowupState,
  told: SwellToldUpdate,
): Promise<boolean> {
  const { data, error } = await untyped(supabase)
    .from(SWELL_EVENT_USER_STATE_TABLE)
    .update({
      last_arrival_at: told.arrivalAt,
      last_peak_at: told.peakAt,
      last_face_height_ft: told.faceHeightFt,
      last_period_s: told.periodS,
      last_direction_deg: told.directionDeg,
      serious: told.serious,
      last_kind: told.kind,
      told_kinds: [...new Set([...state.toldKinds, told.kind])],
      last_told_at: told.toldAt,
      last_followup_at: told.toldAt,
      status: told.status,
      updated_at: told.toldAt,
    })
    .eq("user_id", state.userId)
    .eq("event_key", state.eventKey)
    .eq("status", "active")
    .eq("last_told_at", state.lastToldAt)
    .select("user_id");
  if (error) throw new Error(`Failed to claim swell follow-up: ${error.message}`);
  return (data ?? []).length > 0;
}

/** Stops tracking an event whose peak has passed, without telling the user anything. */
export async function closeSwellFollowupState(
  supabase: SupabaseClient<Database>,
  state: Pick<SwellFollowupState, "userId" | "eventKey">,
  status: SwellFollowupStatus,
  now: Date,
): Promise<void> {
  const { error } = await untyped(supabase)
    .from(SWELL_EVENT_USER_STATE_TABLE)
    .update({ status, updated_at: now.toISOString() })
    .eq("user_id", state.userId)
    .eq("event_key", state.eventKey)
    .eq("status", "active");
  if (error) throw new Error(`Failed to close swell follow-up state: ${error.message}`);
}
