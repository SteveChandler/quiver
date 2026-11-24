"use client";

import { useEffect, useState } from "react";

import { formatAge } from "@/lib/buoy-pages/format";
import { classifyStationStatus, STATUS_LABELS, type StationStatus } from "@/lib/buoy-pages/status";
import { cn } from "@/lib/utils";

const CHIP_CLASSES: Record<StationStatus, string> = {
  fresh: "border-[#0E7A55] bg-[#E3F4EC] text-[#0B5A3F]",
  stale: "border-[#8A5E00] bg-[#FBF0D4] text-[#6B4800]",
  offline: "border-[#11100D]/40 bg-[#11100D]/5 text-[#11100D]/70",
};

/** Re-evaluates status after mount: the ISR page may be up to 15 minutes old. */
function useClientStatus(lastWaveAt: string | null, serverStatus: StationStatus, freshForMs?: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return { status: serverStatus, ageMs: null };
  const at = lastWaveAt ? Date.parse(lastWaveAt) : NaN;
  return {
    status: classifyStationStatus(lastWaveAt, now, freshForMs),
    ageMs: Number.isFinite(at) ? now - at : null,
  };
}

interface StatusChipProps {
  lastWaveAt: string | null;
  serverStatus: StationStatus;
  /** Station-local time of the newest wave reading, rendered on the server. */
  absolute: string;
  /** The station's Live limit (liveLimitMs), so the client applies the server's rule. */
  freshForMs: number;
  className?: string;
}

/**
 * The cached HTML may be served long after it was rendered, so the server
 * never says "Live": a fresh reading renders as "Reported <time>" and the
 * client upgrades the label to Live / Stale / Offline after mount.
 */
export function StatusChip({ lastWaveAt, serverStatus, absolute, freshForMs, className }: StatusChipProps) {
  const { status, ageMs } = useClientStatus(lastWaveAt, serverStatus, freshForMs);
  const label = ageMs === null && status === "fresh" ? `Reported ${absolute}` : STATUS_LABELS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]",
        CHIP_CLASSES[status],
        className,
      )}
      data-testid="buoy-status-chip"
      data-status={status}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

interface ReadingAgeProps {
  lastWaveAt: string | null;
  serverStatus: StationStatus;
  /** Absolute station-local time, rendered on the server. */
  absolute: string;
}

/** "Nov 10, 6:56 PM PST · 22 min ago"; the relative part appears after mount only. */
export function ReadingAge({ lastWaveAt, serverStatus, absolute }: ReadingAgeProps) {
  const { ageMs } = useClientStatus(lastWaveAt, serverStatus);
  return (
    <span data-testid="buoy-reading-age">
      {lastWaveAt ? <time dateTime={lastWaveAt}>{absolute}</time> : "No wave reading on record"}
      {ageMs !== null ? <span className="text-[#11100D]/60">{` · ${formatAge(ageMs)}`}</span> : null}
    </span>
  );
}
