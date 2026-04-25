import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return Response.json({ matches: [] });
  }

  // Escape LIKE wildcards so user-typed %, _, \ don't behave as wildcards.
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);

  const service = createSupabaseServiceRoleClient();
  const { data, error } = await service
    .from("roadmap_items_with_vote_count")
    .select("id,title,status,vote_count")
    .in("status", ["under_consideration", "in_progress"])
    .ilike("title", `%${escaped}%`)
    .order("vote_count", { ascending: false })
    .limit(3);

  if (error) {
    console.error("[roadmap] duplicate-search query error:", error);
    return Response.json({ error: "Could not search roadmap items" }, { status: 500 });
  }

  return Response.json({ matches: data ?? [] });
}
