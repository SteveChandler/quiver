"use client";

/**
 * Water Quality Map List
 *
 * Shows a scrollable list of beaches with water quality status badges.
 * Links to /tools/water-quality?beach=<slug>.
 * On small screens, replaces the map view with this compact list.
 */

import Link from "next/link";
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { WQ_STATUS, type WQStatus } from "@/lib/constants/water-quality";
import type { CountyStatusMetadata } from "@/lib/services/water-quality/current-status";

interface BeachWQSummary extends CountyStatusMetadata {
  beachId: string;
  beachName: string;
  beachSlug: string;
  state: string;
  city: string | null;
  lat: number;
  lon: number;
  status: WQStatus;
  latestSampleDate: string | null;
}

interface WaterQualityMapListProps {
  beaches: BeachWQSummary[];
  currentSlug?: string;
}

const STATUS_CONFIG: Record<
  WQStatus,
  { label: string; color: string; textColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  [WQ_STATUS.GOOD]: {
    label: "Good",
    color: "bg-emerald-500/20 border-emerald-500/40",
    textColor: "text-emerald-400",
    Icon: CheckCircle,
  },
  [WQ_STATUS.ADVISORY]: {
    label: "Advisory",
    color: "bg-amber-500/20 border-amber-500/40",
    textColor: "text-amber-400",
    Icon: AlertTriangle,
  },
  [WQ_STATUS.CLOSURE]: {
    label: "Closure",
    color: "bg-red-500/20 border-red-500/40",
    textColor: "text-red-400",
    Icon: XCircle,
  },
  [WQ_STATUS.UNKNOWN]: {
    label: "Unknown",
    color: "bg-slate-500/20 border-slate-500/40",
    textColor: "text-slate-400",
    Icon: HelpCircle,
  },
};

function formatDate(date: string | null): string {
  if (!date) return "No data";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Sort priority: CLOSURE first, then ADVISORY, then GOOD, then UNKNOWN
const STATUS_SORT_ORDER: Record<WQStatus, number> = {
  [WQ_STATUS.CLOSURE]: 0,
  [WQ_STATUS.ADVISORY]: 1,
  [WQ_STATUS.GOOD]: 2,
  [WQ_STATUS.UNKNOWN]: 3,
};

export function WaterQualityMapList({ beaches, currentSlug }: WaterQualityMapListProps) {
  // Group by state, sorted by status priority within each state
  const byState = new Map<string, BeachWQSummary[]>();
  for (const beach of beaches) {
    const key = beach.state;
    const existing = byState.get(key) ?? [];
    existing.push(beach);
    byState.set(key, existing);
  }

  const sortedStates = Array.from(byState.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-6">
      {sortedStates.map(([state, stateBeaches]) => {
        const sorted = [...stateBeaches].sort(
          (a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]
        );

        return (
          <div key={state}>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
              {state === "CA" ? "California" : state === "HI" ? "Hawaii" : state}
              <span className="ml-2 text-slate-500 font-normal normal-case">
                ({sorted.length} beaches monitored)
              </span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.map((beach) => {
                const config = beach.county_advisory_status === "clear" || beach.county_advisory_status === "unavailable"
                  ? { ...STATUS_CONFIG[WQ_STATUS.UNKNOWN], label: beach.county_advisory_status === "clear" ? "No county advisory" : "County status unavailable" }
                  : STATUS_CONFIG[beach.status] ?? STATUS_CONFIG[WQ_STATUS.UNKNOWN];
                const { Icon } = config;
                const isActive = beach.beachSlug === currentSlug;

                return (
                  <Link
                    key={beach.beachId}
                    href={`/tools/water-quality?beach=${beach.beachSlug}`}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-[background-color,box-shadow]",
                      "bg-white/5 border-white/10 hover:bg-white/10",
                      isActive && "ring-2 ring-[#F78E42]/60",
                      config.color
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={cn("h-4 w-4 shrink-0", config.textColor)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{beach.beachName}</p>
                        {beach.city && (
                          <p className="text-xs text-slate-400 truncate">{beach.city}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn("text-xs font-semibold", config.textColor)}>
                        {config.label}
                      </span>
                      {!beach.county_advisory_status && <p className="text-[11px] text-slate-500">{formatDate(beach.latestSampleDate)}</p>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
