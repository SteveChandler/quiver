import Link from "next/link";
import type { ReactElement } from "react";

const AUDIENCES = [
  "Dawn patrol regulars",
  "Longboarders & log crews",
  "Shortboard window hunters",
  "Beginners learning local breaks",
  "Travelers checking a new coast",
  "Friends sharing the call",
] as const;

const ACCESS_POINTS = [
  "Public forecast data stays free forever",
  "No paywall for basic beach reads",
  "Pro adds board-aware picks, alerts, offline session saving, and personal forecasting",
] as const;

export function FieldGuideAudienceAccess(): ReactElement {
  return (
    <section
      data-testid="field-guide-audience-access"
      className="space-y-10"
      aria-labelledby="field-guide-access-heading"
    >
      <div className="rounded-[18px_8px_20px_10px] border-2 border-[#11100D]/15 bg-[#EDE5D1] p-5 shadow-[2px_4px_0_rgba(17,16,13,0.1)] sm:p-7">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-[#11100D]/60">
          Built for
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {AUDIENCES.map((audience) => (
            <span
              key={audience}
              className="rounded-full border border-[#11100D]/12 bg-[#FFFDF4] px-4 py-3 font-mono text-xs font-bold text-[#11100D]/72 shadow-sm"
            >
              {audience}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl text-center">
        <p className="mx-auto inline-flex rounded-full border border-[#128A48]/25 bg-[#D7F5DD] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#145A35]">
          Public forecast data is free forever
        </p>
        <h2
          id="field-guide-access-heading"
          className="mt-5 font-[var(--font-zine-display)] text-4xl uppercase leading-[1.02] text-[#11100D] sm:text-5xl"
        >
          One surf app. Go Pro when it’s time to lock in.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl font-mono text-sm leading-relaxed text-[#11100D]/70 sm:text-base">
          Public forecast data and custom spots are free forever. Upgrade for
          board-aware picks, smart alerts, offline session saving, and personal
          forecasting that learns from your boards, spots, alerts, and saved
          sessions.
        </p>

        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          {ACCESS_POINTS.map((point) => (
            <div
              key={point}
              className="notebook bg-[#FFFDF4] p-4 font-mono text-xs font-bold leading-relaxed text-[#11100D]/72 shadow-[2px_4px_0_rgba(17,16,13,0.12)]"
            >
              {point}
            </div>
          ))}
        </div>

        <Link
          href="/plans"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[12px_5px_14px_5px] border-2 border-[#11100D] bg-[#F4EBD8] px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_4px_0_rgba(0,0,0,0.14)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
        >
          See plans
        </Link>
      </div>
    </section>
  );
}
