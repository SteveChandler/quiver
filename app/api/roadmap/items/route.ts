import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RoadmapItem, RoadmapItemsResponse, RoadmapStatus } from "@/lib/roadmap/types";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES: readonly RoadmapStatus[] = [
  "under_consideration",
  "in_progress",
  "shipped",
  "declined",
];

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");

  const service = createSupabaseServiceRoleClient();
  let query = service
    .from("roadmap_items_with_vote_count")
    .select(
      "id, title, description, category, status, eta_label, founder_reply, shipped_at, created_at, updated_at, vote_count"
    )
    .order("vote_count", { ascending: false })
    .order("shipped_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (statusFilter && ALLOWED_STATUSES.includes(statusFilter as RoadmapStatus)) {
    query = query.eq("status", statusFilter as RoadmapStatus);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[roadmap] items query error:", error);
    return Response.json({ error: "Could not load roadmap items" }, { status: 500 });
  }

  let user: { id: string } | null = null;
  try {
    const authed = await createAPIServerClient();
    const {
      data: { user: resolved },
    } = await authed.auth.getUser();
    user = resolved ?? null;
  } catch {
    // Fall through as anon — optional auth, per spec.
    user = null;
  }

  let votedSet = new Set<string>();
  if (user) {
    const { data: votes } = await service
      .from("roadmap_votes")
      .select("item_id")
      .eq("user_id", user.id);
    votedSet = new Set((votes ?? []).map((v) => v.item_id as string));
  }

  const items: RoadmapItem[] = (data ?? []).map((row: any) => ({
    ...row,
    vote_count: row.vote_count as number,
    viewer_has_voted: votedSet.has(row.id as string),
  })) as RoadmapItem[];

  const response: RoadmapItemsResponse = { items };
  return Response.json(response);
}
