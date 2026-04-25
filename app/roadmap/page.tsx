import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";
import { RoadmapSection } from "@/components/roadmap/RoadmapSection";
import { RoadmapClientControls } from "@/components/roadmap/RoadmapClientControls";
import { RoadmapFeaturedCard } from "@/components/roadmap/RoadmapFeaturedCard";
import { RoadmapHeroVideo } from "@/components/roadmap/RoadmapHeroVideo";

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
    <main>
      {/* Full-bleed, full-viewport hero. Breaks out of the max-w-3xl content
          column below so the diorama gets edge-to-edge and a real cinematic
          height. Uses 100svh so mobile browser chrome doesn't crop the bottom. */}
      <header className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-[#1A1F4A]">
        {/* Rotating diorama backdrop — 4 videos, 7s each, 600ms crossfade.
            startIndex is picked here on the server so SSR + client hydrate
            agree (Math.random in useState would mismatch). */}
        <div aria-hidden="true" className="absolute inset-0">
          <RoadmapHeroVideo startIndex={Math.floor(Math.random() * 4)} />
        </div>

        {/* Layered overlays for legibility:
            1. Bottom-up twilight wash so the headline + stats sit in solid color
            2. Soft radial vignette pulling focus toward the lower-left content
            3. Top dark band so the global nav reads against the video */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1F4A] via-[#1A1F4A]/70 via-35% to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_75%,rgba(37,45,107,0)_0%,rgba(26,31,74,0.55)_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#1A1F4A]/80 to-transparent"
        />

        {/* Sticker-style dot pattern, top-right corner */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 z-10 h-40 w-64 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, #F78E42 1px, transparent 1.5px)",
            backgroundSize: "8px 8px",
            maskImage: "linear-gradient(225deg, black 0%, transparent 70%)",
            WebkitMaskImage: "linear-gradient(225deg, black 0%, transparent 70%)",
          }}
        />

        {/* Content sits in a centered column, anchored to the bottom of the hero */}
        <div className="scan-lines relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-16 md:px-10 md:pb-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[#F78E42] [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
                // Quiver roadmap // {nowLabel}
              </div>
              <h1 className="font-[var(--font-heading)] text-[clamp(3.5rem,12vw,9rem)] font-bold leading-[0.88] tracking-tight text-white [text-shadow:_0_2px_12px_rgba(0,0,0,0.55)]">
                WHAT&apos;S
                <br />
                <span className="text-[#F78E42]">NEXT.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base text-white/85 [text-shadow:_0_1px_4px_rgba(0,0,0,0.6)] md:text-lg">
                Building in the open. Vote on what ships next — or drop a request if you&apos;ve got one we haven&apos;t thought of.
              </p>
            </div>
            <RoadmapClientControls authed={authed} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-[var(--font-mono)] text-[11px] uppercase tracking-widest text-white/70 [text-shadow:_0_1px_2px_rgba(0,0,0,0.6)]">
            <span>{items.length} ideas</span>
            <span className="text-white/40">/</span>
            <span>{grouped.shipped.length} shipped</span>
            <span className="text-white/40">/</span>
            <span>{grouped.in_progress.length} building now</span>
            <span className="text-white/40">/</span>
            <span>{totalVotes} votes cast</span>
          </div>
        </div>

        {/* Scroll affordance — a hint that there's content below the fold */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.4em] text-white/40"
        >
          scroll ↓
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12">
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
      </div>
    </main>
  );
}
