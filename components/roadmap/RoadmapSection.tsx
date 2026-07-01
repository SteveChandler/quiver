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
      <div className="mb-5 flex items-baseline gap-3 border-b-2 border-dashed border-[#11100D]/30 pb-3">
        <h2 className="font-[var(--font-zine-display)] text-2xl font-black uppercase tracking-normal text-[#11100D]">
          {title}
        </h2>
        <span className="font-[var(--font-mono)] text-sm text-[#B56A2B]">
          ({items.length})
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-[10px_4px_12px_4px] border-2 border-dashed border-[#11100D]/35 bg-[#FBF6E8] p-8 text-center">
          <div
            aria-hidden="true"
            className="mb-3 font-[var(--font-mono)] text-2xl tracking-[0.3em] text-[#11100D]/25"
          >
            ~ ~ ~
          </div>
          <p className="font-[var(--font-mono)] text-sm uppercase tracking-wider text-[#11100D]/45">
            {"// Nothing here yet."}
          </p>
        </div>
      ) : (
        <div
          className={
            status === "shipped"
              ? "space-y-0 border-t border-dashed border-[#11100D]/25"
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
