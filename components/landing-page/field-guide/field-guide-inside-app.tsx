import Image from "next/image";
import type { ReactElement } from "react";

import { QuiverSticker } from "@/components/zine";

export function FieldGuideInsideApp(): ReactElement {
  return (
    <section
      data-testid="field-guide-inside-app"
      className="space-y-6"
      aria-labelledby="field-guide-inside-app-heading"
    >
      <div className="flex items-center justify-between border-b border-[#11100D]/15 pb-3">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[#11100D]">
          Inside the app
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#11100D]/55">
          Live on iPhone
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
        <div>
          <h2
            id="field-guide-inside-app-heading"
            className="font-[var(--font-zine-display)] text-4xl uppercase leading-[0.98] text-[#11100D] sm:text-5xl"
          >
            Built for the board you paddle out on.
          </h2>
          <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-[#11100D]/75 sm:text-base">
            Shortboards, logs, fish, midlengths. Quiver turns a beach forecast
            into the call you can actually use before you load the car.
          </p>
        </div>

        <div className="notebook relative overflow-hidden bg-[#FFFDF4] p-5 shadow-[2px_4px_0_rgba(0,0,0,0.18)]">
          <QuiverSticker
            sticker="surfWax"
            className="absolute left-8 top-2 z-20 w-24 -rotate-3"
            sizes="6rem"
          />
          <div className="grid gap-5 md:grid-cols-[0.84fr_1.16fr] md:items-center">
            <div className="pt-8 md:pt-0">
              <p className="inline-flex rounded-full border border-[#128A48]/25 bg-[#D7F5DD] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#145A35]">
                Live - App Store
              </p>
              <h3 className="mt-6 font-[var(--font-zine-display)] text-3xl uppercase leading-tight text-[#11100D]">
                Beach-level calls, filtered for how you surf.
              </h3>
              <p className="mt-3 font-mono text-sm leading-relaxed text-[#11100D]/70">
                Scan nearby breaks, save home spots, and see the window worth
                protecting before the first cup of coffee is gone.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[320px] md:max-w-[360px]">
              <div className="relative aspect-[9/13] overflow-hidden rounded-[16px_6px_18px_8px] border-2 border-[#11100D] bg-[#0D1020] shadow-[5px_6px_0_rgba(17,16,13,0.18)]">
                <Image
                  src="/images/app-screenshots/local-intel.png"
                  alt="Quiver app showing nearby surf spots and local intel"
                  fill
                  sizes="(min-width: 1024px) 360px, 80vw"
                  className="object-cover object-top"
                />
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#FFFDF4] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#0B3A75] shadow-[2px_3px_0_rgba(17,16,13,0.18)]">
                  Nearby breaks - live
                </div>
              </div>
              <QuiverSticker
                sticker="singleFin"
                className="absolute -bottom-5 -left-8 w-24 rotate-6"
                sizes="6rem"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
