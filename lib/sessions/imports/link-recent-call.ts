import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { metadataCall } from "@/lib/recommendations/shown-call";

type LinkInput = { userId: string; sessionId: string; beachId: string; arrivalTime: string };

export async function linkRecentCall(service: SupabaseClient, input: LinkInput): Promise<string | null> {
  try {
    const arrivalMs = Date.parse(input.arrivalTime);
    if (!Number.isFinite(arrivalMs)) return null;

    const { data: events, error } = await service.from("user_events")
      .select("metadata, beach_id, created_at")
      .eq("user_id", input.userId)
      .eq("beach_id", input.beachId)
      .eq("event_type", "board_pick_exposed")
      .gte("created_at", new Date(arrivalMs - 36 * 60 * 60 * 1000).toISOString())
      .lte("created_at", input.arrivalTime)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;

    const candidates: Array<{ callId: string; distanceMs: number }> = [];
    for (const event of events ?? []) {
      const metadata = event.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
      const call = metadataCall(event);
      if (!call) continue;
      const distanceMs = Math.abs(Date.parse(call.forecastAt) - arrivalMs);
      if (distanceMs > 3 * 60 * 60 * 1000) continue;
      candidates.push({ callId: call.callId, distanceMs });
    }
    if (!candidates.length) return null;

    const { data: linkedSessions, error: linkedError } = await service.from("sessions")
      .select("call_id").eq("user_id", input.userId).neq("id", input.sessionId)
      .in("call_id", [...new Set(candidates.map(candidate => candidate.callId))]);
    if (linkedError) throw linkedError;
    const linkedCalls = new Set((linkedSessions ?? []).map(session => session.call_id));
    const candidate = candidates.sort((a, b) => a.distanceMs - b.distanceMs)
      .find(call => !linkedCalls.has(call.callId));
    if (!candidate) return null;

    const { data: updated, error: updateError } = await service.from("sessions")
      .update({ call_id: candidate.callId }).eq("id", input.sessionId).eq("user_id", input.userId)
      .is("deleted_at", null).is("call_id", null).select("call_id").maybeSingle();
    if (updateError) throw updateError;
    return updated?.call_id ?? null;
  } catch (error) {
    console.warn("[session_import] failed to link recent call:", error);
    return null;
  }
}
