import type { ReactElement } from "react";

import { TornDivider } from "@/components/beach-detail/zine/atoms";
import { QuiverSticker, ZineSurface } from "@/components/zine";

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Pick your breaks",
    body: "Star the spots you actually surf. Quiver keeps your home stretch close.",
  },
  {
    n: "02",
    title: "Get the dawn call",
    body: "Open the app before sunrise for an honest read on where to paddle out.",
  },
  {
    n: "03",
    title: "Log the session",
    body: "Tap to save the conditions, board, and score so the next call has context.",
  },
];

export function FieldGuideWalkthrough(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="How it works"
      data-testid="field-guide-walkthrough"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-5xl !py-0"
      showMasthead={false}
    >
      <ol className="space-y-6">
        {STEPS.map((step, index) => (
          <li key={step.n}>
            <div className="flex items-start gap-4">
              <span className="font-[var(--font-zine-display)] text-4xl leading-none text-[#F78E42]">
                {step.n}
              </span>
              <div>
                <h3 className="font-[var(--font-zine-display)] text-xl uppercase leading-tight text-[#11100D]">
                  {step.title}
                </h3>
                <p className="mt-1 font-mono text-sm leading-relaxed text-[#11100D]/80">
                  {step.body}
                </p>
              </div>
            </div>
            {index < STEPS.length - 1 ? <TornDivider /> : null}
          </li>
        ))}
      </ol>
      <QuiverSticker
        sticker="goldRightArrow"
        className="mt-4 w-24 -rotate-3"
        sizes="6rem"
      />
    </ZineSurface>
  );
}
