"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { Check, Copy, LockKeyhole, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BREAKS, type BreakDefinition, type Challenge, type HeatState } from "@/lib/play";
import { LeadCapture } from "./LeadCapture";

interface StartScreenProps {
  selectedBreakIndex: number;
  unlockedBreakIndex: number;
  challenge: Challenge | null;
  onSelectBreak(index: number): void;
  onStart(): void;
}

export function StartScreen({
  selectedBreakIndex,
  unlockedBreakIndex,
  challenge,
  onSelectBreak,
  onStart,
}: StartScreenProps): ReactElement {
  const definitions = challenge ? [BREAKS[challenge.breakIndex]] : BREAKS;

  return (
    <div className="absolute inset-0 z-20 flex overflow-y-auto bg-[#0D1020]/55 p-4 backdrop-blur-[2px] sm:p-8">
      <section className="m-auto w-full max-w-3xl bg-[#F4EBD8] p-5 text-[#11100D] shadow-lg sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <p className="label-black w-fit">Today&apos;s set</p>
            <h2 className="zine-display mt-4 text-5xl uppercase leading-[0.86] sm:text-7xl">
              Outside
            </h2>
            <p className="mt-4 max-w-lg font-heading text-lg font-bold">
              Sets are coming. Get to the peak.
            </p>
            {challenge ? (
              <p className="mt-3 border-l-4 border-[#B91C1C] pl-3 font-mono text-xs font-bold uppercase tracking-[0.08em]">
                Challenge set · beat {challenge.initials ?? "your mate"}&apos;s {challenge.heatTotal.toFixed(2)}
              </p>
            ) : null}
          </div>
          <div className="stamp-circle justify-self-center lg:justify-self-end">
            Same set
            <span className="lg">3 waves</span>
            no excuses
          </div>
        </div>

        <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Choose a surf break">
          {definitions.map((definition) => {
            const locked = challenge
              ? definition.index !== challenge.breakIndex
              : definition.index > unlockedBreakIndex;
            const selected = definition.index === selectedBreakIndex;
            return (
              <Button
                key={definition.name}
                type="button"
                variant="outline"
                disabled={locked}
                aria-pressed={selected}
                onClick={() => onSelectBreak(definition.index)}
                className={`h-auto min-h-20 justify-between rounded-none border-2 px-4 py-3 text-left ${
                  selected
                    ? "border-[#11100D] bg-[#11100D] text-[#F4EBD8] hover:bg-[#11100D]/90 hover:text-[#F4EBD8]"
                    : "border-[#11100D] bg-[#F5EEDC] text-[#11100D] hover:bg-[#E5D4B3]"
                }`}
              >
                <span>
                  <span className="block font-heading font-black uppercase">{definition.name}</span>
                  <span className="mt-1 block whitespace-normal font-mono text-[10px] uppercase opacity-70">
                    {definition.sizeCopy} · cut {definition.threshold.toFixed(2)}
                  </span>
                </span>
                {locked ? <LockKeyhole aria-label="Locked" /> : null}
              </Button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <Button
            type="button"
            size="lg"
            onClick={onStart}
            className="rounded-none border-2 border-[#11100D] font-heading text-base font-black uppercase shadow-md"
          >
            Paddle out at {BREAKS[selectedBreakIndex].name}
          </Button>
          <Link href="/" className="font-mono text-xs font-bold uppercase tracking-[0.12em] underline-offset-4 hover:underline">
            Made by Quiver
          </Link>
        </div>
      </section>
    </div>
  );
}

interface ControlPrimerProps {
  onContinue(): void;
}

export function ControlPrimer({ onContinue }: ControlPrimerProps): ReactElement {
  return (
    <div className="absolute inset-0 z-20 flex bg-[#0D1020]/70 p-4">
      <section className="notebook m-auto w-full max-w-lg text-[#11100D]">
        <p className="typewriter">Read the wave</p>
        <h2 className="font-heading text-3xl font-black uppercase">Three things.</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6">
          <li><strong>1. Find speed.</strong> Drag the left half up/down, or use ↑ ↓. Low is fast.</li>
          <li><strong>2. Pump.</strong> Hold the right half, or Space. Release high for a snap; release at the lip with speed for an air.</li>
          <li><strong>3. Stick the air.</strong> Tap the action side again in the landing window. When the lip throws, stay low for the tube.</li>
        </ol>
        <Button type="button" onClick={onContinue} className="mt-6 w-full rounded-none font-heading font-black uppercase">
          I&apos;m out there
        </Button>
      </section>
    </div>
  );
}

interface JudgeCardProps {
  score: number;
  wipedOut: boolean;
  isHeatOver: boolean;
  incomingWaveNumber: number | null;
  onContinue(): void;
}

export function JudgeCard({ score, wipedOut, isHeatOver, incomingWaveNumber, onContinue }: JudgeCardProps): ReactElement {
  return (
    <div className="absolute inset-0 z-20 flex bg-[#0D1020]/55 p-4">
      <section
        className="m-auto w-full max-w-sm border-4 border-[#11100D] bg-[#F4EBD8] p-6 text-center text-[#11100D] shadow-lg motion-safe:animate-[outside-card-flip_500ms_cubic-bezier(0.16,1,0.3,1)]"
        aria-live="assertive"
      >
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em]">The cards are up</p>
        <p className="mt-3 font-heading text-7xl font-black tabular-nums">{score.toFixed(2)}</p>
        <p className="mt-3 font-heading font-bold">
          {wipedOut ? "The ocean does not care. Twenty percent gone." : score >= 7 ? "That wave had teeth." : "Bank it. Keep moving."}
        </p>
        {incomingWaveNumber !== null ? (
          <p className="mt-3 font-mono text-xs font-bold uppercase tracking-[0.14em]" aria-live="polite">
            Wave {incomingWaveNumber} incoming
          </p>
        ) : null}
        <Button type="button" onClick={onContinue} className="mt-5 w-full rounded-none font-heading font-black uppercase">
          {isHeatOver ? "See the result" : "Next wave"}
        </Button>
      </section>
    </div>
  );
}

interface ShareButtonProps {
  definition: BreakDefinition;
  heatTotal: number;
  challengeCode: string;
}

function ShareButton({ definition, heatTotal, challengeCode }: ShareButtonProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const share = async (): Promise<void> => {
    const challengeUrl = new URL("/play", document.baseURI);
    challengeUrl.searchParams.set("c", challengeCode);
    const url = challengeUrl.toString();
    const text = `I scored a ${heatTotal.toFixed(2)} heat at ${definition.name} in OUTSIDE. Same set, same waves. Beat it: ${url}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "OUTSIDE by Quiver", text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const copiedWithClipboard = navigator.clipboard
      ? await navigator.clipboard.writeText(text).then(() => true, () => false)
      : false;
    if (!copiedWithClipboard) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
  };

  return (
    <Button type="button" onClick={() => void share()} className="w-full rounded-none font-heading font-black uppercase">
      {copied ? <Check /> : canShare ? <Share2 /> : <Copy />}
      {copied ? "Challenge copied" : "Send this heat to a friend"}
    </Button>
  );
}

interface HeatResultProps {
  definition: BreakDefinition;
  heat: HeatState;
  challenge: Challenge | null;
  challengeCode: string;
  initials: string;
  onInitialsChange(value: string): void;
  onRetry(): void;
  onNext(): void;
}

export function HeatResult({
  definition,
  heat,
  challenge,
  challengeCode,
  initials,
  onInitialsChange,
  onRetry,
  onNext,
}: HeatResultProps): ReactElement {
  const passed = heat.status === "passed";
  const beatChallenge = challenge ? heat.heatTotal > challenge.heatTotal : false;

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0D1020]/72 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-xl py-4">
        <section className="border-4 border-[#11100D] bg-[#F4EBD8] p-5 text-[#11100D] shadow-lg sm:p-7">
          <p className={`label-black w-fit ${passed ? "" : "!bg-[#B91C1C]"}`}>
            {passed ? "Through the heat" : "Outside the cut"}
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading text-3xl font-black uppercase">{definition.name}</h2>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em]">Best {definition.maxWaves === 1 ? "wave" : "two waves"}</p>
            </div>
            <p className="font-heading text-5xl font-black tabular-nums">{heat.heatTotal.toFixed(2)}</p>
          </div>
          <div className="mt-4 flex gap-2 font-mono text-sm font-bold tabular-nums">
            {heat.waveScores.map((score, index) => <span key={index}>W{index + 1} {score.toFixed(2)}</span>)}
          </div>
          <p className="mt-4 font-heading text-lg font-bold">
            {passed
              ? `Made the ${definition.threshold.toFixed(2)} cut.`
              : `Didn't make the heat. Needed ${definition.threshold.toFixed(2)}.`}
          </p>
          {challenge ? (
            <p className="mt-2 border-l-4 border-[#F2C94C] pl-3 font-mono text-xs font-bold uppercase tracking-[0.08em]">
              {beatChallenge
                ? `You beat ${challenge.initials ?? "the challenger"}'s ${challenge.heatTotal.toFixed(2)}.`
                : `${challenge.initials ?? "The challenger"} keeps it by ${(challenge.heatTotal - heat.heatTotal).toFixed(2)}.`}
            </p>
          ) : null}

          <label className="mt-5 grid gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
            Initials for your challenge (optional)
            <input
              value={initials}
              maxLength={3}
              onChange={(event) => onInitialsChange(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
              className="h-11 w-24 border-2 border-[#11100D] bg-[#F5EEDC] px-3 text-base uppercase"
              aria-label="Challenge initials"
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onRetry} className="rounded-none border-2 border-[#11100D] bg-[#F5EEDC] font-heading font-black uppercase text-[#11100D]">
              Retry this set
            </Button>
            {passed && !challenge && definition.index < BREAKS.length - 1 ? (
              <Button type="button" onClick={onNext} className="rounded-none font-heading font-black uppercase">
                Next: {BREAKS[definition.index + 1].name}
              </Button>
            ) : null}
          </div>
          <div className="mt-2">
            <ShareButton definition={definition} heatTotal={heat.heatTotal} challengeCode={challengeCode} />
          </div>
          <Link href="/" className="mt-5 block text-center font-mono text-xs font-bold uppercase tracking-[0.12em] underline-offset-4 hover:underline">
            Made by Quiver
          </Link>
        </section>

        <LeadCapture
          breakSlug={definition.beachSlug}
          breakName={definition.name}
          heatTotal={heat.heatTotal}
          challengeCode={challengeCode}
        />
      </div>
    </div>
  );
}
