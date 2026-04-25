import type { RoadmapStatus } from "@/lib/roadmap/types";

const LABELS: Record<RoadmapStatus, string> = {
  under_consideration: "Under Consideration",
  in_progress: "Building Now",
  shipped: "Shipped",
  declined: "Passed",
};

const COLORS: Record<RoadmapStatus, string> = {
  under_consideration: "text-white/60 bg-[#2D357D]/40 border-[#2D357D]/60",
  in_progress: "text-[#F78E42] bg-[#F78E42]/10 border-[#F78E42]/50",
  shipped: "text-[#00D4AA] bg-[#00D4AA]/10 border-[#00D4AA]/40",
  declined: "text-[#F87171] bg-[#F87171]/10 border-[#F87171]/30",
};

interface Props {
  status: RoadmapStatus;
}

export function RoadmapStatusChip({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-[8px_3px_10px_3px] border px-2 py-0.5 font-[var(--font-mono)] text-[10px] uppercase tracking-widest ${COLORS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
