import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";
import { RoadmapClientControls } from "@/components/roadmap/RoadmapClientControls";
import { RoadmapFeaturedCard } from "@/components/roadmap/RoadmapFeaturedCard";

export const dynamic = "force-dynamic";

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

function RoadmapDivider({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      className="my-2 flex items-center gap-2 overflow-hidden font-[var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-white/20"
    >
      <span className="shrink-0 text-[#F78E42]/40">//</span>
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 bg-[#2D357D]/40" />
      <span className="shrink-0 text-[#F78E42]/40">//</span>
    </div>
  );
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
  const totalVotes = items.reduce((sum, i) => sum + i.vote_count, 0);
  const nowLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const featured =
    grouped.in_progress[0] ?? grouped.under_consideration[0] ?? null;

  const inProgressList =
    featured && featured.status === "in_progress"
      ? grouped.in_progress.slice(1)
      : grouped.in_progress;
  const underConsiderationList =
    featured && featured.status === "under_consideration"
      ? grouped.under_consideration.slice(1)
      : grouped.under_consideration;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <header className="relative mb-12 overflow-hidden border-b-2 border-[#2D357D]/50 pb-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-32 w-48 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, #F78E42 1px, transparent 1.5px)",
            backgroundSize: "8px 8px",
            maskImage: "linear-gradient(225deg, black 0%, transparent 70%)",
            WebkitMaskImage: "linear-gradient(225deg, black 0%, transparent 70%)",
          }}
        />

        <div className="scan-lines relative">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[#F78E42]">
                // Quiver roadmap // {nowLabel}
              </div>
              <h1 className="font-[var(--font-heading)] text-[clamp(3rem,10vw,6.5rem)] font-bold leading-[0.9] tracking-tight text-white">
                WHAT&apos;S
                <br />
                <span className="text-[#F78E42]">NEXT.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-white/70">
                Building in the open. Vote on what ships next — or drop a request if you&apos;ve got one we haven&apos;t thought of.
              </p>
            </div>
            <RoadmapClientControls authed={authed} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-white/60">
            <span>{items.length} ideas</span>
            <span className="text-white/30">/</span>
            <span>{grouped.shipped.length} shipped</span>
            <span className="text-white/30">/</span>
            <span>{grouped.in_progress.length} building now</span>
            <span className="text-white/30">/</span>
            <span>{totalVotes} votes cast</span>
          </div>
        </div>
      </header>

      {featured && (
        <>
          <RoadmapFeaturedCard item={featured} authed={authed} />
          <RoadmapDivider label="PIPELINE" />
        </>
      )}

      <RoadmapSection
        title="Building Now"
        status="in_progress"
        items={inProgressList}
        authed={authed}
      />
      <RoadmapDivider label="WHAT'S NEXT" />
      <RoadmapSection
        title="Under Consideration"
        status="under_consideration"
        items={underConsiderationList}
        authed={authed}
      />
      <RoadmapDivider label="ALREADY OUT" />
      <RoadmapSection
        title="Shipped"
        status="shipped"
        items={grouped.shipped}
        authed={authed}
      />
      {grouped.declined.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer font-[var(--font-mono)] text-xs uppercase tracking-widest text-white/50 hover:text-white/80">
            {grouped.declined.length} passed — see why
          </summary>
          <div className="mt-4">
            <RoadmapDivider label="PASSED ON" />
            <RoadmapSection
              title="Passed"
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
