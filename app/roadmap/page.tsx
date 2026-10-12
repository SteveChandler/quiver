import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";
import { RoadmapClientControls } from "@/components/roadmap/RoadmapClientControls";
import { RoadmapFeaturedCard } from "@/components/roadmap/RoadmapFeaturedCard";
import { RoadmapHeroVideo } from "@/components/roadmap/RoadmapHeroVideo";
import { QuiverSticker, ZineSurface } from "@/components/zine";

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
      className="my-8 flex items-center gap-2 overflow-hidden font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-[#11100D]/45"
    >
      <span className="shrink-0 text-[#F78E42]">{"//"}</span>
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 border-t-2 border-dashed border-[#11100D]/25" />
      <span className="shrink-0 text-[#F78E42]">{"//"}</span>
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
    <ZineSurface
      sectionLabel="Roadmap"
      editionLabel="Vote what ships next"
      data-testid="roadmap-zine-surface"
      paperClassName="overflow-hidden"
    >
      <main>
        <header className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-8 right-4 hidden w-36 rotate-6 opacity-85 sm:block"
            />
            <p className="label-black mb-5">Public roadmap</p>
            <p className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[#B56A2B]">
              {`// Quiver roadmap // ${nowLabel}`}
            </p>
            <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              What&apos;s
              <br />
              next.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Building in the open. Vote on what ships next, or drop a request
              if you&apos;ve got one we haven&apos;t thought of.
            </p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>{items.length} ideas</span>
              <span aria-hidden>/</span>
              <span>{grouped.shipped.length} shipped</span>
              <span aria-hidden>/</span>
              <span>{grouped.in_progress.length} building now</span>
              <span aria-hidden>/</span>
              <span>{totalVotes} votes cast</span>
            </div>
            <div className="mt-8">
              <RoadmapClientControls authed={authed} />
            </div>
          </div>

          <div className="relative">
            <QuiverSticker
              sticker="creamCoastMap"
              className="absolute -right-5 -top-7 z-10 hidden w-28 rotate-6 drop-shadow-md md:block"
            />
            <div className="polaroid rot-2">
              <div className="photo" style={{ aspectRatio: "16 / 10" }}>
                <RoadmapHeroVideo startIndex={Math.floor(Math.random() * 4)} />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[#F4EBD8]/10 mix-blend-screen"
                />
              </div>
              <p className="cap">field notes from the build queue</p>
            </div>
          </div>
        </header>

        <section className="torn torn-tb rot-neg mt-12 border-2 border-[#11100D] bg-[#F0E5CC]">
          <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="typewriter mb-2">How this works</p>
              <h2 className="font-[family-name:var(--font-zine-display)] text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
                The surf app gets shaped in public.
              </h2>
            </div>
            <p className="text-base leading-relaxed text-[#11100D]/74 sm:text-lg">
              Vote for the ideas you want next. If something is missing, send a
              request and we&apos;ll review it against the same queue.
            </p>
          </div>
        </section>

        <div className="mt-12">
          {featured && (
            <>
              <RoadmapFeaturedCard item={featured} authed={authed} />
              <RoadmapDivider label="Pipeline" />
            </>
          )}

          <RoadmapSection
            title="Building Now"
            status="in_progress"
            items={inProgressList}
            authed={authed}
          />
          <RoadmapDivider label="What's next" />
          <RoadmapSection
            title="Under Consideration"
            status="under_consideration"
            items={underConsiderationList}
            authed={authed}
          />
          <RoadmapDivider label="Already out" />
          <RoadmapSection
            title="Shipped"
            status="shipped"
            items={grouped.shipped}
            authed={authed}
          />
          {grouped.declined.length > 0 && (
            <details className="mt-10">
              <summary className="cursor-pointer font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[#11100D]/55 hover:text-[#11100D]">
                {grouped.declined.length} passed, see why
              </summary>
              <div className="mt-4">
                <RoadmapDivider label="Passed on" />
                <RoadmapSection
                  title="Passed"
                  status="declined"
                  items={grouped.declined}
                  authed={authed}
                />
              </div>
            </details>
          )}
        </div>
      </main>
    </ZineSurface>
  );
}
