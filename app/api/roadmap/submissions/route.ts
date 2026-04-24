import type { NextRequest } from "next/server";
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";
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

export const POST = withAuth(
  async (req: NextRequest, { user, supabase }: AuthenticatedContext) => {
    let body: { title?: string; description?: string; category?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const title = body.title?.trim();
    const description = body.description?.trim();
    const category = body.category;

    if (!title || title.length < 1 || title.length > 60) {
      return Response.json({ error: "Title must be 1–60 characters" }, { status: 400 });
    }
    if (!description || description.length < 1 || description.length > 500) {
      return Response.json({ error: "Description must be 1–500 characters" }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category as RoadmapCategory)) {
      return Response.json({ error: "Invalid category" }, { status: 400 });
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
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id: data.id, decision: "pending" });
  },
);
