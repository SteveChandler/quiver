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
  challengeCode: string;
  onSelectBreak(index: number): void;
  onStart(): void;
  onPractice(): void;
}

export function StartScreen({
  selectedBreakIndex,
  unlockedBreakIndex,
  challenge,
  challengeCode,
  onSelectBreak,
  onStart,
  onPractice,
}: StartScreenProps): ReactElement {
  const definitions = challenge ? [BREAKS[challenge.breakIndex]] : BREAKS;
  const [copied, setCopied] = useState(false);

  const shareSet = async (): Promise<void> => {
    const challengeUrl = new URL("/play", document.baseURI);
    challengeUrl.searchParams.set("c", challengeCode);
    const text = `Today's ONE MORE WAVE set at ${BREAKS[selectedBreakIndex].name}. Same waves. Ride it: ${challengeUrl}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ONE MORE WAVE by Quiver", text, url: challengeUrl.toString() });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard?.writeText(text);
    setCopied(true);
  };

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0B5FA5]/10 p-2 sm:p-4">
      <section className="flex min-h-full w-full flex-col text-[#F8FEFF] [font-family:var(--font-play-pixel)]">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-2 border-[#29C7F6] bg-[#0B5FA5]/95 px-3 py-2 text-[8px] uppercase shadow-[3px_3px_0_#0A1D2B] sm:text-[10px]">
          <Link href="/" className="justify-self-start text-[#B8F1FF] hover:text-[#F8FEFF]">Quiver</Link>
          <span className="text-center text-[#F8FEFF]">One More Wave</span>
          <span className="justify-self-end text-[#75E3E1]">Play</span>
        </header>

        <div className="mx-auto mt-2 max-w-4xl text-center sm:mt-3">
          <p className="inline-block border-2 border-[#29C7F6] bg-[#127CC1] px-3 py-2 text-[8px] uppercase text-[#B8F1FF] shadow-[2px_2px_0_#0A1D2B]">Today&apos;s set</p>
          <h2 className="mx-auto mt-2 max-w-5xl text-2xl uppercase leading-[1.25] text-[#F8FEFF] [text-shadow:3px_3px_0_#0A1D2B] sm:mt-3 sm:whitespace-nowrap sm:text-4xl lg:text-5xl">
            One More Wave
          </h2>
          <p className="mx-auto mt-2 w-fit bg-[#0B5FA5] px-3 py-2 text-[7px] uppercase leading-4 text-[#FFF0B0] shadow-[2px_2px_0_#0A1D2B] sm:mt-3 sm:text-[9px]">
            Ride the line. Beat the pier. Get the real one.
          </p>
            {challenge ? (
              <p className="mx-auto mt-3 w-fit border-2 border-[#FFD447] bg-[#FF5C6C] px-3 py-2 text-[8px] uppercase">
                Challenge set · beat {challenge.initials ?? "your mate"}&apos;s {challenge.heatTotal.toFixed(2)}
              </p>
            ) : null}
        </div>

        <div className="mt-auto pt-16 sm:pt-24">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-1.5 bg-[#0B5FA5]/80 p-2 sm:grid-cols-3 sm:gap-2 lg:grid-cols-6" aria-label="Choose a surf break">
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
                className={`h-auto min-h-14 min-w-0 justify-between rounded-none border-2 px-2 py-2 text-left shadow-[2px_2px_0_#0A1D2B] sm:min-h-16 sm:px-3 ${
                  selected
                    ? "border-[#FFD447] bg-[#0B5FA5] text-[#F8FEFF] hover:bg-[#127CC1]"
                    : "border-[#29C7F6] bg-[#127CC1] text-[#F8FEFF] hover:bg-[#0B5FA5]"
                }`}
              >
                <span>
                  <span className="block whitespace-normal text-[7px] uppercase leading-3 sm:text-[8px]">{definition.name}</span>
                  <span className="mt-1 block whitespace-normal text-[6px] uppercase leading-3 text-[#B8F1FF] sm:mt-2">
                    {definition.sizeCopy} · cut {definition.threshold.toFixed(2)}
                  </span>
                </span>
                {locked ? <LockKeyhole aria-label="Locked" /> : null}
              </Button>
            );
          })}
        </div>

        <div className="mx-auto mt-2 grid max-w-3xl gap-2 sm:mt-3 sm:grid-cols-3">
          <Button
            type="button"
            size="lg"
            onClick={onStart}
            className="h-12 rounded-none border-2 border-[#FFD447] bg-[#0B5FA5] px-3 text-[9px] uppercase text-[#F8FEFF] shadow-[3px_3px_0_#0A1D2B] hover:bg-[#127CC1]"
          >
            Start run
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={onPractice} className="h-12 rounded-none border-2 border-[#29C7F6] bg-[#127CC1] px-3 text-[9px] uppercase text-[#F8FEFF] shadow-[2px_2px_0_#0A1D2B] hover:bg-[#0B5FA5]">Practice</Button>
          <Button type="button" size="lg" variant="outline" onClick={() => void shareSet()} className="h-12 rounded-none border-2 border-[#0B5FA5] bg-[#B8F1FF] px-3 text-[7px] uppercase text-[#0A1D2B] shadow-[1px_1px_0_#0A1D2B] hover:bg-[#75E3E1]">{copied ? "Set copied" : "Challenge a friend"}</Button>
        </div>
        <p className="mt-2 text-center text-[7px] uppercase leading-4 text-[#F8FEFF]">{BREAKS[selectedBreakIndex].name} · {BREAKS[selectedBreakIndex].sizeCopy}</p>
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
    <div className="absolute inset-0 z-20 flex bg-[#0A1D2B]/70 p-4">
      <section className="m-auto w-full max-w-lg border-4 border-[#29C7F6] bg-[#127CC1] p-5 text-[#F8FEFF] shadow-[4px_4px_0_#0A1D2B]">
        <p className="text-[8px] uppercase text-[#75E3E1]">Read the wave</p>
        <h2 className="mt-3 text-xl uppercase">Three things.</h2>
        <ol className="mt-4 grid gap-3 text-[8px] leading-5 text-[#E6F9FF]">
          <li><strong>1. Find speed.</strong> Drag the left half up/down, or use ↑ ↓. Low is fast.</li>
          <li><strong>2. Pump.</strong> Hold the right half, or Space. Release high for a snap; release at the lip with speed for an air.</li>
          <li><strong>3. Stick the air.</strong> Tap the action side again in the landing window. When the lip throws, stay low for the tube.</li>
        </ol>
        <Button type="button" onClick={onContinue} className="mt-6 w-full rounded-none border-2 border-[#FFD447] bg-[#0B5FA5] text-[9px] uppercase text-[#F8FEFF] hover:bg-[#127CC1]">
          I&apos;m out there
        </Button>
      </section>
    </div>
  );
}

interface JudgeCardProps {
  score: number;
  wipedOut: boolean;
  practice: boolean;
  isHeatOver: boolean;
  incomingWaveNumber: number | null;
  onContinue(): void;
}

export function JudgeCard({ score, wipedOut, practice, isHeatOver, incomingWaveNumber, onContinue }: JudgeCardProps): ReactElement {
  return (
    <div className="absolute inset-0 z-20 flex bg-[#0A1D2B]/45 p-4">
      <section
        className="m-auto w-full max-w-sm border-4 border-[#29C7F6] bg-[#127CC1] p-6 text-center text-[#F8FEFF] shadow-[4px_4px_0_#0A1D2B] motion-safe:animate-[outside-card-flip_500ms_cubic-bezier(0.16,1,0.3,1)]"
        aria-live="assertive"
      >
        <p className="text-[8px] uppercase text-[#75E3E1]">{practice ? "Practice wave" : "The cards are up"}</p>
        <p className="mt-3 text-5xl tabular-nums text-[#FFF0B0]">{score.toFixed(2)}</p>
        <p className="mt-3 text-[8px] leading-5 text-[#E6F9FF]">
          {wipedOut ? "The ocean does not care. Twenty percent gone." : score >= 7 ? "That wave had teeth." : "Bank it. Keep moving."}
        </p>
        {incomingWaveNumber !== null ? (
          <p className="mt-3 text-[8px] uppercase text-[#B8F1FF]" aria-live="polite">
            Wave {incomingWaveNumber} incoming
          </p>
        ) : null}
        <Button type="button" onClick={onContinue} className="mt-5 w-full rounded-none border-2 border-[#FFD447] bg-[#0B5FA5] text-[9px] uppercase text-[#F8FEFF] hover:bg-[#127CC1]">
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
    const text = `I scored a ${heatTotal.toFixed(2)} heat at ${definition.name} in ONE MORE WAVE. Same set, same waves. Beat it: ${url}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ONE MORE WAVE by Quiver", text, url });
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
    <Button type="button" onClick={() => void share()} className="w-full rounded-none border-2 border-[#FFD447] bg-[#0B5FA5] text-[8px] uppercase text-[#F8FEFF] hover:bg-[#127CC1]">
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
    <div className="absolute inset-0 z-20 overflow-y-auto bg-[#0A1D2B]/65 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-xl py-4">
        <section className="border-4 border-[#29C7F6] bg-[#127CC1] p-5 text-[#F8FEFF] shadow-[4px_4px_0_#0A1D2B] sm:p-7">
          <p className={`w-fit border-2 px-3 py-2 text-[8px] uppercase ${passed ? "border-[#75E3E1] bg-[#43D87D] text-[#0A1D2B]" : "border-[#FFD447] bg-[#D93B72] text-[#F8FEFF]"}`}>
            {heat.practice ? "Practice complete" : passed ? "Through the heat" : "Outside the cut"}
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl uppercase">{definition.name}</h2>
              <p className="mt-2 text-[7px] uppercase text-[#B8F1FF]">Best {definition.maxWaves === 1 ? "wave" : "two waves"}</p>
            </div>
            <p className="text-4xl tabular-nums text-[#FFF0B0]">{heat.heatTotal.toFixed(2)}</p>
          </div>
          <div className="mt-4 flex gap-3 text-[8px] tabular-nums text-[#E6F9FF]">
            {heat.waveScores.map((score, index) => <span key={index}>W{index + 1} {score.toFixed(2)}</span>)}
          </div>
          <p className="mt-4 text-[8px] leading-5 text-[#E6F9FF]">
            {heat.practice
              ? "Nothing saved. Take that line into a scored run."
              : passed
              ? `Made the ${definition.threshold.toFixed(2)} cut.`
              : `Didn't make the heat. Needed ${definition.threshold.toFixed(2)}.`}
          </p>
          <p className="mt-3 text-[7px] leading-4 text-[#B8F1FF]">
            Now go get a real one. Quiver helps you find the next surf window.
          </p>
          {challenge ? (
            <p className="mt-3 border-l-4 border-[#FFD447] pl-3 text-[7px] leading-4">
              {beatChallenge
                ? `You beat ${challenge.initials ?? "the challenger"}'s ${challenge.heatTotal.toFixed(2)}.`
                : `${challenge.initials ?? "The challenger"} keeps it by ${(challenge.heatTotal - heat.heatTotal).toFixed(2)}.`}
            </p>
          ) : null}

          <label className="mt-5 grid gap-2 text-[7px] uppercase text-[#B8F1FF]">
            Initials for your challenge (optional)
            <input
              value={initials}
              maxLength={3}
              onChange={(event) => onInitialsChange(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
              className="h-11 w-24 border-2 border-[#29C7F6] bg-[#B8F1FF] px-3 text-sm uppercase text-[#0A1D2B]"
              aria-label="Challenge initials"
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={onRetry} className="rounded-none border-2 border-[#29C7F6] bg-[#B8F1FF] text-[8px] uppercase text-[#0A1D2B] hover:bg-[#75E3E1]">
              Retry this set
            </Button>
            {passed && !challenge && definition.index < BREAKS.length - 1 ? (
              <Button type="button" onClick={onNext} className="rounded-none border-2 border-[#75E3E1] bg-[#0B5FA5] text-[8px] uppercase text-[#F8FEFF] hover:bg-[#127CC1]">
                Next: {BREAKS[definition.index + 1].name}
              </Button>
            ) : null}
          </div>
          <div className="mt-2">
            <ShareButton definition={definition} heatTotal={heat.heatTotal} challengeCode={challengeCode} />
          </div>
          <Button asChild className="mt-2 w-full rounded-none border-2 border-[#75E3E1] bg-[#43D87D] text-[8px] uppercase text-[#0A1D2B] hover:bg-[#75E3E1]">
            <Link href={definition.beachPath}>Find a real session</Link>
          </Button>
          <Link href="/" className="mt-5 block text-center text-[7px] uppercase text-[#B8F1FF] underline-offset-4 hover:underline">
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
