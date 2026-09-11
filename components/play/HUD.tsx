"use client";

import { Volume2, VolumeX } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { getNeedsScore, getProjectedHeatTotal, type BreakDefinition } from "@/lib/play";
import type { GameSnapshot } from "./CanvasHost";

interface HUDProps {
  definition: BreakDefinition;
  snapshot: GameSnapshot;
  ghostTotal?: number;
  muted: boolean;
  announcerLine: string;
  onToggleMute(): void;
}

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function HUD({
  definition,
  snapshot,
  ghostTotal,
  muted,
  announcerLine,
  onToggleMute,
}: HUDProps): ReactElement {
  const needs = getNeedsScore(snapshot.heat, snapshot.liveScore);
  const totalWithCurrent = getProjectedHeatTotal(snapshot.heat, snapshot.liveScore);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 text-[#F5EEDC] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="bg-[#11100D]/85 px-3 py-2 shadow-md backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F5EEDC]/70">
            Heat · {definition.name}
          </p>
          <p className="font-mono text-2xl font-black tabular-nums">
            {formatTimer(snapshot.heat.secondsRemaining)}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <div className="bg-[#F4EBD8]/95 px-3 py-2 text-right text-[#11100D] shadow-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em]">Current</p>
            <p className="font-mono text-2xl font-black tabular-nums">
              {snapshot.liveScore.toFixed(2)}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="pointer-events-auto rounded-none bg-[#F4EBD8] text-[#11100D] hover:bg-[#E5D4B3]"
            aria-label={muted ? "Unmute game audio" : "Mute game audio"}
            onClick={onToggleMute}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
      </div>

      <div className="mt-3 max-w-sm bg-[#11100D]/82 p-3 shadow-md backdrop-blur-sm">
        <div className="flex items-end justify-between gap-3 font-mono text-xs uppercase tracking-[0.1em]">
          <span>Heat {snapshot.heat.heatTotal.toFixed(2)}</span>
          <span>Cut {definition.threshold.toFixed(2)}</span>
        </div>
        <div className="relative mt-2 h-2 overflow-hidden bg-[#F5EEDC]/20">
          <div
            className="h-full bg-[#F78E42] transition-transform"
            style={{ transform: `scaleX(${totalWithCurrent / 20})`, transformOrigin: "left" }}
          />
          {ghostTotal !== undefined ? (
            <span
              className="absolute inset-y-0 w-0.5 bg-[#F2C94C]"
              style={{ left: `${Math.min(100, ghostTotal * 5)}%` }}
              aria-label={`Challenger scored ${ghostTotal.toFixed(2)}`}
            />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[#F5EEDC]/80">
          {Array.from({ length: definition.maxWaves }, (_, index) => (
            <span key={index}>W{index + 1} {snapshot.heat.waveScores[index]?.toFixed(2) ?? "—"}</span>
          ))}
        </div>
        {needs !== null ? (
          <p className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#F2C94C]">
            Needs {needs.toFixed(2)}
          </p>
        ) : null}
      </div>

      <p
        className="mt-3 w-fit max-w-[85%] bg-[#F4EBD8]/95 px-3 py-2 font-heading text-sm font-bold text-[#11100D] shadow"
        aria-live="polite"
      >
        {announcerLine}
      </p>
    </div>
  );
}
