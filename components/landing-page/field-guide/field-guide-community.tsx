import type { ReactElement } from "react";

import { QuiverSticker, ZineSurface } from "@/components/zine";

interface Testimonial {
  /** Short category tag shown as the card eyebrow. */
  tag: string;
  quote: string;
  /** Generic, non-identifying attribution (no names — see feedback doc). */
  byline: string;
}

// Source: Brand-Vault/marketing/landing-page-user-feedback.md (Gmail replies,
// 2026-06-30). Positive carousel candidates only — bug-friction quotes are held
// back for product planning. Attribution stays generic per the publish checklist.
const TESTIMONIALS: Testimonial[] = [
  {
    tag: "Forecast trust",
    quote:
      "Quiver showed something quite similar to what I saw at the beach, and explained why the best time might be later.",
    byline: "Beginner surfer",
  },
  {
    tag: "Session log",
    quote:
      "I truly love having my sessions documented in a clean, organized way.",
    byline: "Session logger",
  },
  {
    tag: "The essentials",
    quote:
      "I like the simplicity. Swell direction, interval, and wind are what decide if I want to go or not.",
    byline: "Frequent water user",
  },
  {
    tag: "All the details",
    quote:
      "The forecast was pretty accurate. Logging was pretty easy. Love all the details it lets you add.",
    byline: "Early beta surfer",
  },
  {
    tag: "Free cams",
    quote:
      "I appreciate that Quiver points to a webcam that doesn't cost extra.",
    byline: "Beginner surfer",
  },
  {
    tag: "Fast support",
    quote: "Wow, that's awesome. Thank you so much. That was quick.",
    byline: "Puerto Rico surfer",
  },
];

export function FieldGuideCommunity(): ReactElement {
  return (
    <ZineSurface
      sectionLabel="From the lineup"
      data-testid="field-guide-community"
      className="bg-[#0D1020] px-3 py-0 sm:px-6 sm:py-0"
      stageClassName="mx-auto max-w-5xl !py-0"
      paperClassName="relative overflow-hidden"
      showMasthead={false}
    >
      <QuiverSticker
        sticker="surfWax"
        className="pointer-events-none absolute -right-6 -top-8 w-24 rotate-12 opacity-90"
        sizes="6rem"
      />
      <div className="mb-7 max-w-3xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[#0B3A75]">
          From the lineup
        </p>
        <h2 className="mt-2 font-[var(--font-zine-display)] text-3xl uppercase leading-tight text-[#11100D] sm:text-4xl">
          What surfers told us.
        </h2>
        <p className="mt-3 font-mono text-sm leading-relaxed text-[#11100D]/75 sm:text-base">
          Notes from Quiver surfers, shared with us by email.
          Forecasting accuracy, sessions, conditions, photos.
        </p>
      </div>
      <ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TESTIMONIALS.map((item) => (
          <li
            key={item.quote}
            className="notebook flex flex-col bg-[#FFFDF4] p-5 shadow-[2px_4px_0_rgba(17,16,13,0.12)]"
          >
            <span className="inline-block self-start -rotate-1 rounded-[8px_3px_8px_3px] border-2 border-[#11100D] bg-[#C0DD97] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#27500A]">
              {item.tag}
            </span>
            <p className="mt-3 flex-1 font-mono text-sm leading-relaxed text-[#11100D]/85">
              &ldquo;{item.quote}&rdquo;
            </p>
            <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#11100D]/60">
              — {item.byline}
            </p>
          </li>
        ))}
      </ul>
    </ZineSurface>
  );
}
