"use client";
import type { RoadmapCategory, RoadmapItem } from "@/lib/roadmap/types";
import { RoadmapStatusChip } from "./RoadmapStatusChip";
import { VoteButton } from "./VoteButton";

interface Props {
  item: RoadmapItem;
  authed: boolean;
  onSignInRequired?: () => void;
  rank?: number;
}

const CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  forecasts: "// FORECASTS",
  logging: "// LOGGING",
  community: "// COMMUNITY",
  notifications: "// NOTIFICATIONS",
  subscription: "// SUBSCRIPTION",
  other: "// OTHER",
};

function CategoryEyebrow({ category }: { category: RoadmapCategory }) {
  return (
    <div className="mb-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#F78E42]/70">
      {CATEGORY_LABELS[category]}
    </div>
  );
}

function formatShippedDate(shippedAt: string | null): string {
  if (!shippedAt) return "";
  return new Date(shippedAt)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function FounderReply({ text }: { text: string }) {
  return (
    <div className="relative mt-4 rotate-[-1deg] rounded-[8px_14px_6px_12px] border border-[#FDB84B]/40 bg-[#252D6B] p-4 shadow-[0_3px_0_rgba(0,0,0,0.35)]">
      <div className="mb-2 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[#FDB84B]">
        {"// Quiver HQ / Steven"}
      </div>
      <p className="text-sm text-white/90">{text}</p>
    </div>
  );
}

export function RoadmapItemCard({ item, authed, onSignInRequired, rank }: Props) {
  // Shipped → dense changelog row (not a full card). Category label omitted by design.
  if (item.status === "shipped") {
    return (
      <article
        id={`item-${item.id}`}
        className="flex items-start gap-3 border-b border-[#2D357D]/30 py-2.5"
      >
        <time className="w-16 shrink-0 pt-0.5 font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-white/50">
          {formatShippedDate(item.shipped_at)}
        </time>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
          <p className="text-xs text-white/60">{item.description}</p>
          {item.founder_reply && <FounderReply text={item.founder_reply} />}
        </div>
        <RoadmapStatusChip status="shipped" />
      </article>
    );
  }

  // In progress → hero sticker card
  if (item.status === "in_progress") {
    return (
      <article
        id={`item-${item.id}`}
        className="relative rounded-[16px_6px_18px_6px] border-2 border-[#F78E42] bg-[#252D6B] p-5 shadow-[0_3px_0_rgba(0,0,0,0.3)]"
      >
        <span className="absolute -left-2 -top-2 rotate-[-2deg] bg-[#F78E42] px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#252D6B] shadow-[0_2px_0_rgba(0,0,0,0.3)]">
          Building now
        </span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CategoryEyebrow category={item.category} />
            <h3 className="font-[var(--font-heading)] text-lg font-bold text-white">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-white/80">{item.description}</p>
            {item.eta_label && (
              <p className="mt-2 font-[var(--font-mono)] text-xs uppercase tracking-wide text-[#F78E42]">
                ETA: {item.eta_label}
              </p>
            )}
            {item.founder_reply && <FounderReply text={item.founder_reply} />}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <VoteButton
              itemId={item.id}
              voteCount={item.vote_count}
              viewerHasVoted={item.viewer_has_voted}
              authed={authed}
              onSignInRequired={onSignInRequired}
            />
          </div>
        </div>
      </article>
    );
  }

  // Declined → standard card, no vote button
  if (item.status === "declined") {
    return (
      <article
        id={`item-${item.id}`}
        className="rounded-[12px_4px_14px_4px] border border-[#2D357D]/60 bg-[#1E2558]/60 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CategoryEyebrow category={item.category} />
            <h3 className="text-base font-semibold text-white">{item.title}</h3>
            <p className="mt-1 text-sm text-white/70">{item.description}</p>
            {item.founder_reply && <FounderReply text={item.founder_reply} />}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <RoadmapStatusChip status={item.status} />
          </div>
        </div>
      </article>
    );
  }

  // under_consideration → standard card with vote button + optional rank
  return (
    <article
      id={`item-${item.id}`}
      className="relative rounded-[12px_4px_14px_4px] border border-[#2D357D]/60 bg-[#1E2558]/60 p-4"
    >
      {rank && rank <= 3 && (
        <span className="absolute -right-2 -top-2 rotate-[2deg] rounded-[6px_2px_8px_2px] border border-[#F78E42]/50 bg-[#252D6B] px-2 py-0.5 font-[var(--font-mono)] text-[11px] font-bold tracking-wider text-[#F78E42] shadow-[0_2px_0_rgba(0,0,0,0.4)]">
          #0{rank}
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CategoryEyebrow category={item.category} />
          <h3 className="text-base font-semibold text-white">{item.title}</h3>
          <p className="mt-1 text-sm text-white/70">{item.description}</p>
          {item.eta_label && (
            <p className="mt-2 font-[var(--font-mono)] text-xs uppercase tracking-wide text-[#F78E42]">
              ETA: {item.eta_label}
            </p>
          )}
          {item.founder_reply && <FounderReply text={item.founder_reply} />}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <RoadmapStatusChip status={item.status} />
          <VoteButton
            itemId={item.id}
            voteCount={item.vote_count}
            viewerHasVoted={item.viewer_has_voted}
            authed={authed}
            onSignInRequired={onSignInRequired}
          />
        </div>
      </div>
    </article>
  );
}
