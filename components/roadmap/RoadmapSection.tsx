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
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">
        {title} <span className="text-slate-500">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          Nothing here yet.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RoadmapItemCard
              key={item.id}
              item={item}
              authed={authed}
              onSignInRequired={onSignInRequired}
            />
          ))}
        </div>
      )}
    </section>
  );
}
