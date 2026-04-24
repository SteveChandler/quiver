"use client";
import type { RoadmapItem } from "@/lib/roadmap/types";
import { RoadmapStatusChip } from "./RoadmapStatusChip";
import { VoteButton } from "./VoteButton";

interface Props {
  item: RoadmapItem;
  authed: boolean;
  onSignInRequired?: () => void;
}

export function RoadmapItemCard({ item, authed, onSignInRequired }: Props) {
  return (
    <article
      id={`item-${item.id}`}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{item.description}</p>
          {item.eta_label && (
            <p className="mt-2 text-xs uppercase tracking-wide text-orange-400">
              ETA: {item.eta_label}
            </p>
          )}
          {item.founder_reply && (
            <div className="mt-3 rounded border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">
              <span className="mr-2 font-semibold text-slate-100">Steven</span>
              {item.founder_reply}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <RoadmapStatusChip status={item.status} />
          {item.status !== "shipped" && item.status !== "declined" && (
            <VoteButton
              itemId={item.id}
              voteCount={item.vote_count}
              viewerHasVoted={item.viewer_has_voted}
              authed={authed}
              onSignInRequired={onSignInRequired}
            />
          )}
        </div>
      </div>
    </article>
  );
}
