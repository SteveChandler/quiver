import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
      .order("created_at", { ascending: false });
    if (error) throw error;

    for (const event of events ?? []) {
      const metadata = event.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
      if (metadata.is_personal !== true) continue;
      const callId = typeof metadata.call_id === "string" ? metadata.call_id : null;
      const forecastAt = typeof metadata.forecast_at === "string" ? metadata.forecast_at
        : typeof metadata.selected_forecast_at === "string" ? metadata.selected_forecast_at : null;
      if (!callId || !forecastAt || !Number.isFinite(Date.parse(forecastAt))) continue;
      if (Math.abs(Date.parse(forecastAt) - arrivalMs) > 3 * 60 * 60 * 1000) continue;

      const { data: updated, error: updateError } = await service.from("sessions")
        .update({ call_id: callId }).eq("id", input.sessionId).eq("user_id", input.userId)
        .is("deleted_at", null).is("call_id", null).select("call_id").maybeSingle();
      if (updateError) throw updateError;
      return updated?.call_id ?? null;
    }
    return null;
  } catch (error) {
    console.warn("[session_import] failed to link recent call:", error);
    return null;
  }
}
