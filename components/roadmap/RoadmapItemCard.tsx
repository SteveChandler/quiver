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
    <div className="mb-2 font-[var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-[#B56A2B]">
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
    <div className="notebook relative mt-4 rotate-[-1deg] border-2 border-[#11100D] bg-[#F0E5CC] p-4 shadow-[2px_3px_0_rgba(17,16,13,0.22)]">
      <div className="mb-2 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[#B56A2B]">
        {"// Quiver HQ / Steven"}
      </div>
      <p className="text-sm leading-relaxed text-[#11100D]/76">{text}</p>
    </div>
  );
}

export function RoadmapItemCard({ item, authed, onSignInRequired, rank }: Props) {
  // Shipped → dense changelog row (not a full card). Category label omitted by design.
  if (item.status === "shipped") {
    return (
      <article
        id={`item-${item.id}`}
        className="flex items-start gap-3 border-b border-dashed border-[#11100D]/25 py-3"
      >
        <time className="w-16 shrink-0 pt-0.5 font-[var(--font-mono)] text-[11px] uppercase tracking-wider text-[#11100D]/65">
          {formatShippedDate(item.shipped_at)}
        </time>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#11100D]">{item.title}</h3>
          <p className="text-xs leading-relaxed text-[#11100D]/62">{item.description}</p>
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
        className="torn torn-tb relative rounded-[16px_6px_18px_6px] border-2 border-[#11100D] bg-[#FBF6E8] p-5 shadow-[2px_3px_0_rgba(17,16,13,0.24)]"
      >
        <span className="absolute -left-2 -top-2 rotate-[-2deg] border-2 border-[#11100D] bg-[#F78E42] px-2 py-0.5 font-[var(--font-mono)] text-[10px] font-bold uppercase tracking-widest text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.24)]">
          Building now
        </span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CategoryEyebrow category={item.category} />
            <h3 className="font-[var(--font-zine-display)] text-lg font-black uppercase leading-tight text-[#11100D]">
              {item.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[#11100D]/74">{item.description}</p>
            {item.eta_label && (
              <p className="mt-2 font-[var(--font-mono)] text-xs uppercase tracking-wide text-[#B56A2B]">
                ETA: {item.eta_label}
              </p>
            )}
            {item.founder_reply && <FounderReply text={item.founder_reply} />}
          </div>
          <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:items-end">
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
        className="rounded-[12px_4px_14px_4px] border-2 border-[#11100D]/45 bg-[#F0E5CC] p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CategoryEyebrow category={item.category} />
            <h3 className="text-base font-bold text-[#11100D]">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#11100D]/70">{item.description}</p>
            {item.founder_reply && <FounderReply text={item.founder_reply} />}
          </div>
          <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:items-end">
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
      className="relative rounded-[12px_4px_14px_4px] border-2 border-[#11100D]/45 bg-[#FBF6E8] p-4 shadow-[2px_3px_0_rgba(17,16,13,0.12)]"
    >
      {rank && rank <= 3 && (
        <span className="absolute -right-2 -top-2 rotate-[2deg] rounded-[6px_2px_8px_2px] border-2 border-[#11100D] bg-[#F78E42] px-2 py-0.5 font-[var(--font-mono)] text-[11px] font-bold tracking-wider text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.26)]">
          #0{rank}
        </span>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <CategoryEyebrow category={item.category} />
          <h3 className="text-base font-bold text-[#11100D]">{item.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#11100D]/70">{item.description}</p>
          {item.eta_label && (
            <p className="mt-2 font-[var(--font-mono)] text-xs uppercase tracking-wide text-[#B56A2B]">
              ETA: {item.eta_label}
            </p>
          )}
          {item.founder_reply && <FounderReply text={item.founder_reply} />}
        </div>
        <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:items-end">
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
