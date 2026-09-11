"use client";

import { Volume2, VolumeX } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { getNeedsScore, getPierWarning, type BreakDefinition, type WaveDefinition } from "@/lib/play";
import type { GameSnapshot } from "./game-types";

interface HUDProps {
  definition: BreakDefinition;
  snapshot: GameSnapshot;
  wave: WaveDefinition;
  bestScore: number;
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
  wave,
  bestScore,
  ghostTotal,
  muted,
  announcerLine,
  onToggleMute,
}: HUDProps): ReactElement {
  const needs = getNeedsScore(snapshot.heat, snapshot.liveScore);
  const pierWarning = getPierWarning(wave.obstacles, snapshot.simulation.elapsed);
  const rawGap = Math.max(0, Math.min(1, snapshot.simulation.sectionDistance / 0.82));
  const gap = pierWarning ? rawGap * 0.65 : rawGap;
  const waveProgress = Math.max(0, Math.min(1, snapshot.simulation.elapsed / wave.duration));
  const dangerColour = gap < 0.25 ? "#FF5C6C" : gap < 0.48 ? "#FFD447" : "#75E3E1";
  const contextualAlert = snapshot.simulation.stats.wipeout
    ? `WIPEOUT · ${snapshot.simulation.wipeoutReason ?? "Caught by the foam"}`
    : pierWarning ? "PIER AHEAD"
    : gap < 0.25 ? "FOAM GAP!" : needs !== null ? `NEEDS ${needs.toFixed(2)}` : announcerLine;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2 text-[#F8FEFF] [font-family:var(--font-play-pixel)] [text-shadow:1px_1px_0_#0A1D2B] sm:p-3">
      <div className="grid grid-cols-[minmax(92px,1fr)_minmax(130px,2fr)_minmax(82px,1fr)] items-start gap-2">
        <div className="border-2 border-[#29C7F6] bg-[#0B5FA5] px-2 py-2 shadow-[2px_2px_0_#0A1D2B] sm:px-3">
          <p className="text-[7px] uppercase text-[#B8F1FF] sm:text-[9px]">Score</p>
          <p className="mt-1 text-sm tabular-nums sm:text-xl">{snapshot.liveScore.toFixed(2)}</p>
          <p className="mt-1 text-[6px] uppercase text-[#B8F1FF] sm:text-[8px]">Best {bestScore.toFixed(2)}</p>
        </div>

        <div className="border-2 border-[#29C7F6] bg-[#0B5FA5] px-2 py-2 shadow-[2px_2px_0_#0A1D2B] sm:px-3">
          <div className="flex items-center justify-between gap-2 text-[7px] uppercase sm:text-[9px]">
            <span>Wave {Math.min(definition.maxWaves, snapshot.heat.currentWaveIndex + 1)} / {definition.maxWaves}</span>
            <span className="text-[#B8F1FF]">{snapshot.heat.practice ? "Practice" : definition.name}</span>
          </div>
          <div className="mt-2 h-2 border border-[#B8F1FF] bg-[#12324A]" aria-label={`Wave ${Math.round(waveProgress * 100)} percent complete`}>
            <div className="h-full bg-[#FF8D73]" style={{ width: `${waveProgress * 100}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[6px] uppercase text-[#B8F1FF] sm:text-[8px]">Foam gap</span>
            <div className="relative h-2 flex-1 border border-[#B8F1FF] bg-[#12324A]" aria-label={`Foam gap ${Math.round(gap * 100)} percent`}>
              <div className="h-full" style={{ width: `${gap * 100}%`, backgroundColor: dangerColour }} />
              {ghostTotal !== undefined ? <span className="absolute inset-y-[-2px] right-1 w-0.5 bg-[#FFD447]" aria-label={`Challenger scored ${ghostTotal.toFixed(2)}`} /> : null}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-end gap-1">
          <div className="border-2 border-[#29C7F6] bg-[#0B5FA5] px-2 py-2 text-right shadow-[2px_2px_0_#0A1D2B]">
            <p className="text-[7px] uppercase text-[#B8F1FF] sm:text-[9px]">Time</p>
            <p className="mt-1 text-xs tabular-nums sm:text-base">
              {snapshot.heat.practice ? "--:--" : formatTimer(snapshot.heat.secondsRemaining)}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="pointer-events-auto size-9 rounded-none border-2 border-[#29C7F6] bg-[#0B5FA5] p-2 text-[#F8FEFF] shadow-[2px_2px_0_#0A1D2B] hover:bg-[#127CC1]"
            aria-label={muted ? "Unmute game audio" : "Mute game audio"}
            onClick={onToggleMute}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </div>
      </div>

      <p
        className={`mx-auto mt-2 w-fit max-w-[85%] border-2 px-3 py-2 text-center text-[7px] uppercase shadow-[2px_2px_0_#0A1D2B] sm:text-[9px] ${
          contextualAlert === "PIER AHEAD" || contextualAlert === "FOAM GAP!" || contextualAlert.startsWith("WIPEOUT")
            ? "border-[#FFD447] bg-[#FF5C6C] text-[#F8FEFF]"
            : "border-[#29C7F6] bg-[#127CC1] text-[#F8FEFF]"
        }`}
        aria-live="polite"
      >
        {contextualAlert}
      </p>
    </div>
  );
}
