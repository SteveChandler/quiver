import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";
import { isCallFeedbackEnabled } from "@/lib/flags/call-feedback";
import {
  isValidUuid,
  withAuth,
  withNoStore,
  withRateLimit,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

type ShownCall = {
  callId: string;
  beachId: string;
  forecastAt: string;
  surface: string | null;
  label: string | null;
  boardId: string | null;
  boardName: string | null;
  boardType: string | null;
  isAnyBoard: boolean;
  isPersonal: true;
  shownAt: string;
};

function metadataCall(row: { metadata: Record<string, unknown>; beach_id: string | null; created_at: string }): ShownCall | null {
  if (row.metadata.is_personal !== true) return null;
  const callId = typeof row.metadata.call_id === "string" ? row.metadata.call_id : null;
  const forecastAt = typeof row.metadata.forecast_at === "string"
    ? row.metadata.forecast_at
    : typeof row.metadata.selected_forecast_at === "string"
      ? row.metadata.selected_forecast_at
      : null;
  if (!callId || !forecastAt || !row.beach_id || Number.isNaN(Date.parse(forecastAt))) return null;
  return {
    callId,
    beachId: row.beach_id,
    forecastAt,
    surface: typeof row.metadata.surface === "string" ? row.metadata.surface : null,
    label: typeof row.metadata.label === "string" ? row.metadata.label : null,
    boardId: typeof row.metadata.board_id === "string" ? row.metadata.board_id : null,
    boardName: null,
    boardType: null,
    isAnyBoard: row.metadata.is_any_board === true,
    isPersonal: true,
    shownAt: row.created_at,
  };
}

async function pendingCallHandler(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  if (!isCallFeedbackEnabled()) {
    return NextResponse.json({ success: true, data: { call: null } });
  }

  const beachId = request.nextUrl.searchParams.get("beachId");
  if (!beachId || !isValidUuid(beachId)) {
    return NextResponse.json({ success: false, error: "Invalid beachId" }, { status: 400 });
  }

  const db = createServiceRoleClient() as any;
  const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await db
    .from("user_events")
    .select("metadata,beach_id,created_at")
    .eq("user_id", user.id)
    .eq("beach_id", beachId)
    .eq("event_type", "board_pick_exposed")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: "Failed to load pending call" }, { status: 500 });

  const now = Date.now();
  const calls: ShownCall[] = (rows ?? [])
    .map((row: { metadata: Record<string, unknown>; beach_id: string | null; created_at: string }) => metadataCall(row))
    .filter((call: ShownCall | null): call is ShownCall => Boolean(call))
    .filter((call: ShownCall) => Date.parse(call.forecastAt) + 3 * 60 * 60 * 1000 < now);
  const callIds = [...new Set(calls.map((call: ShownCall) => call.callId))];
  if (callIds.length === 0) return NextResponse.json({ success: true, data: { call: null } });

  const [{ data: feedback, error: feedbackError }, { data: sessions, error: sessionError }] = await Promise.all([
    db.from("forecast_feedback_contexts").select("call_id").eq("user_id", user.id).eq("feedback_kind", "call_check").in("call_id", callIds),
    db.from("sessions").select("call_id").eq("user_id", user.id).in("call_id", callIds),
  ]);
  if (feedbackError || sessionError) return NextResponse.json({ success: false, error: "Failed to load pending call" }, { status: 500 });

  const answered = new Set((feedback ?? []).map((row: { call_id: string }) => row.call_id));
  const logged = new Set((sessions ?? []).map((row: { call_id: string }) => row.call_id));
  const call = calls.find((candidate: ShownCall) => !answered.has(candidate.callId) && !logged.has(candidate.callId));
  if (!call) return NextResponse.json({ success: true, data: { call: null } });

  if (call.boardId && !call.isAnyBoard) {
    const { data: board, error: boardError } = await db
      .from("boards")
      .select("id,name,board_type")
      .eq("id", call.boardId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (boardError) return NextResponse.json({ success: false, error: "Failed to load pending call" }, { status: 500 });
    call.boardName = board?.name ?? null;
    call.boardType = board?.board_type ?? null;
  }

  const { shownAt: _, ...responseCall } = call;
  return NextResponse.json({ success: true, data: { call: responseCall } });
}

export const GET = withNoStore(
  withRateLimit(withAuth(pendingCallHandler, { errorMessage: "Failed to load pending call" }), "authenticated-default"),
);
