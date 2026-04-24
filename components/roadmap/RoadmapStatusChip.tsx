import type { RoadmapStatus } from "@/lib/roadmap/types";

const LABELS: Record<RoadmapStatus, string> = {
  under_consideration: "Under Consideration",
  in_progress: "In Progress",
  shipped: "Shipped",
  declined: "Declined",
};

const COLORS: Record<RoadmapStatus, string> = {
  under_consideration: "text-slate-400 bg-slate-800/40 border-slate-700",
  in_progress: "text-orange-400 bg-orange-950/40 border-orange-900",
  shipped: "text-teal-400 bg-teal-950/40 border-teal-900",
  declined: "text-rose-400 bg-rose-950/40 border-rose-900",
};

interface Props {
  status: RoadmapStatus;
}

export function RoadmapStatusChip({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${COLORS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
