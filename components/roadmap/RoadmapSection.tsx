"use client";
import type { RoadmapItem, RoadmapStatus } from "@/lib/roadmap/types";
import { RoadmapItemCard } from "./RoadmapItemCard";

interface Props {
  title: string;
  status: RoadmapStatus;
  items: RoadmapItem[];
  authed: boolean;
  onSignInRequired?: () => void;
}

export function RoadmapSection({ title, status, items, authed, onSignInRequired }: Props) {
  return (
    <section className="mb-12">
      <div className="mb-5 flex items-baseline gap-3">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold uppercase tracking-tight text-white">
          {title}
        </h2>
        <span className="font-[var(--font-mono)] text-sm text-[#F78E42]">
          ({items.length})
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-[10px_4px_12px_4px] border border-dashed border-[#2D357D]/50 p-8 text-center">
          <div
            aria-hidden="true"
            className="mb-3 font-[var(--font-mono)] text-2xl tracking-[0.3em] text-white/20"
          >
            ~ ~ ~
          </div>
          <p className="font-[var(--font-mono)] text-sm uppercase tracking-wider text-white/40">
            // Nothing here yet.
          </p>
        </div>
      ) : (
        <div
          className={
            status === "shipped"
              ? "space-y-0 border-t border-[#2D357D]/30"
              : "space-y-3"
          }
        >
          {items.map((item, index) => (
            <RoadmapItemCard
              key={item.id}
              item={item}
              authed={authed}
              onSignInRequired={onSignInRequired}
              rank={status === "under_consideration" ? index + 1 : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
