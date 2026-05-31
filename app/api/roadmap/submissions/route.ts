import { NextResponse, type NextRequest } from "next/server";
import { withAuth, withRateLimit, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
import { capturePostHogEvent } from "@/lib/posthog-server";
import type { RoadmapCategory } from "@/lib/roadmap/types";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES: readonly RoadmapCategory[] = [
  "forecasts",
  "logging",
  "community",
  "notifications",
  "subscription",
  "other",
];

export const POST = withRateLimit(
  withAuth(
    async (req: NextRequest, { user, supabase }: AuthenticatedContext) => {
      let body: { title?: string; description?: string; category?: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const title = body.title?.trim();
      const description = body.description?.trim();
      const category = body.category;

      if (!title || title.length < 1 || title.length > 60) {
        return NextResponse.json({ error: "Title must be 1–60 characters" }, { status: 400 });
      }
      if (!description || description.length < 1 || description.length > 500) {
        return NextResponse.json({ error: "Description must be 1–500 characters" }, { status: 400 });
      }
      if (!category || !VALID_CATEGORIES.includes(category as RoadmapCategory)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("roadmap_item_submissions")
        .insert({
          title,
          description,
          category: category as RoadmapCategory,
          submitter_user_id: user.id,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[roadmap] submission insert error:", error);
        return NextResponse.json({ error: "Could not save submission" }, { status: 500 });
      }

      const isCustomSpotRequest = `${title} ${description}`.toLowerCase().includes("custom spot");
      const { error: eventError } = await supabase.from("user_events").insert({
        user_id: user.id,
        event_type: "feedback_roadmap_request_created",
        metadata: {
          source: "web_roadmap",
          roadmap_submission_id: data.id,
          category,
          is_custom_spot_request: isCustomSpotRequest,
        },
      });
      if (eventError) {
        console.warn("[roadmap] submission analytics insert error:", eventError);
      }
      await capturePostHogEvent({
        distinctId: user.id,
        event: "feedback_roadmap_request_created",
        properties: {
          source: "web_roadmap",
          roadmap_submission_id: data.id,
          category,
          is_custom_spot_request: isCustomSpotRequest,
        },
      });

      return NextResponse.json({ id: data.id, decision: "pending" });
    },
  ),
  { key: "authenticated-default" },
);
