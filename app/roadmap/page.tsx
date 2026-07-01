import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";
import { RoadmapClientControls } from "@/components/roadmap/RoadmapClientControls";
import { RoadmapFeaturedCard } from "@/components/roadmap/RoadmapFeaturedCard";
import { RoadmapHeroVideo } from "@/components/roadmap/RoadmapHeroVideo";
import { QuiverSticker, ZineSurface } from "@/components/zine";

export const dynamic = "force-dynamic";

async function fetchItems(viewerUserId: string | null): Promise<RoadmapItem[]> {
  // DEV-ONLY preview path: when NEXT_PUBLIC_ROADMAP_MOCK=1, return seeded mock
  // data so the page renders before migrations are applied to prod. Revert
  // before shipping — see DEV_ROADMAP_MOCK comment in .env.local.
  if (process.env.NEXT_PUBLIC_ROADMAP_MOCK === "1") {
    return getMockRoadmapItems();
  }

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

function getMockRoadmapItems(): RoadmapItem[] {
  const now = "2026-04-24T00:00:00Z";
  const mk = (
    id: string,
    title: string,
    description: string,
    category: RoadmapItem["category"],
    status: RoadmapItem["status"],
    vote_count: number,
    extras: Partial<RoadmapItem> = {},
  ): RoadmapItem => ({
    id,
    title,
    description,
    category,
    status,
    eta_label: null,
    founder_reply: null,
    shipped_at: null,
    created_at: now,
    updated_at: now,
    vote_count,
    viewer_has_voted: false,
    ...extras,
  });
  return [
    mk("ip-1", "More beaches with diorama videos", "Shipping ~10 new beach diorama videos per week. Veo's daily quota is the pacing limit, not the queue.", "forecasts", "in_progress", 34, { eta_label: "Rolling weekly" }),
    mk("ip-2", "Friends feed + invite deep links", "Segmented Friends / Nearby / Roadmap feed, working invite share-links, and the follow-you notifications surface.", "community", "in_progress", 22, { eta_label: "This month" }),
    mk("uc-1", "Auto-log sessions from your watch", "Wave count, paddle distance, ride distance from the wrist. HealthKit's Surfing workout is the fast path; full IMU wave detection is the ambitious version.", "logging", "under_consideration", 47, { founder_reply: "Strong interest here. Evaluating HealthKit vs a custom workout as the v1 path — HealthKit ships faster but IMU unlocks the wave-count dream. Will post when we lock the scope." }),
    mk("uc-2", "Apple Watch forecast glance", "Quick-check your favorite beaches from the wrist — complications, today's call, tide curve. No session tracking in v1.", "forecasts", "under_consideration", 31),
    mk("uc-3", "Restore deleted sessions", "Undo an accidental delete. Sessions are already soft-deleted server-side; this exposes the button and a recent-deletions view.", "logging", "under_consideration", 18),
    mk("uc-4", "Offline session save", "Log a session on spotty LTE and have it sync when you're back in range. No lost sessions.", "logging", "under_consideration", 14),
    mk("uc-5", "In-app explainers (period, tide, wind)", "Tap any stat on a forecast for a plain-English explanation. Built for first-day beginners who haven't learned to read a swell map yet.", "forecasts", "under_consideration", 9),
    mk("uc-6", "Discipline-aware match scoring", "Longboarders score well on small long-period days; foilers on bumpy light-wind days. Your discipline should shape your match, not just your skill.", "forecasts", "under_consideration", 7),
    mk("uc-7", "International buoy coverage", "Close the Australia / UK / East Coast US buoy gaps so forecasts work outside the Pacific.", "forecasts", "under_consideration", 5),
    mk("uc-8", "Crew group chat", "A small space to coordinate with the 3-5 people you actually surf with. Not a public forum — just your people.", "community", "under_consideration", 3),
    mk("sh-1", "Custom user-created spots", "Long-press the map or use the Add Spot button to save any break — secret reef, local wedge, anywhere.", "logging", "shipped", 0, { shipped_at: "2026-04-24T00:00:00Z" }),
    mk("sh-2", "Map-center placement mode", "Drag the map to position the pin exactly where you want it.", "logging", "shipped", 0, { shipped_at: "2026-04-24T00:00:00Z" }),
    mk("sh-3", "Pre-sunset hero dead zone fix", "The home hero no longer goes blank in the window before sunset on the same day.", "forecasts", "shipped", 0, { shipped_at: "2026-04-23T00:00:00Z" }),
    mk("sh-4", "Similarity redesign", "Match scoring now finds your sweet spot AND penalizes the conditions you actively avoid, not just a single weighted average.", "forecasts", "shipped", 0, { shipped_at: "2026-04-21T00:00:00Z" }),
    mk("sh-5", "ml_skipped signal in forecasts", "Per-row flag tells you whether a forecast value came from the ML model or the physical taper.", "forecasts", "shipped", 0, { shipped_at: "2026-04-20T00:00:00Z" }),
    mk("sh-6", "Post-signup activation fixes", "Confirmation email + callback flow now work reliably.", "other", "shipped", 0, { shipped_at: "2026-04-19T00:00:00Z" }),
    mk("sh-7", "Native home hero discovery gate", "Home screen loader waits for discovery resolution before picking a hero.", "forecasts", "shipped", 0, { shipped_at: "2026-04-17T00:00:00Z" }),
    mk("sh-8", "Regime-aware model training", "Training now weights conditions by regime (swell vs. windswell vs. mix).", "forecasts", "shipped", 0, { shipped_at: "2026-04-15T00:00:00Z" }),
  ];
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
      className="my-8 flex items-center gap-2 overflow-hidden font-[var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-[#11100D]/45"
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
            <p className="mb-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[#B56A2B]">
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
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-[#11100D]/65">
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
              <h2 className="font-[var(--font-zine-display)] text-3xl font-black uppercase leading-none text-[#11100D] sm:text-4xl">
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
              <summary className="cursor-pointer font-[var(--font-mono)] text-xs uppercase tracking-widest text-[#11100D]/55 hover:text-[#11100D]">
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
