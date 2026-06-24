import type { ReactElement } from "react";

import { QuiverSticker, ZineSurface } from "@/components/zine";

const POINTS: { title: string; body: string }[] = [
  {
    title: "Free beach reads, not a paywall",
    body: "Public forecast data stays free. Check the basics before you commit to the paddle out.",
  },
  {
    title: "Decisions shaped around your boards",
    body: "Swell, wind, tide, and confidence -- scored against the boards you actually ride.",
  },
  {
    title: "A feedback loop from real sessions",
    body: "Your saved beaches, boards, and session notes make every forecast sharper over time.",
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
      <div className="mb-7">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[#0B3A75]">
          How Quiver helps
        </p>
        <h2 className="mt-2 font-[var(--font-zine-display)] text-3xl uppercase leading-tight text-[#11100D] sm:text-4xl">
          Not your average surf report.
        </h2>
        <p className="mt-3 max-w-3xl font-mono text-sm leading-relaxed text-[#11100D]/75 sm:text-base">
          Quiver ties your beach read, your boards, and your session history
          into one loop -- so it works less like a forecast tool and more like
          a surf brain that actually knows you.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {POINTS.map((point) => (
          <li
            key={point.title}
            className="notebook bg-[#FFFDF4] p-5 shadow-[2px_4px_0_rgba(17,16,13,0.12)]"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[#11100D] bg-[#F78E42]"
                aria-hidden
              />
              <div className="min-w-0">
                <h3 className="font-[var(--font-zine-display)] text-xl uppercase leading-tight text-[#11100D]">
                  {point.title}
                </h3>
                <p className="mt-1 font-mono text-sm leading-relaxed text-[#11100D]/80">
                  {point.body}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <QuiverSticker
        sticker="goldRightArrow"
        className="mt-4 w-24 -rotate-3"
        sizes="6rem"
      />
    </ZineSurface>
  );
}
