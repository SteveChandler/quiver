import { NextResponse, type NextRequest } from "next/server";
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
import { capturePostHogEvent } from "@/lib/posthog-server";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";

export const dynamic = "force-dynamic";

export const POST = withAuth(
  async (_req: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const id = params.id as string;

    // Check existing vote
    const { data: existing } = await supabase
      .from("roadmap_votes")
      .select("item_id")
      .eq("item_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("roadmap_votes")
        .delete()
        .eq("item_id", id)
        .eq("user_id", user.id);
      if (error) {
        console.error("[roadmap] vote delete error:", error);
        return NextResponse.json({ error: "Could not record vote" }, { status: 500 });
      }
      return NextResponse.json({ voted: false });
    }

    const { error } = await supabase
      .from("roadmap_votes")
      .insert({ item_id: id, user_id: user.id });
    if (error) {
      // 23505 = unique_violation. Double-tap races land a duplicate insert
      // attempt; treat as idempotent "already voted".
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ voted: true });
      }
      console.error("[roadmap] vote insert error:", error);
      return NextResponse.json({ error: "Could not record vote" }, { status: 500 });
    }

    const { data: item } = await supabase
      .from("roadmap_items_with_vote_count")
      .select("title,description")
      .eq("id", id)
      .maybeSingle();
    const itemText = `${item?.title ?? ""} ${item?.description ?? ""}`.toLowerCase();
    const isCustomSpotRequest = itemText.includes("custom spot");
    const { error: eventError } = await supabase.from("user_events").insert({
      user_id: user.id,
      event_type: "feedback_roadmap_vote_submitted",
      metadata: {
        source: "web_roadmap",
        roadmap_item_id: id,
        roadmap_item_title: item?.title ?? null,
        vote_state: "cast",
        is_custom_spot_request: isCustomSpotRequest,
      },
    });
    if (eventError) {
      console.warn("[roadmap] vote analytics insert error:", eventError);
    }
    const telemetryAllowed = await getOwnAnalyticsTrackingAllowed(
      supabase,
      user.id,
    ).catch(() => false);
    if (telemetryAllowed) {
      await capturePostHogEvent({
        distinctId: user.id,
        event: "feedback_roadmap_vote_submitted",
        properties: {
          source: "web_roadmap",
          roadmap_item_id: id,
          roadmap_item_title: item?.title ?? null,
          vote_state: "cast",
          is_custom_spot_request: isCustomSpotRequest,
        },
      });
    }

    if (isCustomSpotRequest) {
      const { error: customSpotEventError } = await supabase.from("user_events").insert({
        user_id: user.id,
        event_type: "custom_spots_feedback_voted",
        metadata: {
          source: "web_roadmap",
          roadmap_item_id: id,
          roadmap_item_title: item?.title ?? null,
        },
      });
      if (customSpotEventError) {
        console.warn("[roadmap] custom spot vote analytics insert error:", customSpotEventError);
      }
      if (telemetryAllowed) {
        await capturePostHogEvent({
          distinctId: user.id,
          event: "custom_spots_feedback_voted",
          properties: {
            source: "web_roadmap",
            roadmap_item_id: id,
            roadmap_item_title: item?.title ?? null,
          },
        });
      }
    }

    return NextResponse.json({ voted: true });
  },
);
