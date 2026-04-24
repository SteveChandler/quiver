import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";
import { RoadmapClientControls } from "@/components/roadmap/RoadmapClientControls";

export const revalidate = 60;

async function fetchItems(viewerUserId: string | null): Promise<RoadmapItem[]> {
  const service = createSupabaseServiceRoleClient();
  const { data } = await service
    .from("roadmap_items_with_vote_count")
    .select("*")
    .order("vote_count", { ascending: false })
    .order("shipped_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  let votedSet = new Set<string>();
  if (viewerUserId) {
    const { data: votes } = await service
      .from("roadmap_votes")
      .select("item_id")
      .eq("user_id", viewerUserId);
    votedSet = new Set((votes ?? []).map((v) => v.item_id as string));
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    viewer_has_voted: votedSet.has(row.id),
  })) as RoadmapItem[];
}

function groupByStatus(items: RoadmapItem[]): Record<RoadmapStatus, RoadmapItem[]> {
  const groups: Record<RoadmapStatus, RoadmapItem[]> = {
    under_consideration: [],
    in_progress: [],
    shipped: [],
    declined: [],
  };
  for (const item of items) groups[item.status].push(item);
  return groups;
}

export default async function RoadmapPage() {
  let user: { id: string } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  } catch {
    user = null;
  }
  const authed = !!user;

  const items = await fetchItems(user?.id ?? null);
  const grouped = groupByStatus(items);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">Roadmap</h1>
            <p className="mt-2 text-slate-400">
              What we&apos;re building, what shipped, and what&apos;s up for vote. Suggest anything.
            </p>
          </div>
          <RoadmapClientControls authed={authed} />
        </div>
      </header>

      <RoadmapSection
        title="In Progress"
        status="in_progress"
        items={grouped.in_progress}
        authed={authed}
      />
      <RoadmapSection
        title="Under Consideration"
        status="under_consideration"
        items={grouped.under_consideration}
        authed={authed}
      />
      <RoadmapSection
        title="Shipped"
        status="shipped"
        items={grouped.shipped}
        authed={authed}
      />
      {grouped.declined.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-300">
            {grouped.declined.length} declined — see why
          </summary>
          <div className="mt-4">
            <RoadmapSection
              title="Declined"
              status="declined"
              items={grouped.declined}
              authed={authed}
            />
          </div>
        </details>
      )}
    </main>
  );
}
