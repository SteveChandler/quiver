import type { ReactElement } from "react";

import { QuiverSticker, ZineSurface } from "@/components/zine";

import { AutoplayVideo } from "./autoplay-video";

interface WalkthroughStep {
  eyebrow: string;
  title: string;
  body: string;
}

const STEPS: WalkthroughStep[] = [
  {
    eyebrow: "WHERE",
    title: "Save your home break.",
    body: "Choose a home beach and favorite the breaks you watch. Quiver starts with the spots that matter to you.",
  },
  {
    eyebrow: "WHAT TO RIDE",
    title: "Add the boards in your quiver.",
    body: "Quiver can compare current wave and wind conditions with the boards and completed sessions in your profile, then return a board suggestion.",
  },
  {
    eyebrow: "WHEN TO GO",
    title: "Get one call for the window.",
    body: "Every break has a setup it likes best. Quiver reads swell, wind, tide, and forecast confidence against that one, then calls the window with five labels: EPIC, GOOD, FAIR, RIDEABLE, and MEH.",
  },
  {
    eyebrow: "KEEP LEARNING",
    title: "Log what happened in the water.",
    body: "After you paddle out, log the beach, board, rating, and conditions. That session context feeds future recommendations based on the waves you actually chose.",
  },
];

export function FieldGuideWalkthrough(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="How Quiver works"
      data-testid="field-guide-walkthrough"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-5xl !py-0"
      paperClassName="relative overflow-hidden !px-5 !py-7 sm:!px-8 sm:!py-10"
      showMasthead={false}
    >
      <QuiverSticker
        sticker="orangeTape"
        className="pointer-events-none absolute -right-2 -top-5 z-10 w-16 rotate-6 sm:right-2 sm:top-2 sm:w-20"
        sizes="5rem"
      />
      <header className="max-w-3xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[#0B3A75]">
          How Quiver works
        </p>
        <h2
          id="field-guide-walkthrough-heading"
          className="mt-2 max-w-2xl font-[var(--font-zine-display)] text-3xl uppercase leading-tight text-[#11100D] sm:text-4xl"
        >
          Turn a forecast into a surf plan.
        </h2>
        <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-[#11100D]/75 sm:text-base">
          Start with a beach, tell Quiver what you ride, and get a call for the
          window worth chasing. Then your session gives the next call more
          context.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(250px,300px)] lg:items-start">
        <ol
          className="space-y-6"
          data-testid="field-guide-walkthrough-steps"
          aria-labelledby="field-guide-walkthrough-heading"
        >
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-b-2 border-dashed border-[#0B3A75]/25 pb-6 last:border-b-0 last:pb-0 sm:grid-cols-[4.5rem_minmax(0,1fr)]"
            >
              <span
                className="font-[var(--font-zine-display)] text-4xl leading-none text-[#F78E42] sm:text-5xl"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3A75]">
                  {step.eyebrow}
                </p>
                <h3 className="mt-1 font-[var(--font-zine-display)] text-xl uppercase leading-tight text-[#11100D] sm:text-2xl">
                  {step.title}
                </h3>
                <p className="mt-2 font-mono text-sm leading-relaxed text-[#11100D]/80">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="relative mx-auto w-full max-w-[300px] -rotate-1 border-2 border-[#11100D] bg-[#11100D] p-2 shadow-[10px_10px_0_rgba(247,142,66,0.42)]">
          <div
            className="relative aspect-[9/16] overflow-hidden bg-[#0D1020]"
            data-testid="field-guide-walkthrough-video"
          >
            <AutoplayVideo
              src="/videos/buoy-loop.mp4"
              ariaLabel="Quiver reading swell, wind, and tide for a break"
              className="absolute inset-0 h-full w-full object-cover"
              playLabel="Play loop"
              playButtonClassName="absolute inset-0 flex items-center justify-center bg-[#F4EBD8]/88 font-heading text-base font-black uppercase text-[#11100D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F78E42]"
            />
          </div>
        </div>
      </div>
    </ZineSurface>
  );
}
