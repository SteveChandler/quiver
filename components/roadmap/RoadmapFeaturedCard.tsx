"use client";
import type { RoadmapCategory, RoadmapItem } from "@/lib/roadmap/types";
import { RoadmapStatusChip } from "./RoadmapStatusChip";
import { VoteButton } from "./VoteButton";

const CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  forecasts: "FORECASTS",
  logging: "LOGGING",
  community: "COMMUNITY",
  notifications: "NOTIFICATIONS",
  subscription: "SUBSCRIPTION",
  other: "OTHER",
};

interface Props {
  item: RoadmapItem;
  authed: boolean;
  onSignInRequired?: () => void;
}

export function RoadmapFeaturedCard({ item, authed, onSignInRequired }: Props) {
  return (
    <article
      id={`item-${item.id}`}
      className="scan-lines relative mb-12 -rotate-[0.5deg] rounded-[20px_8px_22px_8px] border-2 border-[#F78E42] bg-gradient-to-br from-[#252D6B] to-[#1E2558] p-7 shadow-[0_4px_0_rgba(0,0,0,0.4)]"
    >
      <span className="absolute -left-3 -top-3 -rotate-[3deg] bg-[#FDB84B] px-3 py-1 font-[var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#252D6B] shadow-[0_2px_0_rgba(0,0,0,0.4)]">
        ★ Featured
      </span>

      <div className="mb-3 mt-2 font-[var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-[#F78E42]">
        {`// ${CATEGORY_LABELS[item.category] ?? "OTHER"}`}
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex-1">
          <h2 className="font-[var(--font-heading)] text-3xl font-bold leading-tight text-white md:text-4xl">
            {item.title}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/80">
            {item.description}
          </p>
          {item.eta_label && (
            <p className="mt-4 font-[var(--font-mono)] text-xs uppercase tracking-[0.25em] text-[#FDB84B]">
              ETA / {item.eta_label}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-row items-center gap-4 md:flex-col md:items-end">
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
