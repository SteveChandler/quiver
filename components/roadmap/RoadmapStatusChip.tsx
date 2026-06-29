import type { RoadmapStatus } from "@/lib/roadmap/types";

const LABELS: Record<RoadmapStatus, string> = {
  under_consideration: "Under Consideration",
  in_progress: "Building Now",
  shipped: "Shipped",
  declined: "Passed",
};

const COLORS: Record<RoadmapStatus, string> = {
  under_consideration: "text-[#11100D]/70 bg-[#FBF6E8] border-[#11100D]/35",
  in_progress: "text-[#11100D] bg-[#F78E42]/30 border-[#F78E42]",
  shipped: "text-[#00D4AA] bg-[#11100D] border-[#11100D]",
  declined: "text-[#B91C1C] bg-[#B91C1C]/10 border-[#B91C1C]/35",
};

interface Props {
  status: RoadmapStatus;
}

export function RoadmapStatusChip({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[8px_3px_10px_3px] border px-2 py-0.5 font-[var(--font-mono)] text-[10px] uppercase tracking-widest ${COLORS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
